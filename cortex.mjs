#!/usr/bin/env node
/**
 * CORTEX CLI Launcher
 * Loads .env before starting the main CLI to ensure all provider
 * configuration is available at startup.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prefer project-local .venv/bin first (Python, uvx, uv), fall back to ~/.local/bin
const __venvBin = resolve(__dirname, '.venv/bin');
const __uvBin = resolve(process.env.HOME || '', '.local/bin');
process.env.PATH = __venvBin + ':' + __uvBin + ':' + (process.env.PATH || '');
// Point VIRTUAL_ENV so Python subprocesses know they're in the venv
process.env.VIRTUAL_ENV = resolve(__dirname, '.venv');

// Block ALL browser opens by injecting a fake `open` binary first in PATH
// (disabled if CORTEX_ALLOW_OPEN=1 is set)
if (process.env.CORTEX_ALLOW_OPEN !== '1') {
  const __binDir = resolve(__dirname, '.bin');
  process.env.PATH = __binDir + ':' + (process.env.PATH || '');
}

// Load .env from project root
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

// Now load the actual CLI
await import('./dist/cli.mjs');
