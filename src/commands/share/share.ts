import { userInfo } from 'node:os'
// @ts-expect-error - qrcode ships without bundled types in this repo
import { toString as qrToString } from 'qrcode'
import { startShareServer, type ShareServerHandle } from '../../services/shareServer/server.js'
import type { ShareMessage } from '../../services/shareServer/server.js'
import type { LocalCommandCall } from '../../types/command.js'

// Singleton — the CLI can call /share many times; it's idempotent.
let active: ShareServerHandle | null = null

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

type Args = { stop: boolean; port?: number; tunnel: boolean }

const parseArgs = (args: string): Args => {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  let stop = false
  let tunnel = false
  let port: number | undefined
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'stop' || t === '--stop' || t === 'off') stop = true
    else if (t === '--tunnel' || t === '--global' || t === '--public') tunnel = true
    else if (t === '--port' && tokens[i + 1]) {
      const n = Number(tokens[i + 1])
      if (Number.isFinite(n) && n > 0 && n < 65536) port = n
      i++
    } else if (/^--port=\d+$/.test(t)) {
      const n = Number(t.split('=')[1])
      if (Number.isFinite(n) && n > 0 && n < 65536) port = n
    }
  }
  return { stop, port, tunnel }
}

const renderQR = async (url: string): Promise<string> => {
  try {
    const qr: string = await qrToString(url, { type: 'utf8', errorCorrectionLevel: 'L' })
    return qr
      .split('\n')
      .filter((l: string) => l.length > 0)
      .map((l: string) => '    ' + l)
      .join('\n')
  } catch {
    return ''
  }
}

const buildBanner = async (
  handle: ShareServerHandle,
  tunnelPending: boolean,
): Promise<string> => {
  const primary = handle.shareUrl
  const qr = await renderQR(primary)
  const scope = handle.publicUrl
    ? `${MAGENTA}${BOLD}GLOBAL${RESET} ${DIM}(anywhere in the world · ${handle.tunnelProvider})${RESET}`
    : tunnelPending
      ? `${YELLOW}LAN${RESET} ${DIM}(same Wi-Fi · going global…)${RESET}`
      : `${CYAN}LAN${RESET} ${DIM}(same Wi-Fi / LAN only)${RESET}`

  const lines = [
    `${GREEN}${BOLD}● Cortex shared session${RESET}   ${DIM}scope:${RESET} ${scope}`,
    `${DIM}session id:${RESET} ${BOLD}${handle.sessionId}${RESET}  ${DIM}(rotates every CLI start — old links die automatically)${RESET}`,
    '',
    `  ${BOLD}Share this:${RESET}  ${MAGENTA}${primary}${RESET}`,
    `  ${DIM}Local:${RESET}       ${CYAN}${handle.url}${RESET}`,
    `  ${DIM}LAN:${RESET}         ${CYAN}${handle.lanUrl}${RESET}`,
    '',
    qr,
    '',
    `  ${DIM}Download QR:${RESET} ${CYAN}${handle.url}qr.png${RESET} ${DIM}·${RESET} ${CYAN}${handle.url}qr.svg${RESET}`,
    `  ${DIM}Teammate prompts tagged${RESET} ${YELLOW}[task]${RESET} ${DIM}show up in this terminal so you can pick them up.${RESET}`,
    `  ${DIM}Run${RESET} /share stop ${DIM}to end ·${RESET} /share --tunnel ${DIM}to force re-tunnel.${RESET}`,
  ]
  return lines.filter(Boolean).join('\n')
}

