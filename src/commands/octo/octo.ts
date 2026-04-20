import { existsSync, readFileSync, readdirSync, mkdirSync, openSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { homedir, platform } from 'node:os'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import type { LocalCommandCall } from '../../types/command.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Walk up from the bundled CLI location to find the repo root (where apps/octogent lives)
const findRepoRoot = (): string => {
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'apps/octogent/dist/api/cli.js'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const detectRunningOctogent = (): string | null => {
  const root = join(homedir(), '.octogent', 'projects')
  if (!existsSync(root)) return null
  try {
    for (const entry of readdirSync(root)) {
      const metaPath = join(root, entry, 'state', 'runtime.json')
      if (!existsSync(metaPath)) continue
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
        if (meta?.apiBaseUrl && meta?.pid) {
          try {
            process.kill(meta.pid, 0)
            return meta.apiBaseUrl
          } catch {
            /* dead pid */
          }
        }
      } catch {
        /* malformed meta */
      }
    }
  } catch {
    /* no dir */
  }
  return null
}

const launchOctogent = (repoRoot: string): number | null => {
  const launcher = resolve(repoRoot, 'bin/cortex-octogent')
  const dist = resolve(repoRoot, 'apps/octogent/dist/api/cli.js')
  if (!existsSync(launcher) || !existsSync(dist)) return null

  const logsDir = resolve(repoRoot, 'logs')
  try {
    mkdirSync(logsDir, { recursive: true })
  } catch {
    /* ignore */
  }
  const outLog = openSync(join(logsDir, 'octogent.out.log'), 'a')
  const errLog = openSync(join(logsDir, 'octogent.err.log'), 'a')

  const blockedBin = resolve(repoRoot, '.bin')
  const cleanPath = (process.env.PATH || '')
    .split(':')
    .filter(p => p && p !== blockedBin)
    .join(':')

  const child = spawn('node', [launcher], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', outLog, errLog],
    env: {
      ...process.env,
      PATH: cleanPath,
      CORTEX_ALLOW_OPEN: '1',
      OCTOGENT_NO_OPEN: '1',
    },
  })
  child.unref()
  return child.pid ?? null
}

const waitUntilReady = (url: string, timeoutMs = 30000): Promise<boolean> =>
  new Promise(resolve => {
    const deadline = Date.now() + timeoutMs
    const tryOnce = () => {
      const req = http.get(url, res => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true)
        } else {
          schedule()
        }
      })
      req.on('error', schedule)
      req.setTimeout(1500, () => {
        req.destroy()
        schedule()
      })
    }
    const schedule = () => {
      if (Date.now() > deadline) return resolve(false)
      setTimeout(tryOnce, 400)
    }
    tryOnce()
  })

const openInBrowser = (url: string): boolean => {
  const plat = platform()
  let cmd: string
  let args: string[]
  if (plat === 'darwin') {
    cmd = '/usr/bin/open'
    args = [url]
  } else if (plat === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
    return true
  } catch {
    return false
  }
}

export const call: LocalCommandCall = async () => {
  const repoRoot = findRepoRoot()
  let url = detectRunningOctogent()
  let launched = false

  if (!url) {
    const pid = launchOctogent(repoRoot)
    if (!pid) {
      return {
        type: 'text',
        value:
          '✗ Cortex UI not available — apps/octogent is not built.\n  Run: make build   (or: cd apps/octogent && pnpm install && pnpm build)',
      }
    }
    launched = true
    url = 'http://127.0.0.1:8787'
  }

  const bust = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`
  const ready = await waitUntilReady(url)

  if (!ready) {
    return {
      type: 'text',
      value: `⚠  Octogent launched (pid) but didn't respond in 30s.\n  Check logs/octogent.err.log · URL: ${url}`,
    }
  }

  const opened = openInBrowser(bust)

  const lines = [
    opened
      ? `🌐 Opened Cortex UI: ${bust}`
      : `⚠  Could not auto-open browser — visit ${url} manually`,
    launched ? '  (Octogent started in background)' : '  (Octogent was already running)',
  ]

  return { type: 'text', value: lines.join('\n') }
}
