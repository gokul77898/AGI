#!/usr/bin/env node
/**
 * CORTEX Web UI — localhost dashboard.
 *
 * Endpoints:
 *   GET  /                    → dashboard page
 *   GET  /api/status          → { agents, commands, mcps, rag, env }
 *   GET  /api/commands        → [{ name, aliases, description, tier }]
 *   GET  /api/agents          → [{ name, path, kind }]
 *   GET  /api/mcp             → { servers: [{name, cmd, configured}] }
 *   POST /api/ask  {prompt}   → streams AGI output via SSE
 *   WS   /ws                  → live session events (ask start/chunk/done)
 *
 * No build step, no framework — plain ESM, Express + ws, ~300 LoC.
 */
import express from 'express'
import { WebSocketServer } from 'ws'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGI_BIN = path.join(REPO_ROOT, 'cortex.mjs')
const PORT = Number(process.env.CORTEX_WEB_PORT || 3737)

// ─── Load .env ─────────────────────────────────────────────
;(() => {
  const p = path.join(REPO_ROOT, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
})()

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// ─── Discovery helpers ─────────────────────────────────────
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function listCommands() {
  // Scan src/commands/tier*/*.ts for name + description
  const out = []
  const tiersDir = path.join(REPO_ROOT, 'src', 'commands')
  if (!fs.existsSync(tiersDir)) return out
  for (const tier of fs.readdirSync(tiersDir)) {
    const dir = path.join(tiersDir, tier)
    if (!fs.statSync(dir).isDirectory()) continue
    if (!tier.startsWith('tier')) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      const name = src.match(/name:\s*['"]([^'"]+)['"]/)?.[1]
      const aliases = src.match(/aliases:\s*\[([^\]]+)\]/)?.[1]?.match(/'([^']+)'/g)?.map(s => s.slice(1, -1)) || []
      const desc = src.match(/description:\s*(?:\n\s*)?['"]([^'"]+)['"]/)?.[1] || ''
      if (name) out.push({ name, aliases, description: desc, tier })
    }
  }
  return out
}

function listAgents() {
  const agentsDir = path.join(REPO_ROOT, 'src', 'skills', 'agency')
  if (!fs.existsSync(agentsDir)) return []
  const out = []
  function walk(d, depth = 0) {
    if (depth > 4) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.name.endsWith('.md') || e.name.endsWith('.ts') || e.name.endsWith('.json')) {
        out.push({
          name: e.name.replace(/\.[^.]+$/, ''),
          path: path.relative(REPO_ROOT, p),
          kind: e.name.split('.').pop(),
        })
      }
    }
  }
  walk(agentsDir)
  return out.slice(0, 500)
}

function listMcpServers() {
  const mcp = readJSON(path.join(REPO_ROOT, '.mcp.json')) || { mcpServers: {} }
  return Object.entries(mcp.mcpServers || {}).map(([name, cfg]) => {
    const envs = Object.keys(cfg.env || {})
    const configured = envs.every(k => !!process.env[k])
    return { name, cmd: [cfg.command, ...(cfg.args || [])].join(' '), envs, configured }
  })
}

// ─── API ───────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  const commands = listCommands()
  const agents = listAgents()
  const mcps = listMcpServers()
  res.json({
    env: {
      hfToken: !!process.env.HF_TOKEN,
      model: process.env.HF_MODEL_ID || 'zai-org/GLM-5:together',
      github: !!process.env.GITHUB_TOKEN,
      ollama: !!process.env.OLLAMA_HOST || fs.existsSync('/usr/local/bin/ollama') || fs.existsSync('/opt/homebrew/bin/ollama'),
    },
    counts: { commands: commands.length, agents: agents.length, mcps: mcps.length },
    repo: REPO_ROOT,
    pid: process.pid,
    uptime: process.uptime(),
  })
})

app.get('/api/commands', (_req, res) => res.json(listCommands()))
app.get('/api/agents', (_req, res) => res.json(listAgents()))
app.get('/api/mcp', (_req, res) => res.json({ servers: listMcpServers() }))

// History (simple file-backed log)
const HISTORY_FILE = path.join(REPO_ROOT, 'data', 'web-ui-history.jsonl')
fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true })
app.get('/api/history', (_req, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([])
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean)
  res.json(lines.slice(-50).reverse().map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean))
})

// SSE stream for /api/ask (works without websocket)
app.post('/api/ask', (req, res) => {
  const prompt = String(req.body?.prompt || '').slice(0, 4000)
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  const start = Date.now()
  send('start', { prompt, ts: start })

  const child = spawn(
    AGI_BIN,
    ['-p', '--dangerously-skip-permissions', '--permission-mode', 'bypassPermissions', prompt],
    { cwd: REPO_ROOT, env: { ...process.env, CORTEX_NONINTERACTIVE: '1' } },
  )
  let buf = ''
  child.stdout.on('data', (c) => {
    const s = c.toString()
    buf += s
    send('chunk', { text: s })
    broadcast({ type: 'chunk', text: s })
  })
  child.stderr.on('data', (c) => send('stderr', { text: c.toString() }))
  child.on('close', (code) => {
    const ms = Date.now() - start
    send('done', { code, ms, chars: buf.length })
    broadcast({ type: 'done', code, ms })
    // Persist
    fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: start, prompt, code, ms, preview: buf.slice(0, 500) }) + '\n')
    res.end()
  })
  req.on('close', () => { try { child.kill('SIGTERM') } catch {} })
})

// ─── WebSocket broadcast ───────────────────────────────────
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })
const sockets = new Set()
wss.on('connection', (ws) => {
  sockets.add(ws)
  ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }))
  ws.on('close', () => sockets.delete(ws))
})
function broadcast(msg) {
  const s = JSON.stringify(msg)
  for (const ws of sockets) { try { ws.send(s) } catch {} }
}

server.listen(PORT, () => {
  console.log(`\n🧠  CORTEX Dashboard  →  http://localhost:${PORT}\n`)
  if (process.env.CORTEX_AUTO_OPEN !== 'false') {
    const opener = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start'
      : 'xdg-open'
    spawn(opener, [`http://localhost:${PORT}`], { detached: true, stdio: 'ignore' }).unref()
  }
})