const attachDriverRelay = (handle: ShareServerHandle): void => {
  let participants: any[] = []
  let queue: any[] = []
  let activeUser: string | null = null

  const renderParticipantList = () => {
    if (participants.length === 0) return
    process.stderr.write(`\n${DIM}─ Participants ─${RESET}\n`)
    participants.forEach((p, i) => {
      const lastActive = p.lastActivity ? new Date(p.lastActivity).toLocaleTimeString() : 'never'
      process.stderr.write(`${DIM}  ${i + 1}.${RESET} ${BOLD}${p.name}${RESET} ${DIM}(${p.messageCount} msgs, last: ${lastActive})${RESET}\n`)
    })
  }

  const renderQueue = () => {
    if (queue.length === 0 && !activeUser) return
    process.stderr.write(`\n${DIM}─ Message Queue ─${RESET}\n`)
    if (activeUser) {
      process.stderr.write(`${DIM}  🔸 Active:${RESET} ${BOLD}${activeUser}${RESET}\n`)
    }
    if (queue.length > 0) {
      process.stderr.write(`${DIM}  📋 Queued:${RESET}\n`)
      queue.forEach((q, i) => {
        process.stderr.write(`${DIM}    ${i + 1}.${RESET} ${q.user} ${DIM}(${q.kind})${RESET}\n`)
      })
    }
  }

  handle.onMessage((m: ShareMessage) => {
    if (m.kind === 'participant_join' && m.data) {
      participants = m.data.participants || []
      process.stderr.write(`\n${GREEN}✓${RESET} ${BOLD}${m.data.participant.name}${RESET} joined the session\n`)
      renderParticipantList()
      return
    }
    if (m.kind === 'participant_leave' && m.data) {
      participants = m.data.participants || []
      const contribution = m.data.contribution || { messageCount: 0 }
      process.stderr.write(`\n${YELLOW}←${RESET} ${BOLD}${m.data.participant.name}${RESET} left the session ${DIM}(${contribution.messageCount} messages contributed)${RESET}\n`)
      renderParticipantList()
      return
    }
    if (m.kind === 'queue_update' && m.data) {
      queue = m.data.queue || []
      activeUser = m.data.active?.user || null
      renderQueue()
      return
    }
    if (m.kind === 'activity' && m.data) {
      const p = m.data.participant
      const idx = participants.findIndex((pt: any) => pt.name === p.name)
      if (idx > -1) participants[idx] = p
      // Don't spam terminal with every activity update
      return
    }
    if (m.user === 'system') return
    const tag =
      m.kind === 'task'
        ? `${YELLOW}[task]${RESET}`
        : m.kind === 'result'
          ? `${GREEN}[result]${RESET}`
          : `${CYAN}[chat]${RESET}`
    process.stderr.write(`${DIM}·${RESET} ${tag} ${BOLD}${m.user}${RESET}: ${m.text}\n`)
  })
}

/**
 * Internal hook used by the CLI bootstrap to auto-start a shared session on
 * launch. Safe to call many times — returns the existing handle if active.
 */
export async function ensureShareServer(opts: { driverName?: string } = {}): Promise<ShareServerHandle> {
  if (active) return active
  active = await startShareServer({ driverName: opts.driverName })
  attachDriverRelay(active)
  return active
}

export function getActiveShareServer(): ShareServerHandle | null {
  return active
}

export const call: LocalCommandCall = async args => {
  const { stop, port, tunnel } = parseArgs(args)

  if (stop) {
    if (!active) return { type: 'text', value: 'No shared session is running.' }
    await active.stop()
    active = null
    return { type: 'text', value: `${GREEN}✓${RESET} Shared session stopped.` }
  }

  if (!active) {
    try {
      active = await startShareServer({ port, driverName: safeUser() })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { type: 'text', value: `✗ Could not start share server: ${msg}` }
    }
    attachDriverRelay(active)
  }

  if (tunnel && !active.publicUrl) {
    // Kick it off but don't block the command return on a slow startup.
    void active.startTunnel().then((url: string | null) => {
      if (url) {
        process.stderr.write(
          `\n${MAGENTA}${BOLD}🌍 Public URL ready${RESET} ${DIM}│${RESET} ${MAGENTA}${url}${RESET}\n` +
          `${DIM}   (share with anyone in the world — HTTPS, tunneled via cloudflared)${RESET}\n`,
        )
      } else {
        process.stderr.write(
          `\n${YELLOW}⚠  cloudflared not found or failed to start.${RESET}\n` +
          `${DIM}   Install it to enable global access: ${RESET}${CYAN}brew install cloudflared${RESET}\n`,
        )
      }
    })
  }

  return { type: 'text', value: await buildBanner(active, tunnel && !active.publicUrl) }
}

const safeUser = (): string => {
  try { return userInfo().username || 'driver' } catch { return 'driver' }
}
