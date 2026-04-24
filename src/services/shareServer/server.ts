import http from 'node:http'
import { randomUUID, randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
// @ts-expect-error - qrcode ships without bundled types in this repo
import * as QRCode from 'qrcode'

export type ShareMessage = {
  id: string
  user: string
  text: string
  ts: number
  kind: 'msg' | 'system' | 'task' | 'result'
}

export type TunnelProvider = 'cloudflared' | 'localhost.run' | 'serveo' | 'none'

export type ShareServerHandle = {
  /** Local loopback URL (http://127.0.0.1:port/s/<sid>/) */
  url: string
  /** LAN URL (http://<lan-ip>:port/s/<sid>/) — same Wi-Fi only */
  lanUrl: string
  /** Public HTTPS URL once a tunnel is up; null until then */
  publicUrl: string | null
  /** Which tunnel provider won the race */
  tunnelProvider: TunnelProvider
  port: number
  sessionId: string
  /** Opaque token used by joiner UIs to authenticate SSE + POST */
  token: string
  /** Best shareable URL: public if available, else LAN */
  get shareUrl(): string
  stop: () => Promise<void>
  broadcast: (msg: ShareMessage) => void
  getTranscript: () => ShareMessage[]
  onMessage: (cb: (msg: ShareMessage) => void) => () => void
  /** Kicks off tunnel startup (tries cloudflared → localhost.run → serveo). Resolves with URL or null. */
  startTunnel: () => Promise<string | null>
}

const MAX_TRANSCRIPT = 500

const getLanIP = (): string => {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

const hasBinary = (name: string): boolean => {
  try {
    const r = spawnSync('which', [name], { encoding: 'utf8' })
    return r.status === 0 && !!r.stdout.trim()
  } catch {
    return false
  }
}

const renderWrongSessionPage = (): string => `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Session expired</title>
<style>
  html,body{margin:0;height:100%;background:radial-gradient(ellipse at top,#1a0f20,#000);color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;display:grid;place-items:center;text-align:center;padding:24px}
  .card{max-width:520px;padding:32px;background:rgba(17,21,26,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:14px;backdrop-filter:blur(14px)}
  h1{margin:0 0 10px;font-size:20px;color:#d29922}
  .sub{color:#8b949e;font-size:13px;line-height:1.6;margin-bottom:18px}
  .x{font-size:42px;margin-bottom:8px}
  code{background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:4px;color:#58a6ff}
</style></head>
<body>
  <div class="card">
    <div class="x">🔒</div>
    <h1>This link is no longer valid</h1>
    <div class="sub">
      The Cortex session this invite was for has ended, or the host restarted their CLI.<br/>
      Each Cortex session gets its own unique link — old ones stop working the moment the host closes their terminal.
    </div>
    <div class="sub">Ask the host to run <code>/share</code> and share their new QR code or URL.</div>
  </div>
</body></html>`

const renderUI = (sessionId: string, token: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Shared Session</title>
<style>
  :root { color-scheme: dark; --accent:#7ee787; --accent2:#58a6ff; --task:#bc8cff; --warn:#d29922; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; overflow:hidden; font-family:ui-monospace,Menlo,Consolas,monospace; color:#e6edf3; }
  body { background: radial-gradient(ellipse at 20% 10%, #0f1a1f 0%, #050607 60%, #000 100%); }
  #bg { position:fixed; inset:0; z-index:0; opacity:0.55; pointer-events:none; }
  .shell { position:relative; z-index:1; height:100vh; display:grid; grid-template-rows:auto 1fr auto auto; }
  header { padding:14px 20px; backdrop-filter: blur(14px); background:rgba(8,10,14,0.55); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  header .brand { display:flex; gap:10px; align-items:center; font-weight:700; font-size:14px; letter-spacing:0.04em; }
  header .dot { width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 14px var(--accent); animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { transform:scale(1.3); opacity:0.6; } }
  header .brand span.g { background:linear-gradient(90deg,var(--accent),var(--accent2),var(--task)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  header .sid { font-size:11px; color:#6e7681; letter-spacing:0.06em; }
  header .who { margin-left:auto; font-size:12px; color:#8b949e; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  header .who b { color:var(--accent2); }
  header .who .dlqr { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#e6edf3; padding:6px 12px; border-radius:6px; cursor:pointer; font:inherit; font-size:11px; text-decoration:none; transition:all 0.2s; }
  header .who .dlqr:hover { background:rgba(126,231,135,0.15); border-color:var(--accent); }

  #log { overflow-y:auto; padding:18px 22px 4px; scroll-behavior:smooth; }
  #log::-webkit-scrollbar { width:8px; } #log::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px; }
  .msg { margin-bottom:12px; padding:11px 14px; background:rgba(17,21,26,0.78); border:1px solid rgba(255,255,255,0.06); border-left:3px solid #30363d; border-radius:8px; backdrop-filter:blur(6px); animation:in 0.35s cubic-bezier(0.2,0.8,0.2,1); transform-origin:left center; }
  @keyframes in { from { opacity:0; transform:translateY(6px) scale(0.98); } }
  .msg .meta { font-size:11px; color:#8b949e; margin-bottom:4px; letter-spacing:0.02em; }
  .msg .meta .u { font-weight:700; }
  .msg .body { white-space:pre-wrap; word-break:break-word; font-size:13px; line-height:1.55; }
  .msg.msg .meta .u { color:var(--accent2); }
  .msg.system { border-left-color:var(--warn); background:linear-gradient(90deg,rgba(210,153,34,0.08),rgba(17,21,26,0.78)); }
  .msg.system .meta .u { color:var(--warn); }
  .msg.task { border-left-color:var(--task); background:linear-gradient(90deg,rgba(188,140,255,0.1),rgba(17,21,26,0.78)); box-shadow:0 0 24px rgba(188,140,255,0.08); }
  .msg.task .meta .u { color:var(--task); }
  .msg.task .meta::before { content:'▸ TASK · '; color:var(--task); font-weight:700; }
  .msg.result { border-left-color:var(--accent); }
  .msg.result .meta .u { color:var(--accent); }

  .hint { font-size:11px; color:#6e7681; padding:6px 22px; background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.04); display:flex; gap:8px; align-items:center; }
  .hint .live { display:inline-flex; gap:6px; align-items:center; }
  .hint .live .d { width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 10px var(--accent); animation:pulse 1.6s ease-in-out infinite; }
  footer { padding:12px 20px 16px; background:rgba(8,10,14,0.75); backdrop-filter:blur(14px); border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:10px; align-items:flex-end; }
  input, button, textarea { font:inherit; outline:none; }
  #name { width:150px; background:rgba(11,13,16,0.8); color:#e6edf3; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:10px 12px; font-size:12px; transition:all 0.2s; }
  #name:focus { border-color:var(--accent2); box-shadow:0 0 0 3px rgba(88,166,255,0.18); }
  #text { flex:1; background:rgba(11,13,16,0.8); color:#e6edf3; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:10px 12px; resize:none; min-height:42px; max-height:140px; font-size:13px; line-height:1.5; transition:all 0.2s; }
  #text:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(126,231,135,0.16); }
  button { border:0; border-radius:8px; padding:10px 18px; cursor:pointer; font-weight:600; font-size:12px; letter-spacing:0.04em; transition:all 0.15s; }
  button:active { transform:scale(0.97); }
  #sendBtn { background:linear-gradient(135deg,#2ea043,#238636); color:#fff; box-shadow:0 4px 12px rgba(46,160,67,0.25); }
  #sendBtn:hover { box-shadow:0 6px 18px rgba(46,160,67,0.4); }
  #taskBtn { background:linear-gradient(135deg,#a371f7,#8957e5); color:#fff; box-shadow:0 4px 12px rgba(163,113,247,0.25); }
  #taskBtn:hover { box-shadow:0 6px 18px rgba(163,113,247,0.4); }
</style>
</head>
<body>
  <canvas id="bg"></canvas>
  <div class="shell">
    <header>
      <div class="brand"><span class="dot"></span>CORTEX <span class="g">Shared Session</span></div>
      <div class="sid">session · ${sessionId.slice(0, 8)}</div>
      <div class="who">
        <span>you: <b id="whoami">…</b></span>
        <a class="dlqr" href="qr.svg?download=1" download="cortex-share-qr.svg">⬇ QR svg</a>
        <a class="dlqr" href="qr.png?download=1" download="cortex-share-qr.png">⬇ QR png</a>
      </div>
    </header>
    <div id="log"></div>
    <div class="hint"><span class="live"><span class="d"></span>live · real-time</span> · tasks run sequentially · everyone sees every message</div>
    <footer>
      <input id="name" placeholder="your name" />
      <textarea id="text" placeholder="type a message… (Enter chat · Shift+Enter newline · Cmd/Ctrl+Enter task)"></textarea>
      <button id="sendBtn">Chat</button>
      <button id="taskBtn">▸ Task</button>
    </footer>
  </div>
<script>
(() => {
  // --- animated 3D-ish particle field -----------------------------------
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize(); window.addEventListener('resize', resize);

  const N = 140;
  const pts = Array.from({length:N}, () => ({
    x:(Math.random()-0.5)*2, y:(Math.random()-0.5)*2, z:Math.random()*2+0.5,
    vx:(Math.random()-0.5)*0.0008, vy:(Math.random()-0.5)*0.0008, vz:(Math.random()-0.5)*0.002,
  }));
  const COLORS = ['#7ee787','#58a6ff','#bc8cff'];
  let t0 = performance.now();
  const draw = (now) => {
    const dt = Math.min(64, now - t0); t0 = now;
    ctx.clearRect(0,0,W,H);
    const cx = W/2, cy = H/2;
    const angle = now * 0.00008;
    const sA = Math.sin(angle), cA = Math.cos(angle);
    const proj = pts.map(p => {
      p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
      if (Math.abs(p.x)>1.2) p.vx*=-1; if (Math.abs(p.y)>1.2) p.vy*=-1;
      if (p.z<0.4||p.z>2.8) p.vz*=-1;
      const x = p.x*cA - p.z*sA;
      const z = p.x*sA + p.z*cA;
      const f = 320/(z+1.5);
      return { sx: cx + x*f*0.9, sy: cy + p.y*f*0.9, depth:z, r: 1.6*f/200 };
    });
    ctx.globalCompositeOperation='lighter';
    for (let i=0;i<proj.length;i++){
      const a = proj[i];
      for (let j=i+1;j<proj.length;j++){
        const b = proj[j];
        const dx=a.sx-b.sx, dy=a.sy-b.sy;
        const d = dx*dx+dy*dy;
        if (d < 14000) {
          const op = (1 - d/14000) * 0.18;
          ctx.strokeStyle = 'rgba(126,231,135,' + op.toFixed(3) + ')';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke();
        }
      }
    }
    for (let i=0;i<proj.length;i++){
      const p = proj[i];
      const color = COLORS[i%3];
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.max(0.15, Math.min(1, 1/(p.depth+0.2)));
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(0.7, p.r*2.6), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation='source-over';
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  // --- chat wire --------------------------------------------------------
  const TOKEN = ${JSON.stringify(token)};
  const log = document.getElementById('log');
  const nameEl = document.getElementById('name');
  const textEl = document.getElementById('text');
  const whoami = document.getElementById('whoami');
  const storedName = localStorage.getItem('cortex-share-name') || ('guest-' + Math.random().toString(36).slice(2,6));
  nameEl.value = storedName;
  whoami.textContent = storedName;
  nameEl.addEventListener('change', () => {
    localStorage.setItem('cortex-share-name', nameEl.value || 'guest');
    whoami.textContent = nameEl.value || 'guest';
  });

  const render = (m) => {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.kind || 'msg');
    const time = new Date(m.ts).toLocaleTimeString();
    el.innerHTML = '<div class="meta"><span class="u"></span> · <span class="t"></span></div><div class="body"></div>';
    el.querySelector('.u').textContent = m.user;
    el.querySelector('.t').textContent = time;
    el.querySelector('.body').textContent = m.text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };

  const es = new EventSource('events?token=' + encodeURIComponent(TOKEN));
  es.onmessage = (ev) => {
    try { render(JSON.parse(ev.data)); } catch {}
  };
  es.onerror = () => {
    // EventSource auto-reconnects; on hard failure session is gone.
    render({ user:'system', kind:'system', text:'connection lost — retrying…', ts:Date.now() });
  };

  const send = async (kind) => {
    const text = textEl.value.trim();
    if (!text) return;
    const user = nameEl.value.trim() || 'guest';
    textEl.value = '';
    const r = await fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user, text, kind })
    });
    if (!r.ok) render({ user:'system', kind:'system', text:'send failed — session may have ended', ts:Date.now() });
  };

  document.getElementById('sendBtn').onclick = () => send('msg');
  document.getElementById('taskBtn').onclick = () => send('task');
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send('task'); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send('msg'); }
  });
})();
</script>
</body>
</html>`

type Client = { id: string; res: http.ServerResponse }

export async function startShareServer(opts: {
  port?: number
  host?: string
  driverName?: string
} = {}): Promise<ShareServerHandle> {
  const host = opts.host ?? '0.0.0.0'
  const startPort = opts.port ?? 9977
  // Session ID appears in every URL; rotates on every CLI start so old invites die.
  const sessionId = randomBytes(6).toString('hex')
  const token = randomUUID().split('-')[0]
  const transcript: ShareMessage[] = []
  const clients = new Set<Client>()
  const listeners = new Set<(m: ShareMessage) => void>()
  let publicUrl: string | null = null
  let tunnelProvider: TunnelProvider = 'none'
  let tunnelProc: ChildProcess | null = null

  const sessionPath = `/s/${sessionId}/`

  const pushTranscript = (m: ShareMessage) => {
    transcript.push(m)
    if (transcript.length > MAX_TRANSCRIPT) transcript.shift()
  }

  const broadcast = (m: ShareMessage) => {
    pushTranscript(m)
    const data = `data: ${JSON.stringify(m)}\n\n`
    for (const c of clients) {
      try { c.res.write(data) } catch { /* drop */ }
    }
    for (const l of listeners) {
      try { l(m) } catch { /* ignore */ }
    }
  }

  const currentShareUrl = (): string => {
    if (publicUrl) return `${publicUrl.replace(/\/+$/, '')}${sessionPath}`
    return `http://${getLanIP()}:${port}${sessionPath}`
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const p = url.pathname

    // Root and bare /s/ → the wrong-session page so old bookmarks get a clear message.
    if (p === '/' || p === '/s' || p === '/s/') {
      res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderWrongSessionPage())
      return
    }

    // All valid routes live under /s/<sessionId>/...
    if (!p.startsWith(`/s/${sessionId}/`) && p !== `/s/${sessionId}`) {
      res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderWrongSessionPage())
      return
    }

    const rel = p.slice(`/s/${sessionId}/`.length) || ''
    const auth = url.searchParams.get('token')

    if (rel === '' || rel === 'index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderUI(sessionId, token))
      return
    }

    if (rel === 'qr.svg' || rel === 'qr.png') {
      const targetUrl = currentShareUrl()
      const download = url.searchParams.get('download') === '1'
      const fmt = rel.endsWith('.png') ? 'png' : 'svg'
      const headers: Record<string, string> = {
        'cache-control': 'no-store',
        'content-type': fmt === 'png' ? 'image/png' : 'image/svg+xml',
      }
      if (download) headers['content-disposition'] = `attachment; filename="cortex-share-qr.${fmt}"`

      if (fmt === 'svg') {
        ;(QRCode.toString as (t: string, o: unknown) => Promise<string>)(targetUrl, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 2,
          color: { dark: '#0b0d10', light: '#ffffff' },
        })
          .then(svg => { res.writeHead(200, headers); res.end(svg) })
          .catch(() => { res.writeHead(500); res.end('qr error') })
      } else {
        ;(QRCode.toBuffer as (t: string, o: unknown) => Promise<Buffer>)(targetUrl, {
          type: 'png',
          errorCorrectionLevel: 'M',
          margin: 2,
          scale: 10,
          color: { dark: '#0b0d10', light: '#ffffff' },
        })
          .then(buf => { res.writeHead(200, headers); res.end(buf) })
          .catch(() => { res.writeHead(500); res.end('qr error') })
      }
      return
    }

    if (rel === 'events') {
      if (auth !== token) { res.writeHead(401); res.end('bad token'); return }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      res.write(': ok\n\n')
      for (const m of transcript.slice(-50)) {
        res.write(`data: ${JSON.stringify(m)}\n\n`)
      }
      const client: Client = { id: randomUUID(), res }
      clients.add(client)
      const keepalive = setInterval(() => {
        try { res.write(': ping\n\n') } catch { /* ignore */ }
      }, 20000)
      req.on('close', () => {
        clearInterval(keepalive)
        clients.delete(client)
      })
      return
    }

    if (rel === 'send' && req.method === 'POST') {
      if (auth !== token) { res.writeHead(401); res.end('bad token'); return }
      let body = ''
      req.on('data', c => { body += c; if (body.length > 64_000) req.destroy() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}') as { user?: string; text?: string; kind?: string }
          const text = (data.text ?? '').toString().slice(0, 8000).trim()
          if (!text) { res.writeHead(400); res.end('empty'); return }
          const user = (data.user ?? 'guest').toString().slice(0, 40).trim() || 'guest'
          const kind = (data.kind === 'task' ? 'task' : 'msg') as ShareMessage['kind']
          broadcast({ id: randomUUID(), user, text, ts: Date.now(), kind })
          res.writeHead(200); res.end('ok')
        } catch {
          res.writeHead(400); res.end('bad')
        }
      })
      return
    }

    res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
    res.end(renderWrongSessionPage())
  })

  const tryListen = (p: number, attempts = 10): Promise<number> =>
    new Promise((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.removeListener('listening', onListening)
        if (err.code === 'EADDRINUSE' && attempts > 0) {
          resolve(tryListen(p + 1, attempts - 1))
        } else reject(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        resolve(p)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(p, host)
    })

  const port = await tryListen(startPort)
  const lanIP = getLanIP()
  const url = `http://127.0.0.1:${port}${sessionPath}`
  const lanUrl = `http://${lanIP}:${port}${sessionPath}`

  const driver = opts.driverName ?? 'driver'
  broadcast({
    id: randomUUID(),
    user: 'system',
    kind: 'system',
    text: `Session opened by ${driver}. Share this URL to invite others.`,
    ts: Date.now(),
  })

  // --- Tunnel orchestration: try cloudflared → localhost.run → serveo ---
  const spawnCloudflared = (): Promise<string | null> =>
    new Promise(resolve => {
      if (!hasBinary('cloudflared')) return resolve(null)
      let settled = false
      const finish = (u: string | null) => { if (settled) return; settled = true; resolve(u) }
      let proc: ChildProcess
      try {
        proc = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch { return resolve(null) }
      tunnelProc = proc
      const rx = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
      const onData = (buf: Buffer) => {
        const m = buf.toString().match(rx)
        if (m) { tunnelProvider = 'cloudflared'; finish(m[0]) }
      }
      proc.stdout?.on('data', onData)
      proc.stderr?.on('data', onData)
      proc.on('error', () => finish(null))
      proc.on('exit', () => { if (tunnelProc === proc) tunnelProc = null; finish(null) })
      setTimeout(() => finish(null), 20_000)
    })

  const spawnSshTunnel = (hostName: 'localhost.run' | 'serveo'): Promise<string | null> =>
    new Promise(resolve => {
      if (!hasBinary('ssh')) return resolve(null)
      let settled = false
      const finish = (u: string | null) => { if (settled) return; settled = true; resolve(u) }
      let proc: ChildProcess
      const sshArgs = hostName === 'localhost.run'
        ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ServerAliveInterval=30', '-R', `80:localhost:${port}`, 'nokey@localhost.run']
        : ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ServerAliveInterval=30', '-R', `80:localhost:${port}`, 'serveo.net']
      try {
        proc = spawn('ssh', sshArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch { return resolve(null) }
      tunnelProc = proc
      const rx = hostName === 'localhost.run'
        ? /https:\/\/[a-z0-9-]+\.lhr\.life/i
        : /https?:\/\/[a-z0-9-]+\.serveo\.net/i
      const onData = (buf: Buffer) => {
        const m = buf.toString().match(rx)
        if (m) { tunnelProvider = hostName; finish(m[0]) }
      }
      proc.stdout?.on('data', onData)
      proc.stderr?.on('data', onData)
      proc.on('error', () => finish(null))
      proc.on('exit', () => { if (tunnelProc === proc) tunnelProc = null; finish(null) })
      setTimeout(() => finish(null), 15_000)
    })

  const startTunnel = async (): Promise<string | null> => {
    if (publicUrl) return publicUrl
    // 1. cloudflared (most reliable, HTTPS, no signup)
    const cf = await spawnCloudflared()
    if (cf) { publicUrl = cf; return cf }
    // 2. localhost.run (SSH-only, HTTPS, no signup, no install)
    const lhr = await spawnSshTunnel('localhost.run')
    if (lhr) { publicUrl = lhr; return lhr }
    // 3. serveo (SSH-only, no install — flakier)
    const sv = await spawnSshTunnel('serveo')
    if (sv) { publicUrl = sv; return sv }
    return null
  }

  const handle = {
    url,
    lanUrl,
    port,
    sessionId,
    token,
    broadcast,
    getTranscript: () => [...transcript],
    onMessage: (cb: (m: ShareMessage) => void) => { listeners.add(cb); return () => listeners.delete(cb) },
    startTunnel,
    get publicUrl(): string | null { return publicUrl },
    get tunnelProvider(): TunnelProvider { return tunnelProvider },
    get shareUrl(): string { return currentShareUrl() },
    stop: () => new Promise<void>(resolve => {
      for (const c of clients) { try { c.res.end() } catch { /* ignore */ } }
      clients.clear()
      if (tunnelProc && !tunnelProc.killed) {
        try { tunnelProc.kill() } catch { /* ignore */ }
      }
      server.close(() => resolve())
    }),
  } as ShareServerHandle

  return handle
}
