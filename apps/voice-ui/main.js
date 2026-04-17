/**
 * CORTEX Voice UI — Electron main process.
 * Creates a small, always-on-top floating window and handles IPC
 * between the renderer and the AGI CLI (cortex.mjs).
 */
const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const https = require('node:https')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGI_BIN = path.join(REPO_ROOT, 'cortex.mjs')

// Load .env so HF_TOKEN etc. are available when we spawn cortex.mjs
function loadDotenv() {
  const envPath = path.join(REPO_ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadDotenv()

let win = null

// ─── Structured logger (streamed to renderer + stderr) ──────────
// Each call becomes a bubble in the UI log panel AND a line in the
// terminal where you launched `./bin/AGI-ui`, so you always see what
// the app is doing — exactly like watching the CLI.
function log(level, stage, msg, extra) {
  const ts = new Date().toISOString().slice(11, 23)
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${stage.padEnd(14)} ${msg}`
  // Main-process console → terminal (handle EPIPE during shutdown)
  try {
    process.stderr.write(line + (extra ? '  ' + JSON.stringify(extra) : '') + '\n')
  } catch (e) {
    // Ignore EPIPE during shutdown
  }
  // Renderer → UI log panel
  if (win && !win.isDestroyed()) {
    win.webContents.send('log:event', { ts, level, stage, msg, extra })
  }
}


function createWindow() {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    width: 420,
    height: 560,
    x: sw - 440,
    y: 20,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: true,
    skipTaskbar: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadFile('index.html')
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)
}

// ─── IPC: full AGI CLI (slow but has tools/MCP/full brain) ───────
// Runs with --dangerously-skip-permissions so NO yes/no prompts ever block.
ipcMain.handle('agi:ask', async (_evt, prompt) => {
  if (!fs.existsSync(AGI_BIN)) {
    log('error', 'agi.spawn', `binary missing at ${AGI_BIN}`)
    return { error: `AGI binary not found at ${AGI_BIN}` }
  }
  const argv = ['-p', '--dangerously-skip-permissions', '--permission-mode', 'bypassPermissions', prompt]
  log('info', 'agi.spawn', `cortex.mjs ${argv.slice(0, 4).join(' ')}  <prompt ${prompt.length} chars>`)
  const t0 = Date.now()
  return new Promise((resolve) => {
    const child = spawn(AGI_BIN, argv, {
      cwd: REPO_ROOT,
      env: { ...process.env, CORTEX_NONINTERACTIVE: '1' },
    })
    log('info', 'agi.pid', `pid=${child.pid}`)
    let out = ''
    let err = ''
    let stderrLines = 0
    // 10 min — AGI may be doing tool loops, file reads, web fetches, etc.
    const timer = setTimeout(() => {
      log('warn', 'agi.timeout', '600s exceeded, killing child')
      child.kill('SIGTERM')
      resolve({ error: 'AGI timed out after 600s', partial: stripAnsi(out).trim() })
    }, 600_000)

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      out += text
      if (win) win.webContents.send('agi:chunk', text)
    })
    child.stderr.on('data', (chunk) => {
      const s = chunk.toString()
      err += s
      // Surface the first ~20 stderr lines so users see progress
      if (stderrLines < 20) {
        for (const ln of s.split('\n').filter(Boolean)) {
          if (stderrLines++ >= 20) break
          log('debug', 'agi.stderr', stripAnsi(ln).slice(0, 200))
        }
      }
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const cleaned = stripAnsi(out).trim()
      const ms = Date.now() - t0
      log('info', 'agi.done', `exit=${code} ${ms}ms out=${cleaned.length}ch`)
      if (code === 0 || cleaned) resolve({ text: cleaned })
      else resolve({ error: err.trim() || `exit ${code}`, text: cleaned })
    })
  })
})

// ─── IPC: Fast chat (direct HF router, <2s) ──────────────────────
// Bypasses the whole CLI boot. No tools, no MCP — just a blazing fast
// chat completion for conversation / Q&A. Perfect for the UI's default mode.
function hfChat({ messages, model, stream = false, onChunk, stage = 'hf.chat' }) {
  return new Promise((resolve, reject) => {
    const token = process.env.HF_TOKEN
    if (!token) return reject(new Error('HF_TOKEN not set'))
    const base = process.env.HF_BASE_URL || 'https://router.huggingface.co/v1'
    const url = new URL(base.replace(/\/$/, '') + '/chat/completions')
    const resolvedModel = model || process.env.HF_MODEL_ID || 'zai-org/GLM-5:together'
    const body = JSON.stringify({
      model: resolvedModel,
      messages,
      stream,
      max_tokens: 1024,
      temperature: 0.4,
    })
    const t0 = Date.now()
    let firstByteMs = null
    let chunkCount = 0
    let charCount = 0
    log('info', stage, `POST ${url.hostname} model=${resolvedModel} stream=${stream} body=${body.length}B`)
    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        log('info', stage, `HTTP ${res.statusCode}`)
        let buf = ''
        res.on('data', (c) => {
          if (firstByteMs === null) {
            firstByteMs = Date.now() - t0
            log('info', stage, `first-byte ${firstByteMs}ms`)
          }
          const s = c.toString()
          buf += s
          if (stream && onChunk) {
            // Parse SSE frames
            const lines = buf.split('\n')
            buf = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') continue
              try {
                const j = JSON.parse(payload)
                const delta = j.choices?.[0]?.delta?.content
                if (delta) { chunkCount++; charCount += delta.length; onChunk(delta) }
              } catch { /* partial frame */ }
            }
          }
        })
        res.on('end', () => {
          const ms = Date.now() - t0
          if (stream) {
            log('info', stage, `done ${ms}ms chunks=${chunkCount} chars=${charCount}`)
            return resolve({ ok: true })
          }
          try {
            const j = JSON.parse(buf)
            if (j.error) {
              log('error', stage, `api-error: ${j.error.message || JSON.stringify(j.error)}`)
              return reject(new Error(j.error.message || JSON.stringify(j.error)))
            }
            const text = j.choices?.[0]?.message?.content || ''
            const usage = j.usage || {}
            log('info', stage, `done ${ms}ms chars=${text.length} in=${usage.prompt_tokens ?? '?'}tok out=${usage.completion_tokens ?? '?'}tok`)
            resolve({ text })
          } catch (e) { reject(new Error('Bad JSON from HF: ' + buf.slice(0, 200))) }
        })
      },
    )
    req.on('error', (e) => { log('error', stage, `network: ${e.message}`); reject(e) })
    req.write(body)
    req.end()
  })
}

ipcMain.handle('agi:fastAsk', async (_evt, { prompt, context }) => {
  log('info', 'fast.ask', `prompt="${prompt.slice(0, 60)}"${context ? ' +screen-ctx' : ''}`)
  try {
    const messages = [
      {
        role: 'system',
        content:
          'You are CORTEX, a concise, helpful AGI assistant running on the user\'s Mac. ' +
          'You can see what the user is doing on their screen via a live screen-watcher. ' +
          'Be direct, practical, and brief unless asked for detail. ' +
          'If the user asks about their current task, use the screen context.',
      },
    ]
    if (context) {
      messages.push({
        role: 'system',
        content: `Current screen context (auto-captured): ${context}`,
      })
    }
    messages.push({ role: 'user', content: prompt })
    await hfChat({
      messages,
      stream: true,
      stage: 'fast.ask',
      onChunk: (d) => win && win.webContents.send('agi:chunk', d),
    })
    return { text: '__streamed__' }
  } catch (e) {
    log('error', 'fast.ask', String(e.message || e))
    return { error: String(e.message || e) }
  }
})

// ─── IPC: screen capture + describe (Tier A — watch my desktop) ──
ipcMain.handle('screen:snapshot', async () => {
  const t0 = Date.now()
  try {
    log('info', 'screen.snap', 'capturing...')
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    if (!sources.length) throw new Error('No screen sources found')
    const source = sources[0]
    log('info', 'screen.snap', `source: ${source.name} ${source.thumbnail_size}`)
    const dataUrl = source.thumbnail.toDataURL()
    log('info', 'screen.snap', `captured "Entire screen" ${Math.round(dataUrl.length / 1024)}KB in ${Date.now() - t0}ms`)
    return { dataUrl }
  } catch (e) {
    log('error', 'screen.snap', String(e.message || e))
    return { error: String(e.message || e) }
  }
})

ipcMain.handle('screen:snap', async () => {
  try {
    log('info', 'screen.snap', 'capturing...')
    const t0 = Date.now()
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    if (!sources.length) throw new Error('No screen sources found')
    const source = sources[0]
    const thumbnail = source.thumbnail
    // Downscale to max 512px for vision API (avoids 413 errors)
    const resized = thumbnail.resize({ width: 512, height: 512 })
    const dataUrl = resized.toDataURL('image/jpeg', 0.7)
    log('info', 'screen.snap', `captured "Entire screen" ${Math.round(dataUrl.length / 1024)}KB in ${Date.now() - t0}ms`)
    return { dataUrl }
  } catch (e) {
    log('error', 'screen.snap', String(e.message || e))
    return { error: String(e.message || e) }
  }
})

ipcMain.handle('screen:describe', async (_evt, { dataUrl }) => {
  try {
    const token = process.env.HF_TOKEN
    if (!token) { log('error', 'screen.vision', 'HF_TOKEN not set'); return { error: 'HF_TOKEN not set' } }
    // Use HF Inference API directly for vision (router doesn't support vision models)
    const model = process.env.CORTEX_VISION_MODEL || 'nlpconnect/vit-gpt2-image-captioning'
    const t0 = Date.now()
    log('info', 'screen.vision', `POST api-inference.huggingface.co model=${model} body=${dataUrl.length}B`)
    const response = await fetch('https://api-inference.huggingface.co/models/' + model, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: dataUrl }),
    })
    const firstByte = Date.now() - t0
    log('info', 'screen.vision', `first-byte ${firstByte}ms`)
    if (!response.ok) {
      const err = await response.text().catch(() => '')
      log('error', 'screen.vision', `HTTP ${response.status} ${err}`)
      return { error: `HTTP ${response.status}` }
    }
    const data = await response.json()
    let text = ''
    if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text
    } else if (data?.generated_text) {
      text = data.generated_text
    } else if (typeof data === 'string') {
      text = data
    } else {
      text = JSON.stringify(data)
    }
    log('info', 'screen.vision', `done ${Date.now() - t0}ms chars=${text.length}`)
    return { text: text.trim() }
  } catch (e) {
    log('error', 'screen.vision', String(e.message || e))
    return { error: String(e.message || e) }
  }
})

ipcMain.handle('window:close', () => win && win.close())
ipcMain.handle('window:minimize', () => win && win.minimize())
ipcMain.handle('window:pin', (_e, pinned) => {
  if (win) win.setAlwaysOnTop(Boolean(pinned), 'floating')
  return Boolean(pinned)
})
ipcMain.handle('window:maximize', () => {
  if (!win) return false
  if (win.isMaximized()) { win.unmaximize(); return false }
  win.maximize(); return true
})
ipcMain.handle('window:fullscreen', () => {
  if (!win) return false
  const next = !win.isFullScreen()
  win.setFullScreen(next)
  return next
})

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[mGKHJ]/g, '')
}

app.whenReady().then(() => {
  createWindow()
  log('info', 'app.ready', `electron=${process.versions.electron} node=${process.versions.node} repo=${REPO_ROOT}`)
  log('info', 'app.env', `HF_TOKEN=${process.env.HF_TOKEN ? 'set' : 'MISSING'} model=${process.env.HF_MODEL_ID || 'zai-org/GLM-5:together'}`)

  // Global hotkey: Cmd+Shift+A to toggle window from anywhere
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    if (!win) return createWindow()
    if (win.isVisible()) win.hide(); else win.show()
  })

  // Global hotkey: Cmd+Shift+F to toggle fullscreen
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (win) win.setFullScreen(!win.isFullScreen())
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => globalShortcut.unregisterAll())
