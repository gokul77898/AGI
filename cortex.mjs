#!/usr/bin/env node
/**
 * CORTEX CLI Launcher
 * Loads .env, enforces Python venv, and surfaces Octogent status
 * before handing off to the main CLI.
 */
import { readFileSync, existsSync, mkdirSync, openSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, spawn } from 'child_process';
import { homedir, platform } from 'os';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUIET = process.env.CORTEX_QUIET === '1';
const log = (...args) => { if (!QUIET) console.error(...args); };

// ---------------------------------------------------------------------------
// 1. Python venv — auto-create if missing so AGI always runs inside venv
// ---------------------------------------------------------------------------
const __venvDir = resolve(__dirname, '.venv');
const __venvBin = resolve(__venvDir, 'bin');
const __venvPython = resolve(__venvBin, 'python3');

if (!existsSync(__venvPython)) {
  log('⚠  venv missing — bootstrapping .venv/ (one-time, ~20s)...');
  const created = spawnSync('python3', ['-m', 'venv', __venvDir], { stdio: 'inherit' });
  if (created.status === 0) {
    spawnSync(resolve(__venvBin, 'pip'), ['install', '--quiet', '--upgrade', 'pip', 'uv'], { stdio: 'inherit' });
    const reqPath = resolve(__dirname, 'python/requirements.txt');
    if (existsSync(reqPath)) {
      spawnSync(resolve(__venvBin, 'pip'), ['install', '--quiet', '-r', reqPath], { stdio: 'inherit' });
    }
    log('✓  venv created at .venv/');
  } else {
    log('✗  venv bootstrap failed — run ./install.sh manually');
  }
}

const __uvBin = resolve(process.env.HOME || '', '.local/bin');
process.env.PATH = __venvBin + ':' + __uvBin + ':' + (process.env.PATH || '');
process.env.VIRTUAL_ENV = __venvDir;

// Block ALL browser opens by injecting a fake `open` binary first in PATH
// (disabled if CORTEX_ALLOW_OPEN=1 is set)
if (process.env.CORTEX_ALLOW_OPEN !== '1') {
  const __binDir = resolve(__dirname, '.bin');
  process.env.PATH = __binDir + ':' + (process.env.PATH || '');
}

// ---------------------------------------------------------------------------
// 2. Load .env from project root
// ---------------------------------------------------------------------------
try {
  const envPath = resolve(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch { /* no .env — fine */ }

// ---------------------------------------------------------------------------
// 3. Preflight — check venv, auto-launch Octogent in background, open browser
// ---------------------------------------------------------------------------
// Detect a currently running Octogent instance (via runtime.json written on startup)
const detectRunningOctogent = () => {
  const root = join(homedir(), '.octogent', 'projects');
  if (!existsSync(root)) return null;
  try {
    for (const entry of readdirSync(root)) {
      const metaPath = join(root, entry, 'state', 'runtime.json');
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        if (meta?.apiBaseUrl && meta?.pid) {
          try { process.kill(meta.pid, 0); return meta.apiBaseUrl; } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
};

// Spawn Octogent in the background
const autoLaunchOctogent = () => {
  const octogentLauncher = resolve(__dirname, 'bin/cortex-octogent');
  const octogentDist = resolve(__dirname, 'apps/octogent/dist/api/cli.js');
  if (!existsSync(octogentLauncher) || !existsSync(octogentDist)) return null;

  const logsDir = resolve(__dirname, 'logs');
  try { mkdirSync(logsDir, { recursive: true }); } catch {}
  const outLog = openSync(join(logsDir, 'octogent.out.log'), 'a');
  const errLog = openSync(join(logsDir, 'octogent.err.log'), 'a');

  // Strip .bin shim from PATH so Octogent sub-commands resolve to real binaries.
  const blockedBin = resolve(__dirname, '.bin');
  const cleanPath = (process.env.PATH || '')
    .split(':')
    .filter((p) => p && p !== blockedBin)
    .join(':');

  const child = spawn('node', [octogentLauncher], {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', outLog, errLog],
    env: {
      ...process.env,
      PATH: cleanPath,
      CORTEX_ALLOW_OPEN: '1',
      OCTOGENT_NO_OPEN: '1', // We open the browser from the parent (this file) instead.
    },
  });
  child.unref();
  return child.pid;
};

// Poll an HTTP endpoint until it returns 2xx, then call the callback
const waitUntilReady = (url, onReady, { timeoutMs = 30000, intervalMs = 400 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  const tryOnce = () => {
    const req = http.get(url, (res) => {
      res.resume();
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
        onReady(url);
      } else {
        schedule();
      }
    });
    req.on('error', schedule);
    req.setTimeout(1500, () => { req.destroy(); schedule(); });
  };
  const schedule = () => {
    if (Date.now() > deadline) return;
    setTimeout(tryOnce, intervalMs);
  };
  tryOnce();
};

// Open a URL in the default browser, bypassing the .bin/open shim
const openInBrowser = (url) => {
  const plat = platform();
  let cmd, args;
  if (plat === 'darwin') { cmd = '/usr/bin/open'; args = [url]; }
  else if (plat === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '', url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    log(`🌐 Opened Cortex UI in browser: ${url}`);
  } catch (err) {
    log(`⚠  Could not open browser automatically — visit ${url} manually`);
  }
};

if (!QUIET && process.env.CORTEX_NO_PREFLIGHT !== '1') {
  const venvActive = existsSync(__venvPython);
  const octogentDist = resolve(__dirname, 'apps/octogent/dist/api/cli.js');
  const octogentBuilt = existsSync(octogentDist);

  let octogentRunning = detectRunningOctogent();
  let octogentStatus;
  let urlToOpen = null;

  if (octogentRunning) {
    octogentStatus = `✓ running @ ${octogentRunning}`;
    urlToOpen = octogentRunning;
  } else if (!octogentBuilt) {
    octogentStatus = '✗ not built (run: make build)';
  } else if (process.env.CORTEX_NO_OCTOGENT === '1') {
    octogentStatus = '● built (auto-launch disabled: CORTEX_NO_OCTOGENT=1)';
  } else {
    const pid = autoLaunchOctogent();
    octogentStatus = pid
      ? `🚀 launching (pid ${pid}) — UI will auto-open at http://127.0.0.1:8787`
      : '✗ failed to launch';
    if (pid) urlToOpen = 'http://127.0.0.1:8787';
  }

  log('┌─ CORTEX preflight ──────────────────────────────');
  log(`│ venv:     ${venvActive ? '✓ active' : '✗ missing'}  (${__venvDir})`);
  log(`│ octogent: ${octogentStatus}`);
  log(`│ logs:     ${resolve(__dirname, 'logs/')} (cortex + octogent.out.log)`);
  log('└────────────────────────────────────────────');

  // Wait for Octogent API to be ready, then open browser (bypasses .bin/open shim)
  if (urlToOpen && process.env.CORTEX_NO_OPEN !== '1') {
    waitUntilReady(urlToOpen, (readyUrl) => {
      // Cache-bust so the user sees the latest Cortex-themed UI, not a stale cached copy
      const bust = `${readyUrl}${readyUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
      openInBrowser(bust);
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Now load the actual CLI
// ---------------------------------------------------------------------------
await import('./dist/cli.mjs');
