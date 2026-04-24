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
  kind: 'msg' | 'system' | 'task' | 'result' | 'session_ended' | 'participant_join' | 'participant_leave' | 'queue_update' | 'activity' | 'chat' | 'typing' | 'call_state'
  data?: any
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

const renderLateJoinPage = (): string => `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · You're late</title>
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
    <div class="x">⏰</div>
    <h1>You're late</h1>
    <div class="sub">
      This invite link was shared over 20 minutes ago and has expired.<br/>
      Session links are only valid for 20 minutes from when they are first shared.
    </div>
    <div class="sub">Contact the team to get a fresh invite link or QR code.</div>
  </div>
</body></html>`

const renderSessionEndedPage = (): string => `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Session completed</title>
<style>
  html,body{margin:0;height:100%;background:radial-gradient(ellipse at top,#0f1a1f,#000);color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;display:grid;place-items:center;text-align:center;padding:24px}
  .card{max-width:520px;padding:40px;background:rgba(17,21,26,0.85);border:1px solid rgba(126,231,135,0.15);border-radius:16px;backdrop-filter:blur(16px);box-shadow:0 0 40px rgba(126,231,135,0.1)}
  h1{margin:0 0 12px;font-size:22px;color:#7ee787}
  .sub{color:#8b949e;font-size:14px;line-height:1.7;margin-bottom:24px}
  .x{font-size:52px;margin-bottom:12px;animation:scale 2s ease-in-out infinite}
  @keyframes scale { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
  .check{color:#7ee787;font-size:48px;margin-bottom:8px}
</style></head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Session completed</h1>
    <div class="sub">
      The host has ended this Cortex session.<br/>
      All team members have been disconnected.
    </div>
    <div class="sub">Thank you for collaborating!</div>
  </div>
</body></html>`

