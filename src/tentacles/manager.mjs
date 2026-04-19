/**
 * CORTEX Tentacles — multi-agent orchestration via scoped context folders.
 *
 * Inspired by octogent (https://github.com/hesamsheikh/octogent) but
 * implemented fresh with zero upstream code for clean licensing.
 *
 * Concepts:
 *   - A tentacle is a folder under `.cortex/tentacles/<id>/` holding:
 *       CONTEXT.md  → scoped instructions for any agent entering it
 *       todo.md     → checklist of work items (markdown checkboxes)
 *       notes/      → free-form markdown notes by the agent(s)
 *       inbox.jsonl → incoming messages from other tentacles
 *       outbox.jsonl→ sent messages (audit log)
 *       state.json  → tentacle metadata (created, status, parent, children)
 *
 *   - Agents running inside a tentacle see ONLY that folder's context,
 *     not the global project. This makes multi-agent work tractable.
 *
 *   - Tentacles can spawn child tentacles and exchange messages via
 *     inbox.jsonl / outbox.jsonl (append-only, durable).
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const ROOT = process.env.CORTEX_TENTACLE_ROOT || resolve(process.cwd(), '.cortex/tentacles')

function ensureRoot() {
  mkdirSync(ROOT, { recursive: true })
}

function tentaclePath(id) {
  return join(ROOT, id)
}

function readState(id) {
  const p = join(tentaclePath(id), 'state.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

function writeState(id, state) {
  writeFileSync(join(tentaclePath(id), 'state.json'), JSON.stringify(state, null, 2))
}

// ---------- CREATE ----------
export function createTentacle({ name, context = '', parent = null, todos = [] } = {}) {
  if (!name) throw new Error('tentacle name is required')
  ensureRoot()

  const id = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
  const dir = tentaclePath(id)

  if (existsSync(dir)) {
    throw new Error(`tentacle '${id}' already exists at ${dir}`)
  }

  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, 'notes'), { recursive: true })

  // CONTEXT.md — scoped instructions
  const contextMd = context || `# ${name}

## Scope
Describe what this tentacle is responsible for. One slice of work.

## Constraints
- Stay within this scope.
- Update \`todo.md\` as work progresses.
- Drop notes in \`notes/\` with short descriptive filenames.
- Send messages to sibling tentacles via \`outbox.jsonl\`.
`
  writeFileSync(join(dir, 'CONTEXT.md'), contextMd)

  // todo.md — execution surface
  const todoMd = [
    `# Todo — ${name}`,
    '',
    ...(todos.length ? todos.map(t => `- [ ] ${t}`) : ['- [ ] Define the first task']),
    '',
  ].join('\n')
  writeFileSync(join(dir, 'todo.md'), todoMd)

  // Empty message files
  writeFileSync(join(dir, 'inbox.jsonl'), '')
  writeFileSync(join(dir, 'outbox.jsonl'), '')

  // Metadata
  const state = {
    id,
    name,
    created: new Date().toISOString(),
    status: 'idle',
    parent,
    children: [],
    pids: [],
  }
  writeState(id, state)

  // Record as child on parent
  if (parent) {
    const parentState = readState(parent)
    if (parentState) {
      parentState.children.push(id)
      writeState(parent, parentState)
    }
  }

  return { id, dir, state }
}

// ---------- LIST ----------
export function listTentacles() {
  ensureRoot()
  const ids = readdirSync(ROOT).filter(f => {
    try { return statSync(join(ROOT, f)).isDirectory() } catch { return false }
  })
  return ids.map(id => {
    const state = readState(id)
    const todoPath = join(tentaclePath(id), 'todo.md')
    const todo = existsSync(todoPath) ? readFileSync(todoPath, 'utf8') : ''
    const open = (todo.match(/^- \[ \]/gm) || []).length
    const done = (todo.match(/^- \[x\]/gmi) || []).length
    return { ...state, todos: { open, done, total: open + done } }
  }).filter(Boolean)
}

// ---------- REMOVE ----------
export function removeTentacle(id) {
  const dir = tentaclePath(id)
  if (!existsSync(dir)) throw new Error(`tentacle '${id}' not found`)
  rmSync(dir, { recursive: true, force: true })
  return { removed: id }
}

// ---------- TODOS ----------
export function readTodos(id) {
  const p = join(tentaclePath(id), 'todo.md')
  if (!existsSync(p)) throw new Error(`tentacle '${id}' has no todo.md`)
  const content = readFileSync(p, 'utf8')
  const items = []
  for (const line of content.split('\n')) {
    const m = line.match(/^- \[([ xX])\] (.+)$/)
    if (m) items.push({ done: m[1].toLowerCase() === 'x', text: m[2] })
  }
  return { content, items }
}

export function addTodo(id, text) {
  const p = join(tentaclePath(id), 'todo.md')
  const existing = existsSync(p) ? readFileSync(p, 'utf8') : `# Todo\n\n`
  const updated = existing.trimEnd() + `\n- [ ] ${text}\n`
  writeFileSync(p, updated)
  return { added: text }
}

export function checkTodo(id, index) {
  const p = join(tentaclePath(id), 'todo.md')
  const lines = readFileSync(p, 'utf8').split('\n')
  let cursor = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^- \[[ xX]\]/.test(lines[i])) {
      if (cursor === index) {
        lines[i] = lines[i].replace(/^- \[[ xX]\]/, '- [x]')
        writeFileSync(p, lines.join('\n'))
        return { checked: lines[i].slice(6) }
      }
      cursor++
    }
  }
  throw new Error(`no todo at index ${index}`)
}

// ---------- MESSAGING ----------
export function sendMessage(fromId, toId, text) {
  const fromDir = tentaclePath(fromId)
  const toDir = tentaclePath(toId)
  if (!existsSync(toDir)) throw new Error(`recipient tentacle '${toId}' not found`)

  const msg = {
    id: randomUUID(),
    from: fromId,
    to: toId,
    text,
    timestamp: new Date().toISOString(),
  }
  const line = JSON.stringify(msg) + '\n'

  appendFileSync(join(toDir, 'inbox.jsonl'), line)
  if (existsSync(fromDir)) {
    appendFileSync(join(fromDir, 'outbox.jsonl'), line)
  }
  return msg
}

export function readInbox(id, { unreadOnly = false } = {}) {
  const p = join(tentaclePath(id), 'inbox.jsonl')
  if (!existsSync(p)) return []
  const raw = readFileSync(p, 'utf8').trim()
  if (!raw) return []
  const msgs = raw.split('\n').map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  if (unreadOnly) return msgs.filter(m => !m.read)
  return msgs
}

// ---------- SPAWN CHILD CORTEX ----------
export function spawnAgent(id, { prompt, cliPath } = {}) {
  const dir = tentaclePath(id)
  if (!existsSync(dir)) throw new Error(`tentacle '${id}' not found`)

  const state = readState(id)
  state.status = 'running'
  writeState(id, state)

  const cli = cliPath || resolve(process.cwd(), 'cortex.mjs')
  const contextMd = readFileSync(join(dir, 'CONTEXT.md'), 'utf8')
  const todoMd = existsSync(join(dir, 'todo.md')) ? readFileSync(join(dir, 'todo.md'), 'utf8') : ''

  const fullPrompt = [
    `You are working inside tentacle '${id}'.`,
    `Working directory: ${dir}`,
    ``,
    `--- CONTEXT.md ---`,
    contextMd,
    ``,
    `--- todo.md ---`,
    todoMd,
    ``,
    `--- TASK ---`,
    prompt || 'Work through the first unchecked item in todo.md.',
  ].join('\n')

  const child = spawn('node', [cli, '-p', '--dangerously-skip-permissions', fullPrompt], {
    cwd: dir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CORTEX_TENTACLE_ID: id,
      CORTEX_TENTACLE_ROOT: ROOT,
    },
  })

  state.pids.push(child.pid)
  writeState(id, state)

  child.on('exit', (code) => {
    const s = readState(id)
    if (s) {
      s.status = code === 0 ? 'idle' : 'errored'
      s.pids = s.pids.filter(p => p !== child.pid)
      writeState(id, s)
    }
  })

  return { pid: child.pid, id }
}

export { ROOT as TENTACLE_ROOT }
