/**
 * CORTEX VS Code / Cursor extension.
 *
 * Right-click any selection → Ask / Explain / Refactor / Fix with CORTEX.
 * The whole thing is ~200 LoC — it just shells out to cortex.mjs -p and
 * streams the output into a read-only editor tab.
 */
const vscode = require('vscode')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

function resolveCliPath() {
  const cfg = vscode.workspace.getConfiguration('cortex').get('cliPath')
  if (cfg && fs.existsSync(cfg)) return cfg
  const candidates = [
    ...(vscode.workspace.workspaceFolders || []).map(f => path.join(f.uri.fsPath, 'cortex.mjs')),
    path.join(os.homedir(), 'Documents', 'openclaude', 'cortex.mjs'),
  ]
  return candidates.find(p => fs.existsSync(p))
}

/** Stream CLI output into a new editor tab. */
async function runCortex(prompt, title) {
  const cli = resolveCliPath()
  if (!cli) {
    vscode.window.showErrorMessage(
      'CORTEX: cortex.mjs not found. Set `cortex.cliPath` in Settings to your repo\'s cortex.mjs',
    )
    return
  }
  const doc = await vscode.workspace.openTextDocument({ content: `# ${title}\n\n⏳ CORTEX is thinking…\n`, language: 'markdown' })
  const editor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside })

  const child = spawn(cli, ['-p', '--dangerously-skip-permissions', '--permission-mode', 'bypassPermissions', prompt], {
    cwd: path.dirname(cli),
    env: { ...process.env, CORTEX_NONINTERACTIVE: '1' },
  })

  let buffer = `# ${title}\n\n`
  const update = async () => {
    await editor.edit(eb => {
      const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
      eb.replace(fullRange, buffer)
    }, { undoStopBefore: false, undoStopAfter: false })
  }

  child.stdout.on('data', (c) => { buffer += stripAnsi(c.toString()); update() })
  child.stderr.on('data', (c) => { buffer += `\n<!-- stderr: ${stripAnsi(c.toString()).slice(0, 200)} -->\n` })
  child.on('close', (code) => {
    buffer += `\n\n---\n_exit ${code}_\n`
    update()
  })
}

function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*[mGKHJ]/g, '') }

function getSelection() {
  const ed = vscode.window.activeTextEditor
  if (!ed) return null
  const sel = ed.document.getText(ed.selection)
  return { text: sel, file: ed.document.fileName, language: ed.document.languageId }
}

function activate(context) {
  const reg = (name, handler) => context.subscriptions.push(vscode.commands.registerCommand(name, handler))

  reg('cortex.ask', async () => {
    const s = getSelection()
    if (!s || !s.text) return vscode.window.showWarningMessage('Select some code first')
    const q = await vscode.window.showInputBox({ prompt: 'Ask CORTEX about this selection:' })
    if (!q) return
    runCortex(
      `File: ${s.file}\nLanguage: ${s.language}\n\n\`\`\`${s.language}\n${s.text}\n\`\`\`\n\nQuestion: ${q}`,
      `CORTEX — ${q}`,
    )
  })

  reg('cortex.explain', () => {
    const s = getSelection()
    if (!s || !s.text) return vscode.window.showWarningMessage('Select some code first')
    runCortex(
      `Explain this ${s.language} code clearly, line by line where useful:\n\n\`\`\`${s.language}\n${s.text}\n\`\`\``,
      'CORTEX — Explain',
    )
  })

  reg('cortex.refactor', async () => {
    const s = getSelection()
    if (!s || !s.text) return vscode.window.showWarningMessage('Select some code first')
    const goal = await vscode.window.showInputBox({ prompt: 'Refactor goal (e.g. "extract function", "use async"):' })
    if (!goal) return
    runCortex(
      `Refactor this ${s.language} code. Goal: ${goal}\n\nOriginal:\n\`\`\`${s.language}\n${s.text}\n\`\`\`\n\nReturn the refactored code in a \`\`\`${s.language} block and explain the key changes.`,
      `CORTEX — Refactor: ${goal}`,
    )
  })

  reg('cortex.fix', () => {
    const s = getSelection()
    if (!s || !s.text) return vscode.window.showWarningMessage('Select some code first')
    runCortex(
      `Find bugs, edge cases, and correctness issues in this ${s.language} code. For each issue, show a minimal fix.\n\n\`\`\`${s.language}\n${s.text}\n\`\`\``,
      'CORTEX — Bug Hunt',
    )
  })

  reg('cortex.askFile', async () => {
    const ed = vscode.window.activeTextEditor
    if (!ed) return vscode.window.showWarningMessage('Open a file first')
    const q = await vscode.window.showInputBox({ prompt: 'Ask CORTEX about this file:' })
    if (!q) return
    runCortex(
      `File: ${ed.document.fileName}\n\n\`\`\`${ed.document.languageId}\n${ed.document.getText().slice(0, 50000)}\n\`\`\`\n\nQuestion: ${q}`,
      `CORTEX — ${q}`,
    )
  })

  vscode.window.showInformationMessage('CORTEX: right-click any selection to Ask / Explain / Refactor / Fix')
}

function deactivate() {}

module.exports = { activate, deactivate }