const renderNameEntryPage = (sessionId: string, token: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Join Session</title>
<style>
  :root { color-scheme: dark; --accent:#7ee787; --accent2:#58a6ff; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; overflow:hidden; font-family:ui-monospace,Menlo,Consolas,monospace; color:#e6edf3; }
  body { background: radial-gradient(ellipse at 20% 10%, #0f1a1f 0%, #050607 60%, #000 100%); display:grid;place-items:center; }
  #bg { position:fixed; inset:0; z-index:0; opacity:0.55; pointer-events:none; }
  .card { position:relative; z-index:1; max-width:420px; padding:40px; background:rgba(17,21,26,0.9); border:1px solid rgba(255,255,255,0.1); border-radius:16px; backdrop-filter:blur(20px); box-shadow:0 0 60px rgba(126,231,135,0.15); text-align:center; }
  h1 { margin:0 0 8px; font-size:24px; color:var(--accent); }
  .sub { color:#8b949e; font-size:13px; line-height:1.6; margin-bottom:28px; }
  input { width:100%; background:rgba(11,13,16,0.9); color:#e6edf3; border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:14px 16px; font-size:14px; margin-bottom:16px; outline:none; transition:all 0.2s; }
  input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(126,231,135,0.2); }
  button { width:100%; border:0; border-radius:10px; padding:14px; cursor:pointer; font-weight:600; font-size:14px; letter-spacing:0.04em; transition:all 0.15s; background:linear-gradient(135deg,var(--accent),#2ea043); color:#fff; box-shadow:0 4px 14px rgba(126,231,135,0.3); }
  button:hover { box-shadow:0 6px 20px rgba(126,231,135,0.45); transform:translateY(-1px); }
  button:active { transform:translateY(0); }
  .error { color:#f85149; font-size:12px; margin-top:12px; display:none; }
  @media (max-width: 768px) { .card { margin:20px; padding:30px; } }
</style>
</head>
<body>
  <canvas id="bg"></canvas>
  <div class="card">
    <h1>👋 Join Cortex</h1>
    <div class="sub">Enter your name to join this shared session</div>
    <input id="nameInput" placeholder="Your name" maxlength="30" autofocus/>
    <button id="joinBtn">Join Session</button>
    <div class="error" id="error"></div>
  </div>
<script>
(() => {
  const TOKEN = ${JSON.stringify(token)};
  const sessionId = ${JSON.stringify(sessionId)};
  const nameInput = document.getElementById('nameInput');
  const joinBtn = document.getElementById('joinBtn');
  const error = document.getElementById('error');
  
  const join = async () => {
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Please enter your name'; error.style.display = 'block'; return; }
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    try {
      const r = await fetch('join', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ name })
      });
      if (r.ok) {
        window.location.href = 'session?name=' + encodeURIComponent(name) + '&token=' + encodeURIComponent(TOKEN);
      } else {
        error.textContent = 'Failed to join. Please try again.';
        error.style.display = 'block';
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Session';
      }
    } catch (e) {
      error.textContent = 'Connection error. Please try again.';
      error.style.display = 'block';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join Session';
    }
  };
  
  joinBtn.onclick = join;
  nameInput.onkeydown = (e) => { if (e.key === 'Enter') join(); };
  
  // Simple particle background
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const resize = () => { W = window.innerWidth; H = window.innerHeight; cv.width = W; cv.height = H; };
  resize(); window.addEventListener('resize', resize);
  const pts = Array.from({length:60}, () => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5 }));
  const draw = () => {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = 'rgba(126,231,135,0.3)';
    pts.forEach(p => { p.x += p.vx; p.y += p.vy; if(p.x<0||p.x>W)p.vx*=-1; if(p.y<0||p.y>H)p.vy*=-1; ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fill(); });
    requestAnimationFrame(draw);
  };
  draw();
})();
</script>
</body>
</html>`

const renderDashboard = (sessionId: string, token: string, createdAt: number): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Dashboard</title>
<style>
  :root { color-scheme: dark; --accent:#7ee787; --accent2:#58a6ff; --task:#bc8cff; --warn:#d29922; --danger:#f85149; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; overflow:hidden; font-family:ui-monospace,Menlo,Consolas,monospace; color:#e6edf3; }
  body { background: radial-gradient(ellipse at 20% 10%, #0f1a1f 0%, #050607 60%, #000 100%); }
  #bg { position:fixed; inset:0; z-index:0; opacity:0.55; pointer-events:none; }
  .dashboard { position:relative; z-index:1; height:100vh; display:grid; grid-template-columns:280px 1fr 320px; grid-template-rows:auto 1fr auto; gap:0; }
  
  header { grid-column:1/-1; padding:14px 20px; backdrop-filter:blur(14px); background:rgba(8,10,14,0.55); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:14px; align-items:center; }
  header .brand { display:flex; gap:10px; align-items:center; font-weight:700; font-size:14px; letter-spacing:0.04em; }
  header .dot { width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 14px var(--accent); animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { transform:scale(1.3); opacity:0.6; } }
  header .brand span.g { background:linear-gradient(90deg,var(--accent),var(--accent2),var(--task)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  header .sid { font-size:11px; color:#6e7681; letter-spacing:0.06em; margin-left:auto; }
  
  .sidebar { padding:16px; background:rgba(8,10,14,0.4); border-right:1px solid rgba(255,255,255,0.06); overflow-y:auto; }
  .sidebar h3 { margin:0 0 12px; font-size:12px; color:var(--accent); letter-spacing:0.06em; text-transform:uppercase; }
  .participant-card { background:rgba(17,21,26,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:10px; display:flex; gap:10px; align-items:center; }
  .participant-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
  .participant-info { flex:1; min-width:0; }
  .participant-name { font-weight:600; font-size:12px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .participant-status { font-size:10px; color:#8b949e; }
  .participant-status.typing { color:var(--accent); }
  .typing-indicator { display:inline-flex; gap:2px; align-items:center; }
  .typing-indicator span { width:4px; height:4px; border-radius:50%; background:var(--accent); animation:typing 1.4s ease-in-out infinite; }
  .typing-indicator span:nth-child(2) { animation-delay:0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay:0.4s; }
  @keyframes typing { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-4px); } }
  
  .main { display:grid; grid-template-rows:1fr auto; gap:0; overflow:hidden; }
  .visualization { padding:20px; overflow-y:auto; position:relative; }
  .queue-panel { background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.06); padding:12px 20px; }
  .queue-panel h3 { margin:0 0 10px; font-size:11px; color:var(--warn); letter-spacing:0.06em; text-transform:uppercase; }
  .queue-items { display:flex; gap:8px; flex-wrap:wrap; }
  .queue-item { background:rgba(210,153,34,0.15); border:1px solid rgba(210,153,34,0.3); padding:6px 12px; border-radius:6px; font-size:11px; display:flex; gap:6px; align-items:center; }
  .queue-item.active { background:rgba(126,231,135,0.15); border-color:var(--accent); }
  .queue-item .badge { width:6px; height:6px; border-radius:50%; background:var(--warn); }
  .queue-item.active .badge { background:var(--accent); }
  
  .right-panel { display:grid; grid-template-rows:auto 1fr auto; gap:0; background:rgba(8,10,14,0.4); border-left:1px solid rgba(255,255,255,0.06); }
  .call-panel { padding:16px; background:rgba(17,21,26,0.4); border-bottom:1px solid rgba(255,255,255,0.06); }
  .call-panel h3 { margin:0 0 12px; font-size:12px; color:var(--accent2); letter-spacing:0.06em; text-transform:uppercase; }
  .call-btn { width:100%; padding:10px; border:0; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px; transition:all 0.2s; }
  .call-btn.start { background:linear-gradient(135deg,var(--accent),#2ea043); color:#fff; }
  .call-btn.end { background:linear-gradient(135deg,var(--danger),#da3633); color:#fff; }
  .call-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .call-status { margin-top:10px; font-size:11px; color:#8b949e; text-align:center; }
  .call-status.active { color:var(--accent); }
  
  .chat-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .chat-messages { flex:1; overflow-y:auto; padding:12px; }
  .chat-messages::-webkit-scrollbar { width:6px; }
  .chat-messages::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
  .chat-msg { margin-bottom:8px; padding:8px 10px; background:rgba(17,21,26,0.6); border-radius:6px; font-size:12px; }
  .chat-msg .sender { font-weight:600; font-size:11px; color:var(--accent2); margin-bottom:2px; }
  .chat-msg .text { color:#e6edf3; line-height:1.4; }
  .chat-input-area { padding:12px; background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.06); }
  .chat-input { width:100%; background:rgba(11,13,16,0.8); color:#e6edf3; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:10px 12px; font-size:12px; resize:none; min-height:38px; max-height:80px; outline:none; transition:all 0.2s; }
  .chat-input:focus { border-color:var(--accent); }
  .chat-input-area button { margin-top:8px; width:100%; padding:8px; border:0; border-radius:6px; background:linear-gradient(135deg,var(--accent2),#3b82f6); color:#fff; font-weight:600; font-size:11px; cursor:pointer; }
  
  .commands-panel { padding:12px; background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.06); }
  .commands-panel h3 { margin:0 0 10px; font-size:11px; color:var(--task); letter-spacing:0.06em; text-transform:uppercase; }
  .command-msg { margin-bottom:6px; padding:6px 8px; background:rgba(188,140,255,0.1); border-left:2px solid var(--task); border-radius:4px; font-size:11px; }
  .command-msg .sender { font-weight:600; color:var(--task); }
  
  @media (max-width: 1024px) {
    .dashboard { grid-template-columns:1fr; grid-template-rows:auto auto 1fr auto; }
    .sidebar { display:none; }
    .right-panel { grid-row:2; grid-column:1; height:200px; }
    .main { grid-row:3; grid-column:1; }
  }
</style>
</head>
<body>
  <canvas id="bg"></canvas>
  <div class="dashboard">
    <header>
      <div class="brand"><span class="dot"></span>CORTEX <span class="g">Dashboard</span></div>
      <div class="sid">session · ${sessionId.slice(0, 8)}</div>
    </header>
    
    <div class="sidebar">
      <h3>Participants</h3>
      <div id="participants"></div>
    </div>
    
    <div class="main">
      <div class="visualization">
        <canvas id="viz"></canvas>
      </div>
      <div class="queue-panel">
        <h3>Message Queue</h3>
        <div class="queue-items" id="queue"></div>
      </div>
    </div>
    
    <div class="right-panel">
      <div class="call-panel">
        <h3>Voice Call</h3>
        <button id="callBtn" class="call-btn start">Start Call</button>
        <div class="call-status" id="callStatus">Not in call</div>
      </div>
      
      <div class="chat-panel">
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-area">
          <textarea id="chatInput" class="chat-input" placeholder="Type a message..."></textarea>
          <button id="sendChat">Send</button>
        </div>
      </div>
      
      <div class="commands-panel">
        <h3>Cortex Commands</h3>
        <div id="commandMessages"></div>
      </div>
    </div>
  </div>
<script>
(() => {
  const TOKEN = ${JSON.stringify(token)};
  const sessionId = ${JSON.stringify(sessionId)};
  const participantsEl = document.getElementById('participants');
  const queueEl = document.getElementById('queue');
  const chatMessages = document.getElementById('chatMessages');
  const commandMessages = document.getElementById('commandMessages');
  const chatInput = document.getElementById('chatInput');
  const callBtn = document.getElementById('callBtn');
  const callStatus = document.getElementById('callStatus');
  
  let participants = [];
  let queue = [];
  let activeUser = null;
  let inCall = false;
  let myName = 'dashboard-' + Math.random().toString(36).slice(2,6);
  let typingTimeout = null;
  
  // 3D Visualization
  const vizCanvas = document.getElementById('viz');
  const vizCtx = vizCanvas.getContext('2d');
  let vizW = 0, vizH = 0;
  const resizeViz = () => {
    const rect = vizCanvas.parentElement.getBoundingClientRect();
    vizW = rect.width; vizH = rect.height;
    vizCanvas.width = vizW; vizCanvas.height = vizH;
  };
  resizeViz();
  window.addEventListener('resize', resizeViz);
  
  const nodes = Array.from({length:8}, () => ({
    x: Math.random() * vizW, y: Math.random() * vizH,
    vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
    name: 'node-' + Math.floor(Math.random() * 1000),
    status: 'idle'
  }));
  
  const drawViz = () => {
    vizCtx.clearRect(0, 0, vizW, vizH);
    vizCtx.fillStyle = 'rgba(126, 231, 135, 0.3)';
    
    nodes.forEach(node => {
      node.x += node.vx; node.y += node.vy;
      if (node.x < 20 || node.x > vizW - 20) node.vx *= -1;
      if (node.y < 20 || node.y > vizH - 20) node.vy *= -1;
      
      vizCtx.beginPath();
      vizCtx.arc(node.x, node.y, 15, 0, Math.PI * 2);
      vizCtx.fillStyle = node.status === 'active' ? 'rgba(126, 231, 135, 0.6)' : 'rgba(88, 166, 255, 0.3)';
      vizCtx.fill();
      vizCtx.strokeStyle = node.status === 'active' ? '#7ee787' : '#58a6ff';
      vizCtx.stroke();
      
      vizCtx.fillStyle = '#e6edf3';
      vizCtx.font = '10px monospace';
      vizCtx.textAlign = 'center';
      vizCtx.fillText(node.name, node.x, node.y + 25);
    });
    
    // Draw connections
    vizCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          vizCtx.beginPath();
          vizCtx.moveTo(nodes[i].x, nodes[i].y);
          vizCtx.lineTo(nodes[j].x, nodes[j].y);
          vizCtx.stroke();
        }
      }
    }
    
    requestAnimationFrame(drawViz);
  };
  drawViz();
  
  // Background particles
  const bgCanvas = document.getElementById('bg');
  const bgCtx = bgCanvas.getContext('2d');
  let bgW = 0, bgH = 0;
  const resizeBg = () => { bgW = window.innerWidth; bgH = window.innerHeight; bgCanvas.width = bgW; bgCanvas.height = bgH; };
  resizeBg();
  window.addEventListener('resize', resizeBg);
  const pts = Array.from({length:60}, () => ({ x:Math.random()*bgW, y:Math.random()*bgH, vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5 }));
  const drawBg = () => {
    bgCtx.clearRect(0,0,bgW,bgH);
    bgCtx.fillStyle = 'rgba(126,231,135,0.3)';
    pts.forEach(p => { p.x += p.vx; p.y += p.vy; if(p.x<0||p.x>bgW)p.vx*=-1; if(p.y<0||p.y>bgH)p.vy*=-1; bgCtx.beginPath(); bgCtx.arc(p.x,p.y,2,0,Math.PI*2); bgCtx.fill(); });
    requestAnimationFrame(drawBg);
  };
  drawBg();
  
  const renderParticipants = () => {
    participantsEl.innerHTML = participants.map(p => \`
      <div class="participant-card">
        <div class="participant-avatar">\${p.name[0].toUpperCase()}</div>
        <div class="participant-info">
          <div class="participant-name">\${p.name}</div>
          <div class="participant-status \${p.isTyping ? 'typing' : ''}">
            \${p.isTyping ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : 'Active · ' + p.messageCount + ' msgs'}
          </div>
        </div>
      </div>
    \`).join('');
  };
  
  const renderQueue = () => {
    let html = '';
    if (activeUser) {
      html += \`<div class="queue-item active"><span class="badge"></span><b>\${activeUser}</b> (active)</div>\`;
    }
    queue.forEach((q, i) => {
      html += \`<div class="queue-item"><span class="badge"></span>\${i+1}. \${q.user}</div>\`;
    });
    queueEl.innerHTML = html;
  };
  
  const addChatMessage = (msg) => {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = \`<div class="sender">\${msg.user}</div><div class="text">\${msg.text}</div>\`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };
  
  const addCommandMessage = (msg) => {
    const el = document.createElement('div');
    el.className = 'command-msg';
    el.innerHTML = \`<div class="sender">\${msg.user}</div>\`;
    el.appendChild(document.createTextNode(msg.text));
    commandMessages.appendChild(el);
    commandMessages.scrollTop = commandMessages.scrollHeight;
  };
  
  const es = new EventSource('events?token=' + encodeURIComponent(TOKEN) + '&name=' + encodeURIComponent(myName));
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.kind === 'participant_join' && msg.data) {
        participants = msg.data.participants || [];
        renderParticipants();
      }
      if (msg.kind === 'participant_leave' && msg.data) {
        participants = msg.data.participants || [];
        renderParticipants();
      }
      if (msg.kind === 'queue_update' && msg.data) {
        queue = msg.data.queue || [];
        activeUser = msg.data.active?.user || null;
        renderQueue();
      }
      if (msg.kind === 'chat') {
        addChatMessage(msg);
      }
      if (msg.kind === 'typing' && msg.data) {
        const p = participants.find(pt => pt.name === msg.data.user);
        if (p) {
          p.isTyping = true;
          renderParticipants();
          setTimeout(() => { p.isTyping = false; renderParticipants(); }, 2000);
        }
      }
      if (msg.kind === 'task' || msg.kind === 'msg') {
        addCommandMessage(msg);
      }
    } catch (e) { console.error(e); }
  };
  
  const sendChat = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    await fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user: myName, text, kind: 'chat' })
    });
  };
  
  chatInput.addEventListener('input', () => {
    fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user: myName, text: '', kind: 'typing' })
    });
  });
  
  document.getElementById('sendChat').onclick = sendChat;
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  
  callBtn.onclick = () => {
    if (inCall) {
      inCall = false;
      callBtn.textContent = 'Start Call';
      callBtn.className = 'call-btn start';
      callStatus.textContent = 'Not in call';
      callStatus.classList.remove('active');
    } else {
      inCall = true;
      callBtn.textContent = 'End Call';
      callBtn.className = 'call-btn end';
      callStatus.textContent = 'In call';
      callStatus.classList.add('active');
    }
  };
})();
</script>
</body>
</html>`

const renderHostUI = (sessionId: string, token: string, createdAt: number, hostName: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Host Control</title>
<style>
  :root { color-scheme: dark; --accent:#7ee787; --accent2:#58a6ff; --task:#bc8cff; --warn:#d29922; --danger:#f85149; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; overflow:hidden; font-family:ui-monospace,Menlo,Consolas,monospace; color:#e6edf3; }
  body { background: radial-gradient(ellipse at 20% 10%, #0f1a1f 0%, #050607 60%, #000 100%); }
  #bg { position:fixed; inset:0; z-index:0; opacity:0.55; pointer-events:none; }
  .host-dashboard { position:relative; z-index:1; height:100vh; display:grid; grid-template-columns:300px 1fr 350px; grid-template-rows:auto 1fr auto; gap:0; }
  
  header { grid-column:1/-1; padding:14px 20px; backdrop-filter:blur(14px); background:rgba(8,10,14,0.55); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:14px; align-items:center; }
  header .brand { display:flex; gap:10px; align-items:center; font-weight:700; font-size:14px; letter-spacing:0.04em; }
  header .dot { width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 14px var(--accent); animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { transform:scale(1.3); opacity:0.6; } }
  header .brand span.g { background:linear-gradient(90deg,var(--accent),var(--accent2),var(--task)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  header .badge { background:var(--accent); color:#000; padding:4px 10px; border-radius:4px; font-size:11px; font-weight:700; margin-left:10px; }
  header .sid { font-size:11px; color:#6e7681; letter-spacing:0.06em; margin-left:auto; }
  
  .sidebar { padding:16px; background:rgba(8,10,14,0.4); border-right:1px solid rgba(255,255,255,0.06); overflow-y:auto; }
  .sidebar h3 { margin:0 0 12px; font-size:12px; color:var(--accent); letter-spacing:0.06em; text-transform:uppercase; }
  .participant-card { background:rgba(17,21,26,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:10px; }
  .participant-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  .participant-avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
  .participant-info { flex:1; margin-left:10px; }
  .participant-name { font-weight:600; font-size:13px; margin-bottom:2px; }
  .participant-status { font-size:10px; color:#8b949e; }
  .participant-status.typing { color:var(--accent); }
  .kick-btn { background:var(--danger); color:#fff; border:0; border-radius:4px; padding:4px 8px; font-size:10px; cursor:pointer; }
  .typing-indicator { display:inline-flex; gap:2px; align-items:center; }
  .typing-indicator span { width:4px; height:4px; border-radius:50%; background:var(--accent); animation:typing 1.4s ease-in-out infinite; }
  .typing-indicator span:nth-child(2) { animation-delay:0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay:0.4s; }
  @keyframes typing { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-4px); } }
  
  .main { display:grid; grid-template-rows:1fr auto; gap:0; overflow:hidden; }
  .visualization { padding:20px; overflow-y:auto; position:relative; }
  .queue-panel { background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.06); padding:12px 20px; }
  .queue-panel h3 { margin:0 0 10px; font-size:11px; color:var(--warn); letter-spacing:0.06em; text-transform:uppercase; }
  .queue-items { display:flex; gap:8px; flex-wrap:wrap; }
  .queue-item { background:rgba(210,153,34,0.15); border:1px solid rgba(210,153,34,0.3); padding:6px 12px; border-radius:6px; font-size:11px; display:flex; gap:6px; align-items:center; }
  .queue-item.active { background:rgba(126,231,135,0.15); border-color:var(--accent); }
  .queue-item .badge { width:6px; height:6px; border-radius:50%; background:var(--warn); }
  .queue-item.active .badge { background:var(--accent); }
  
  .right-panel { display:grid; grid-template-rows:auto 1fr 1fr auto; gap:0; background:rgba(8,10,14,0.4); border-left:1px solid rgba(255,255,255,0.06); }
  .call-panel { padding:16px; background:rgba(17,21,26,0.4); border-bottom:1px solid rgba(255,255,255,0.06); }
  .call-panel h3 { margin:0 0 12px; font-size:12px; color:var(--accent2); letter-spacing:0.06em; text-transform:uppercase; }
  .call-controls { display:flex; gap:8px; margin-bottom:10px; }
  .call-btn { flex:1; padding:10px; border:0; border-radius:8px; cursor:pointer; font-weight:600; font-size:12px; transition:all 0.2s; }
  .call-btn.start { background:linear-gradient(135deg,var(--accent),#2ea043); color:#fff; }
  .call-btn.end { background:linear-gradient(135deg,var(--danger),#da3633); color:#fff; }
  .call-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .call-status { font-size:11px; color:#8b949e; text-align:center; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px; }
  .call-status.active { color:var(--accent); }
  .call-participants { margin-top:10px; font-size:10px; color:#8b949e; }
  
  .chat-panel { display:flex; flex-direction:column; overflow:hidden; border-bottom:1px solid rgba(255,255,255,0.06); }
  .chat-header { padding:12px 16px; background:rgba(8,10,14,0.55); border-bottom:1px solid rgba(255,255,255,0.06); }
  .chat-header h3 { margin:0; font-size:11px; color:var(--accent2); letter-spacing:0.06em; text-transform:uppercase; }
  .chat-messages { flex:1; overflow-y:auto; padding:12px; }
  .chat-messages::-webkit-scrollbar { width:6px; }
  .chat-messages::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
  .chat-msg { margin-bottom:8px; padding:8px 10px; background:rgba(17,21,26,0.6); border-radius:6px; font-size:12px; }
  .chat-msg .sender { font-weight:600; font-size:11px; color:var(--accent2); margin-bottom:2px; }
  .chat-msg .text { color:#e6edf3; line-height:1.4; }
  .chat-input-area { padding:12px; background:rgba(8,10,14,0.55); border-top:1px solid rgba(255,255,255,0.06); }
  .chat-input { width:100%; background:rgba(11,13,16,0.8); color:#e6edf3; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:10px 12px; font-size:12px; resize:none; min-height:38px; max-height:80px; outline:none; transition:all 0.2s; }
  .chat-input:focus { border-color:var(--accent); }
  .chat-input-area button { margin-top:8px; width:100%; padding:8px; border:0; border-radius:6px; background:linear-gradient(135deg,var(--accent2),#3b82f6); color:#fff; font-weight:600; font-size:11px; cursor:pointer; }
  
  .commands-panel { display:flex; flex-direction:column; overflow:hidden; border-bottom:1px solid rgba(255,255,255,0.06); }
  .commands-header { padding:12px 16px; background:rgba(8,10,14,0.55); border-bottom:1px solid rgba(255,255,255,0.06); }
  .commands-header h3 { margin:0; font-size:11px; color:var(--task); letter-spacing:0.06em; text-transform:uppercase; }
  .command-messages { flex:1; overflow-y:auto; padding:12px; }
  .command-messages::-webkit-scrollbar { width:6px; }
  .command-messages::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
  .command-msg { margin-bottom:6px; padding:6px 8px; background:rgba(188,140,255,0.1); border-left:2px solid var(--task); border-radius:4px; font-size:11px; }
  .command-msg .sender { font-weight:600; color:var(--task); }
  
  .activity-log { padding:12px; background:rgba(8,10,14,0.55); max-height:250px; overflow-y:auto; font-size:10px; color:#8b949e; }
  .activity-log h3 { margin:0 0 8px; font-size:10px; color:var(--warn); letter-spacing:0.06em; text-transform:uppercase; }
  .activity-item { margin-bottom:4px; padding:6px 8px; background:rgba(0,0,0,0.3); border-radius:4px; border-left:2px solid rgba(255,255,255,0.1); }
  .activity-item.join { border-left-color:var(--accent); }
  .activity-item.leave { border-left-color:var(--danger); }
  .activity-item.chat { border-left-color:var(--accent2); }
  .activity-item.typing { border-left-color:var(--warn); }
  .activity-item.command { border-left-color:var(--task); }
  .activity-item .time { color:#6e7681; margin-right:6px; }
  .activity-item .user { color:var(--accent); font-weight:600; }
  .activity-item .action { color:#e6edf3; }
  .activity-item .detail { color:#8b949e; font-size:9px; margin-top:2px; }
  
  @media (max-width: 1024px) {
    .host-dashboard { grid-template-columns:1fr; grid-template-rows:auto auto 1fr auto; }
    .sidebar { display:none; }
    .right-panel { grid-row:2; grid-column:1; height:250px; }
    .main { grid-row:3; grid-column:1; }
  }
</style>
</head>
<body>
  <canvas id="bg"></canvas>
  <div class="host-dashboard">
    <header>
      <div class="brand"><span class="dot"></span>CORTEX <span class="g">Host Control</span></div>
      <div class="badge">HOST</div>
      <div class="sid">session · ${sessionId.slice(0, 8)}</div>
    </header>
    
    <div class="sidebar">
      <h3>Participants</h3>
      <div id="participants"></div>
    </div>
    
    <div class="main">
      <div class="visualization">
        <canvas id="viz"></canvas>
      </div>
      <div class="queue-panel">
        <h3>Message Queue</h3>
        <div class="queue-items" id="queue"></div>
      </div>
    </div>
    
    <div class="right-panel">
      <div class="call-panel">
        <h3>Voice Call</h3>
        <div class="call-controls">
          <button id="startCallBtn" class="call-btn start">Start Call</button>
          <button id="endCallBtn" class="call-btn end" disabled>End Call</button>
        </div>
        <div class="call-status" id="callStatus">Not in call</div>
        <div class="call-participants" id="callParticipants"></div>
      </div>
      
      <div class="chat-panel">
        <div class="chat-header">
          <h3>Team Chat</h3>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-area">
          <textarea id="chatInput" class="chat-input" placeholder="Type a message..."></textarea>
          <button id="sendChat">Send</button>
        </div>
      </div>
      
      <div class="commands-panel">
        <div class="commands-header">
          <h3>Cortex Commands</h3>
        </div>
        <div class="command-messages" id="commandMessages"></div>
      </div>
      
      <div class="activity-log">
        <h3>Activity Log</h3>
        <div id="activityLog"></div>
      </div>
    </div>
  </div>
<script>
(() => {
  const TOKEN = ${JSON.stringify(token)};
  const HOST_NAME = ${JSON.stringify(hostName)};
  const sessionId = ${JSON.stringify(sessionId)};
  const participantsEl = document.getElementById('participants');
  const queueEl = document.getElementById('queue');
  const chatMessages = document.getElementById('chatMessages');
  const commandMessages = document.getElementById('commandMessages');
  const activityLog = document.getElementById('activityLog');
  const chatInput = document.getElementById('chatInput');
  const startCallBtn = document.getElementById('startCallBtn');
  const endCallBtn = document.getElementById('endCallBtn');
  const callStatus = document.getElementById('callStatus');
  const callParticipants = document.getElementById('callParticipants');
  
  let participants = [];
  let queue = [];
  let activeUser = null;
  let inCall = false;
  let callParticipantsList = [];
  
  // 3D Visualization
  const vizCanvas = document.getElementById('viz');
  const vizCtx = vizCanvas.getContext('2d');
  let vizW = 0, vizH = 0;
  const resizeViz = () => {
    const rect = vizCanvas.parentElement.getBoundingClientRect();
    vizW = rect.width; vizH = rect.height;
    vizCanvas.width = vizW; vizCanvas.height = vizH;
  };
  resizeViz();
  window.addEventListener('resize', resizeViz);
  
  const nodes = Array.from({length:12}, () => ({
    x: Math.random() * vizW, y: Math.random() * vizH,
    vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
    name: 'node-' + Math.floor(Math.random() * 1000),
    status: 'idle',
    pulse: Math.random() * Math.PI * 2,
    energy: Math.random() * 0.5 + 0.5
  }));
  
  const drawViz = () => {
    vizCtx.clearRect(0, 0, vizW, vizH);
    
    // Draw connections first (behind nodes)
    vizCtx.lineWidth = 2;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220) {
          const opacity = 1 - (dist / 220);
          vizCtx.strokeStyle = \`rgba(126, 231, 135, \${opacity * 0.4})\`;
          vizCtx.shadowBlur = 10;
          vizCtx.shadowColor = '#7ee787';
          vizCtx.beginPath();
          vizCtx.moveTo(nodes[i].x, nodes[i].y);
          vizCtx.lineTo(nodes[j].x, nodes[j].y);
          vizCtx.stroke();
        }
      }
    }
    vizCtx.shadowBlur = 0;
    
    nodes.forEach(node => {
      node.x += node.vx * node.energy; node.y += node.vy * node.energy;
      node.pulse += 0.08;
      if (node.x < 30 || node.x > vizW - 30) node.vx *= -1;
      if (node.y < 30 || node.y > vizH - 30) node.vy *= -1;
      
      const pulseSize = Math.sin(node.pulse) * 8 + 25;
      const glowIntensity = Math.sin(node.pulse) * 0.3 + 0.7;
      
      // Outer glow
      vizCtx.beginPath();
      vizCtx.arc(node.x, node.y, pulseSize + 15, 0, Math.PI * 2);
      vizCtx.fillStyle = node.status === 'active' ? \`rgba(126, 231, 135, \${0.1 * glowIntensity})\` : \`rgba(88, 166, 255, \${0.08 * glowIntensity})\`;
      vizCtx.fill();
      
      // Main node
      vizCtx.beginPath();
      vizCtx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      vizCtx.fillStyle = node.status === 'active' ? \`rgba(126, 231, 135, \${0.7 * glowIntensity})\` : \`rgba(88, 166, 255, \${0.5 * glowIntensity})\`;
      vizCtx.shadowBlur = 30 * glowIntensity;
      vizCtx.shadowColor = node.status === 'active' ? '#7ee787' : '#58a6ff';
      vizCtx.fill();
      vizCtx.shadowBlur = 0;
      
      // Inner ring
      vizCtx.beginPath();
      vizCtx.arc(node.x, node.y, pulseSize - 8, 0, Math.PI * 2);
      vizCtx.strokeStyle = node.status === 'active' ? \`rgba(255, 255, 255, \${0.8 * glowIntensity})\` : \`rgba(255, 255, 255, \${0.5 * glowIntensity})\`;
      vizCtx.lineWidth = 2;
      vizCtx.stroke();
      
      // Node label
      vizCtx.fillStyle = '#e6edf3';
      vizCtx.font = '11px monospace';
      vizCtx.textAlign = 'center';
      vizCtx.fillText(node.name, node.x, node.y + pulseSize + 18);
    });
    
    requestAnimationFrame(drawViz);
  };
  drawViz();
  
  // Background particles
  const bgCanvas = document.getElementById('bg');
  const bgCtx = bgCanvas.getContext('2d');
  let bgW = 0, bgH = 0;
  const resizeBg = () => { bgW = window.innerWidth; bgH = window.innerHeight; bgCanvas.width = bgW; bgCanvas.height = bgH; };
  resizeBg();
  window.addEventListener('resize', resizeBg);
  const pts = Array.from({length:200}, () => ({ x:Math.random()*bgW, y:Math.random()*bgH, vx:(Math.random()-0.5)*1.5, vy:(Math.random()-0.5)*1.5, size:Math.random()*3+1, phase:Math.random()*Math.PI*2 }));
  const drawBg = () => {
    bgCtx.clearRect(0,0,bgW,bgH);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.phase += 0.05;
      if(p.x<0||p.x>bgW)p.vx*=-1; if(p.y<0||p.y>bgH)p.vy*=-1;
      const pulse = Math.sin(p.phase) * 0.5 + 1;
      bgCtx.beginPath();
      bgCtx.arc(p.x,p.y,p.size*pulse,0,Math.PI*2);
      bgCtx.fillStyle = \`rgba(126,231,135,\${0.2 + pulse*0.3})\`;
      bgCtx.shadowBlur = 15*pulse;
      bgCtx.shadowColor = '#7ee787';
      bgCtx.fill();
      bgCtx.shadowBlur = 0;
    });
    requestAnimationFrame(drawBg);
  };
  drawBg();
  
  const logActivity = (type, user, action, detail = '') => {
    const el = document.createElement('div');
    el.className = \`activity-item \${type}\`;
    const time = new Date().toLocaleTimeString();
    el.innerHTML = \`<span class="time">\${time}</span> <span class="user">\${user}</span> <span class="action">\${action}</span>\${detail ? \`<div class="detail">\${detail}</div>\` : ''}\`;
    activityLog.insertBefore(el, activityLog.firstChild);
    if (activityLog.children.length > 50) activityLog.removeChild(activityLog.lastChild);
  };
  
  const renderParticipants = () => {
    participantsEl.innerHTML = participants.map(p => \`
      <div class="participant-card">
        <div class="participant-header">
          <div style="display:flex;gap:10px;align-items:center;">
            <div class="participant-avatar">\${p.name[0].toUpperCase()}</div>
            <div class="participant-info">
              <div class="participant-name">\${p.name} \${p.name === HOST_NAME ? '(YOU)' : ''}</div>
              <div class="participant-status \${p.isTyping ? 'typing' : ''}">
                \${p.isTyping ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : 'Active · ' + p.messageCount + ' msgs'}
              </div>
            </div>
          </div>
          \${p.name !== HOST_NAME ? '<button class="kick-btn" onclick="kickParticipant(\'' + p.name + '\')">Kick</button>' : ''}
        </div>
      </div>
    \`).join('');
  };
  
  window.kickParticipant = (name) => {
    if (confirm('Kick ' + name + ' from the session?')) {
      fetch('send?token=' + encodeURIComponent(TOKEN), {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ user: HOST_NAME, text: 'KICK:' + name, kind: 'system' })
      });
    }
  };
  
  const renderQueue = () => {
    let html = '';
    if (activeUser) {
      html += \`<div class="queue-item active"><span class="badge"></span><b>\${activeUser}</b> (active)</div>\`;
    }
    queue.forEach((q, i) => {
      html += \`<div class="queue-item"><span class="badge"></span>\${i+1}. \${q.user}</div>\`;
    });
    queueEl.innerHTML = html;
  };
  
  const addChatMessage = (msg) => {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = \`<div class="sender">\${msg.user}</div><div class="text">\${msg.text}</div>\`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };
  
  const addCommandMessage = (msg) => {
    const el = document.createElement('div');
    el.className = 'command-msg';
    el.innerHTML = \`<div class="sender">\${msg.user}</div>\`;
    el.appendChild(document.createTextNode(msg.text));
    commandMessages.appendChild(el);
    commandMessages.scrollTop = commandMessages.scrollHeight;
  };
  
  const es = new EventSource('events?token=' + encodeURIComponent(TOKEN) + '&name=' + encodeURIComponent(HOST_NAME));
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.kind === 'participant_join' && msg.data) {
        participants = msg.data.participants || [];
        renderParticipants();
        const p = msg.data.participant;
        logActivity('join', p.name, 'joined session', \`Total participants: \${participants.length}\`);
      }
      if (msg.kind === 'participant_leave' && msg.data) {
        participants = msg.data.participants || [];
        renderParticipants();
        const p = msg.data.participant;
        logActivity('leave', p.name, 'left session', \`Contributed \${p.messageCount} messages\`);
      }
      if (msg.kind === 'queue_update' && msg.data) {
        queue = msg.data.queue || [];
        activeUser = msg.data.active?.user || null;
        renderQueue();
        if (activeUser) {
          logActivity('command', activeUser, 'is now active', \`Queue position: 0 · Queued: \${queue.length}\`);
        }
        if (queue.length > 0) {
          queue.forEach((q, i) => {
            logActivity('command', q.user, 'queued message', \`Position: \${i+1} · Kind: \${q.kind}\`);
          });
        }
      }
      if (msg.kind === 'chat') {
        addChatMessage(msg);
        logActivity('chat', msg.user, 'sent chat message', \`Length: \${msg.text.length} chars\`);
      }
      if (msg.kind === 'typing' && msg.data) {
        const p = participants.find(pt => pt.name === msg.data.user);
        if (p) {
          p.isTyping = true;
          renderParticipants();
          logActivity('typing', msg.data.user, 'is typing', \`Last active: \${new Date().toLocaleTimeString()}\`);
          setTimeout(() => { p.isTyping = false; renderParticipants(); }, 2000);
        }
      }
      if (msg.kind === 'task' || msg.kind === 'msg') {
        addCommandMessage(msg);
        logActivity('command', msg.user, \`sent \${msg.kind}\`, \`Length: \${msg.text.length} chars\`);
      }
      if (msg.kind === 'call_state') {
        logActivity('command', 'system', \`call \${msg.text}\`, msg.data?.initiator ? \`by \${msg.data.initiator}\` : '');
      }
    } catch (e) { console.error(e); }
  };
  
  const sendChat = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    await fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user: HOST_NAME, text, kind: 'chat' })
    });
  };
  
  chatInput.addEventListener('input', () => {
    fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user: HOST_NAME, text: '', kind: 'typing' })
    });
  });
  
  document.getElementById('sendChat').onclick = sendChat;
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  
  startCallBtn.onclick = () => {
    inCall = true;
    startCallBtn.disabled = true;
    endCallBtn.disabled = false;
    callStatus.textContent = 'In call - Host only';
    callStatus.classList.add('active');
    broadcast({ id: Date.now().toString(), user: 'system', kind: 'call_state', text: 'call_started', ts: Date.now(), data: { initiator: HOST_NAME } });
    logActivity('command', HOST_NAME, 'started voice call', 'Host initiated call session');
  };
  
  endCallBtn.onclick = () => {
    inCall = false;
    startCallBtn.disabled = false;
    endCallBtn.disabled = true;
    callStatus.textContent = 'Not in call';
    callStatus.classList.remove('active');
    callParticipantsList = [];
    callParticipants.textContent = '';
    broadcast({ id: Date.now().toString(), user: 'system', kind: 'call_state', text: 'call_ended', ts: Date.now() });
    logActivity('command', HOST_NAME, 'ended voice call', 'Call session terminated');
  };
  
  const broadcast = (msg) => {
    fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify(msg)
    });
  };
})();
</script>
</body>
</html>`

const renderUI = (sessionId: string, token: string, createdAt: number, userName: string): string => `<!doctype html>
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
  button:disabled { opacity:0.5; cursor:not-allowed; }
  #sendBtn { background:linear-gradient(135deg,#2ea043,#238636); color:#fff; box-shadow:0 4px 12px rgba(46,160,67,0.25); }
  #sendBtn:hover { box-shadow:0 6px 18px rgba(46,160,67,0.4); }
  #sendBtn:disabled { background:#30363d; box-shadow:none; }
  #taskBtn { background:linear-gradient(135deg,#a371f7,#8957e5); color:#fff; box-shadow:0 4px 12px rgba(163,113,247,0.25); }
  #taskBtn:hover { box-shadow:0 6px 18px rgba(163,113,247,0.4); }
  #taskBtn:disabled { background:#30363d; box-shadow:none; }
  .exit-btn { background:linear-gradient(135deg,#f85149,#da3633); color:#fff; box-shadow:0 4px 12px rgba(248,81,73,0.25); padding:6px 12px; font-size:11px; }
  .exit-btn:hover { box-shadow:0 6px 18px rgba(248,81,73,0.4); }
  .queue { padding:8px 22px; background:rgba(210,153,34,0.1); border-bottom:1px solid rgba(210,153,34,0.2); font-size:11px; color:#d29922; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .queue .queue-item { background:rgba(210,153,34,0.15); padding:4px 8px; border-radius:4px; }

  /* Mobile-specific styles */
  @media (max-width: 768px) {
    .shell { grid-template-rows:auto auto 1fr auto; }
    footer { order: 2; padding:10px 14px 12px; }
    #log { order: 3; padding:12px 14px; }
    .hint { order: 4; }
    #name { width:100px; padding:8px 10px; font-size:11px; }
    #text { min-height:36px; max-height:100px; font-size:12px; padding:8px 10px; }
    button { padding:8px 14px; font-size:11px; }
    header { padding:10px 14px; }
    header .sid { display:none; }
    header .who .dlqr { display:none; }
  }
</style>
</head>
<body>
  <canvas id="bg"></canvas>
  <div class="shell">
    <header>
      <div class="brand"><span class="dot"></span>CORTEX <span class="g">Shared Session</span></div>
      <div class="sid">session · ${sessionId.slice(0, 8)}</div>
      <div class="who">
        <span>you: <b id="whoami">${userName}</b></span>
        <button id="exitBtn" class="exit-btn">Exit</button>
        <a class="dlqr" href="qr.svg?download=1" download="cortex-share-qr.svg">⬇ QR svg</a>
        <a class="dlqr" href="qr.png?download=1" download="cortex-share-qr.png">⬇ QR png</a>
      </div>
    </header>
    <div id="queue" class="queue" style="display:none;"></div>
    <footer>
      <textarea id="text" placeholder="type a message… (Enter chat · Shift+Enter newline · Cmd/Ctrl+Enter task)"></textarea>
      <button id="sendBtn">Chat</button>
      <button id="taskBtn">▸ Task</button>
    </footer>
    <div id="log"></div>
    <div class="hint"><span class="live"><span class="d"></span>live · real-time</span> · tasks run sequentially · everyone sees every message</div>
  </div>
<script>
(() => {
  // --- enhanced animated 3D particle field --------------------------------
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

  const N = 180;
  const pts = Array.from({length:N}, () => ({
    x:(Math.random()-0.5)*2, y:(Math.random()-0.5)*2, z:Math.random()*2+0.5,
    vx:(Math.random()-0.5)*0.0006, vy:(Math.random()-0.5)*0.0006, vz:(Math.random()-0.5)*0.0015,
    phase: Math.random() * Math.PI * 2,
    size: 0.5 + Math.random() * 1.5,
  }));
  const COLORS = ['#7ee787','#58a6ff','#bc8cff','#f78166'];
  let t0 = performance.now();
  const draw = (now) => {
    const dt = Math.min(64, now - t0); t0 = now;
    ctx.clearRect(0,0,W,H);
    const cx = W/2, cy = H/2;
    const angle = now * 0.00006;
    const sA = Math.sin(angle), cA = Math.cos(angle);
    const wavePhase = now * 0.002;
    
    const proj = pts.map((p, idx) => {
      p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
      p.phase += 0.02;
      if (Math.abs(p.x)>1.3) p.vx*=-1; if (Math.abs(p.y)>1.3) p.vy*=-1;
      if (p.z<0.3||p.z>3.0) p.vz*=-1;
      
      // Add wave motion
      const wave = Math.sin(p.phase + wavePhase) * 0.05;
      const x = (p.x + wave) * cA - p.z * sA;
      const z = p.x * sA + p.z * cA;
      const f = 380/(z+1.8);
      return { sx: cx + x*f*0.85, sy: cy + (p.y + wave)*f*0.85, depth:z, r: p.size * f/200, phase: p.phase };
    });
    
    ctx.globalCompositeOperation='lighter';
    
    // Draw connections with gradient colors
    for (let i=0;i<proj.length;i++){
      const a = proj[i];
      for (let j=i+1;j<proj.length;j++){
        const b = proj[j];
        const dx=a.sx-b.sx, dy=a.sy-b.sy;
        const d = dx*dx+dy*dy;
        if (d < 12000) {
          const op = (1 - d/12000) * 0.22;
          const colorIdx = i % COLORS.length;
          ctx.strokeStyle = 'rgba(' + hexToRgb(COLORS[colorIdx]) + ',' + op.toFixed(3) + ')';
          ctx.lineWidth = 0.5 + Math.sin(a.phase + b.phase) * 0.2;
          ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke();
        }
      }
    }
    
    // Draw particles with glow effect
    for (let i=0;i<proj.length;i++){
      const p = proj[i];
      const color = COLORS[i%COLORS.length];
      const pulse = Math.sin(p.phase + wavePhase) * 0.3 + 0.7;
      const baseAlpha = Math.max(0.1, Math.min(1, 1/(p.depth+0.15)));
      
      // Outer glow
      const gradient = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, p.r * 4);
      gradient.addColorStop(0, 'rgba(' + hexToRgb(color) + ',' + (baseAlpha * 0.4 * pulse).toFixed(3) + ')');
      gradient.addColorStop(1, 'rgba(' + hexToRgb(color) + ',0)');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r * 4, 0, Math.PI*2); ctx.fill();
      
      // Core
      ctx.fillStyle = color;
      ctx.globalAlpha = baseAlpha * pulse;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(0.6, p.r * 2.4), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation='source-over';
    requestAnimationFrame(draw);
  };
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? \`\${parseInt(result[1], 16)},\${parseInt(result[2], 16)},\${parseInt(result[3], 16)}\` : '255,255,255';
  };
  
  requestAnimationFrame(draw);

  // --- session expiry check (20 min) -----------------------------------
  const SESSION_CREATED_AT = ${createdAt};
  const SESSION_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes
  const checkExpiry = () => {
    if (Date.now() - SESSION_CREATED_AT > SESSION_EXPIRY_MS) {
      document.body.innerHTML = \`<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · You're late</title>
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
    <div class="x">⏰</div>
    <h1>You're late</h1>
    <div class="sub">
      This invite link was shared over 20 minutes ago and has expired.<br/>
      Session links are only valid for 20 minutes from when they are first shared.
    </div>
    <div class="sub">Contact the team to get a fresh invite link or QR code.</div>
  </div>
</body></html>\`;
      es.close();
      return true;
    }
    return false;
  };
  if (checkExpiry()) return;

  // --- chat wire --------------------------------------------------------
  const TOKEN = ${JSON.stringify(token)};
  const USER_NAME = ${JSON.stringify(userName)};
  const log = document.getElementById('log');
  const textEl = document.getElementById('text');
  const whoami = document.getElementById('whoami');
  const queueEl = document.getElementById('queue');
  const sendBtn = document.getElementById('sendBtn');
  const taskBtn = document.getElementById('taskBtn');
  const exitBtn = document.getElementById('exitBtn');
  console.log('Exit button found:', exitBtn);
  let currentQueue: any[] = [];
  let activeUser: string | null = null;
  let myTurn = true;

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

  const es = new EventSource('events?token=' + encodeURIComponent(TOKEN) + '&name=' + encodeURIComponent(USER_NAME));
  es.onmessage = (ev) => {
    if (checkExpiry()) return;
    try { 
      const msg = JSON.parse(ev.data);
      if (msg.kind === 'session_ended') {
        document.body.innerHTML = \`<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Session completed</title>
<style>
  html,body{margin:0;height:100%;background:radial-gradient(ellipse at top,#0f1a1f,#000);color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;display:grid;place-items:center;text-align:center;padding:24px}
  .card{max-width:520px;padding:40px;background:rgba(17,21,26,0.85);border:1px solid rgba(126,231,135,0.15);border-radius:16px;backdrop-filter:blur(16px);box-shadow:0 0 40px rgba(126,231,135,0.1)}
  h1{margin:0 0 12px;font-size:22px;color:#7ee787}
  .sub{color:#8b949e;font-size:14px;line-height:1.7;margin-bottom:24px}
  .x{font-size:52px;margin-bottom:12px;animation:scale 2s ease-in-out infinite}
  @keyframes scale { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
  .check{color:#7ee787;font-size:48px;margin-bottom:8px}
</style></head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Session completed</h1>
    <div class="sub">
      The host has ended this Cortex session.<br/>
      All team members have been disconnected.
    </div>
    <div class="sub">Thank you for collaborating!</div>
  </div>
</body></html>\`;
        es.close();
        return;
      }
      if (msg.kind === 'queue_update' && msg.data) {
        currentQueue = msg.data.queue || [];
        activeUser = msg.data.active?.user || null;
        updateQueueUI();
        return;
      }
      if (msg.kind === 'participant_join') {
        render({ user:'system', kind:'system', text:msg.text, ts:msg.ts });
        return;
      }
      if (msg.kind === 'participant_leave') {
        render({ user:'system', kind:'system', text:msg.text, ts:msg.ts });
        return;
      }
      render(msg);
    } catch {}
  };
  es.onerror = () => {
    if (checkExpiry()) return;
    // EventSource auto-reconnects; on hard failure session is gone.
    render({ user:'system', kind:'system', text:'connection lost — retrying…', ts:Date.now() });
  };

  const updateQueueUI = () => {
    if (currentQueue.length > 0 || activeUser) {
      let html = '';
      if (activeUser) {
        html += '<span>🔸 Active: <b>' + activeUser + '</b></span>';
      }
      if (currentQueue.length > 0) {
        html += '<span>Queue:</span>';
        currentQueue.forEach((q, i) => {
          html += '<span class="queue-item">' + (i+1) + '. ' + q.user + '</span>';
        });
      }
      queueEl.innerHTML = html;
      queueEl.style.display = 'flex';
    } else {
      queueEl.style.display = 'none';
    }
    myTurn = !activeUser || activeUser === USER_NAME;
    sendBtn.disabled = !myTurn;
    taskBtn.disabled = !myTurn;
    textEl.placeholder = myTurn ? 'type a message… (Enter chat · Shift+Enter newline · Cmd/Ctrl+Enter task)' : 'Wait for your turn…';
  };

  const send = async (kind) => {
    if (checkExpiry()) return;
    if (!myTurn) {
      render({ user:'system', kind:'system', text:'Please wait for your turn in the queue.', ts:Date.now() });
      return;
    }
    const text = textEl.value.trim();
    if (!text) return;
    textEl.value = '';
    const r = await fetch('send?token=' + encodeURIComponent(TOKEN), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ user: USER_NAME, text, kind })
    });
    if (!r.ok) render({ user:'system', kind:'system', text:'send failed — session may have ended', ts:Date.now() });
  };

  const exit = async () => {
    console.log('Exit button clicked');
    if (checkExpiry()) return;
    if (!confirm('Are you sure you want to exit this session?')) return;
    try {
      const r = await fetch('exit', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ name: USER_NAME })
      });
      if (r.ok) {
        const data = await r.json();
        document.body.innerHTML = \`<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cortex · Session Left</title>
<style>
  html,body{margin:0;height:100%;background:radial-gradient(ellipse at top,#0f1a1f,#000);color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;display:grid;place-items:center;text-align:center;padding:24px}
  .card{max-width:520px;padding:40px;background:rgba(17,21,26,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:16px;backdrop-filter:blur(16px)}
  h1{margin:0 0 12px;font-size:22px;color:#58a6ff}
  .sub{color:#8b949e;font-size:14px;line-height:1.7;margin-bottom:24px}
  .stat{color:#7ee787;font-size:32px;margin-bottom:8px}
  .stat-label{color:#8b949e;font-size:12px;margin-bottom:24px}
  input{width:100%;background:rgba(11,13,16,0.9);color:#e6edf3;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 16px;font-size:14px;margin-bottom:16px;outline:none;}
  input:focus{border-color:#7ee787;box-shadow:0 0 0 3px rgba(126,231,135,0.2);}
  button{width:100%;border:0;border-radius:10px;padding:14px;cursor:pointer;font-weight:600;font-size:14px;letter-spacing:0.04em;background:linear-gradient(135deg,#7ee787,#2ea043);color:#fff;box-shadow:0 4px 14px rgba(126,231,135,0.3);}
  button:hover{box-shadow:0 6px 20px rgba(126,231,135,0.45);}
</style></head>
<body>
  <div class="card">
    <h1>👋 You left the session</h1>
    <div class="stat">\${data.contribution.messageCount}</div>
    <div class="stat-label">messages contributed</div>
    <div class="sub">Thank you for your contribution to this Cortex session!</div>
    <input id="rejoinName" placeholder="Enter your name to rejoin" value="\${USER_NAME}" maxlength="30"/>
    <button id="rejoinBtn">Rejoin Session</button>
  </div>
<script>
(() => {
  const sessionId = ${JSON.stringify(sessionId)};
  const token = ${JSON.stringify(token)};
  const rejoinName = document.getElementById('rejoinName');
  const rejoinBtn = document.getElementById('rejoinBtn');
  rejoinBtn.onclick = () => {
    const name = rejoinName.value.trim();
    if (name) window.location.href = 'session?name=' + encodeURIComponent(name) + '&token=' + encodeURIComponent(token);
  };
})();
</script>
</body></html>\`;
        es.close();
      }
    } catch (e) {
      render({ user:'system', kind:'system', text:'Failed to exit session.', ts:Date.now() });
    }
  };

  sendBtn.onclick = () => send('msg');
  taskBtn.onclick = () => send('task');
  exitBtn.onclick = exit;
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send('task'); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send('msg'); }
  });
})();
</script>
</body>
</html>`

type Client = { id: string; res: http.ServerResponse; name?: string; joinedAt: number }
type Participant = { name: string; joinedAt: number; messageCount: number; lastActivity: number }
type QueuedMessage = { id: string; user: string; text: string; kind: ShareMessage['kind']; queuedAt: number }

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
  const sessionCreatedAt = Date.now()
  const SESSION_EXPIRY_MS = 20 * 60 * 1000 // 20 minutes
  const transcript: ShareMessage[] = []
  const clients = new Set<Client>()
  const listeners = new Set<(m: ShareMessage) => void>()
  const participants: Map<string, Participant> = new Map() // name -> Participant
  const participantOrder: string[] = [] // names in join order
  const messageQueue: QueuedMessage[] = []
  let activeMessage: ShareMessage | null = null
  let publicUrl: string | null = null
  let tunnelProvider: TunnelProvider = 'none'
  let tunnelProc: ChildProcess | null = null
  let sessionEnded = false

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

  const addParticipant = (name: string) => {
    if (!participants.has(name)) {
      const p: Participant = { name, joinedAt: Date.now(), messageCount: 0, lastActivity: Date.now() }
      participants.set(name, p)
      participantOrder.push(name)
      broadcast({ id: randomUUID(), user: 'system', kind: 'participant_join', text: `${name} joined the session`, ts: Date.now(), data: { participant: p, participants: Array.from(participants.values()), order: participantOrder } })
    }
  }

  const removeParticipant = (name: string) => {
    if (participants.has(name)) {
      const p = participants.get(name)!
      participants.delete(name)
      const idx = participantOrder.indexOf(name)
      if (idx > -1) participantOrder.splice(idx, 1)
      broadcast({ id: randomUUID(), user: 'system', kind: 'participant_leave', text: `${name} left the session`, ts: Date.now(), data: { participant: p, participants: Array.from(participants.values()), order: participantOrder, contribution: { messageCount: p.messageCount } } })
    }
  }

  const updateParticipantActivity = (name: string) => {
    const p = participants.get(name)
    if (p) {
      p.lastActivity = Date.now()
      broadcast({ id: randomUUID(), user: 'system', kind: 'activity', text: '', ts: Date.now(), data: { participant: p } })
    }
  }

  const processQueue = () => {
    if (activeMessage || messageQueue.length === 0) return
    const next = messageQueue.shift()!
    activeMessage = { id: next.id, user: next.user, text: next.text, ts: Date.now(), kind: next.kind }
    broadcast(activeMessage)
    broadcast({ id: randomUUID(), user: 'system', kind: 'queue_update', text: '', ts: Date.now(), data: { queue: messageQueue, active: activeMessage } })
  }

  const completeActiveMessage = () => {
    if (activeMessage) {
      const p = participants.get(activeMessage.user)
      if (p) p.messageCount++
      activeMessage = null
      processQueue()
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
      // Check 20-minute expiry
      if (Date.now() - sessionCreatedAt > SESSION_EXPIRY_MS) {
        res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
        res.end(renderLateJoinPage())
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderNameEntryPage(sessionId, token))
      return
    }

    if (rel === 'join') {
      // Check 20-minute expiry
      if (Date.now() - sessionCreatedAt > SESSION_EXPIRY_MS) {
        res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
        res.end(renderLateJoinPage())
        return
      }
      let body = ''
      req.on('data', c => { body += c; if (body.length > 1000) req.destroy() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}') as { name?: string }
          const name = (data.name ?? '').toString().slice(0, 30).trim() || 'guest'
          addParticipant(name)
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ success: true, name, participants: Array.from(participants.values()), order: participantOrder }))
        } catch {
          res.writeHead(400); res.end('bad')
        }
      })
      return
    }

    if (rel === 'session') {
      // Check 20-minute expiry
      if (Date.now() - sessionCreatedAt > SESSION_EXPIRY_MS) {
        res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
        res.end(renderLateJoinPage())
        return
      }
      const name = url.searchParams.get('name') || 'guest'
      // Track participant when they load the session page
      addParticipant(name)
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderUI(sessionId, token, sessionCreatedAt, name))
      return
    }

    if (rel === 'dashboard') {
      // Check 20-minute expiry
      if (Date.now() - sessionCreatedAt > SESSION_EXPIRY_MS) {
        res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
        res.end(renderLateJoinPage())
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderDashboard(sessionId, token, sessionCreatedAt))
      return
    }

    if (rel === 'host') {
      // Check 20-minute expiry
      if (Date.now() - sessionCreatedAt > SESSION_EXPIRY_MS) {
        res.writeHead(410, { 'content-type': 'text/html; charset=utf-8' })
        res.end(renderLateJoinPage())
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(renderHostUI(sessionId, token, sessionCreatedAt, opts.driverName || 'driver'))
      return
    }

    if (rel === 'exit') {
      let body = ''
      req.on('data', c => { body += c; if (body.length > 1000) req.destroy() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}') as { name?: string }
          const name = (data.name ?? '').toString().trim()
          if (name) {
            const p = participants.get(name)
            removeParticipant(name)
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ success: true, contribution: p ? { messageCount: p.messageCount } : { messageCount: 0 } }))
          } else {
            res.writeHead(400); res.end('bad')
          }
        } catch {
          res.writeHead(400); res.end('bad')
        }
      })
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
      const clientName = url.searchParams.get('name') || 'guest'
      // Track participant when they connect via SSE
      addParticipant(clientName)
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
      const client: Client = { id: randomUUID(), res, name: clientName, joinedAt: Date.now() }
      clients.add(client)
      const keepalive = setInterval(() => {
        try { res.write(': ping\n\n') } catch { /* ignore */ }
      }, 20000)
      req.on('close', () => {
        clearInterval(keepalive)
        clients.delete(client)
        // Remove participant when they disconnect
        if (client.name) removeParticipant(client.name)
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
          const user = (data.user ?? 'guest').toString().slice(0, 40).trim() || 'guest'
          const kind = (data.kind === 'task' ? 'task' : data.kind === 'chat' ? 'chat' : data.kind === 'typing' ? 'typing' : 'msg') as ShareMessage['kind']
          
          // Add participant if not exists
          addParticipant(user)
          updateParticipantActivity(user)
          
          // Chat and typing messages bypass queue, Cortex commands go through queue
          if (kind === 'chat' || kind === 'typing') {
            broadcast({ id: randomUUID(), user, text, ts: Date.now(), kind, data: { user } })
            res.writeHead(200); res.end('ok')
            return
          }
          
          // Non-host Cortex messages go through queue, host messages go directly
          const isHost = user === opts.driverName || user === 'driver'
          if (isHost) {
            broadcast({ id: randomUUID(), user, text, ts: Date.now(), kind })
            completeActiveMessage()
          } else {
            // Queue the message
            const queued: QueuedMessage = { id: randomUUID(), user, text, kind, queuedAt: Date.now() }
            messageQueue.push(queued)
            broadcast({ id: randomUUID(), user: 'system', kind: 'queue_update', text: '', ts: Date.now(), data: { queue: messageQueue, active: activeMessage } })
            processQueue()
          }
          
          res.writeHead(200); res.end('ok')
        } catch {
          res.writeHead(400); res.end('bad')
        }
      })
      return
    }

    if (rel === 'complete' && req.method === 'POST') {
      if (auth !== token) { res.writeHead(401); res.end('bad token'); return }
      completeActiveMessage()
      res.writeHead(200); res.end('ok')
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
      if (sessionEnded) { resolve(); return }
      sessionEnded = true
      // Send session ended message to all clients
      broadcast({ id: randomUUID(), user: 'system', kind: 'session_ended' as ShareMessage['kind'], text: '', ts: Date.now() })
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
