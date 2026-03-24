/**
 * DebugPanel – Secret lightweight web UI for live log viewing.
 *
 * Starts a tiny Express server (default port 9090) that is
 * protected by a secret token set in DEBUG_TOKEN env var.
 *
 * Routes:
 *   GET /                    → HTML live-log viewer (auto-refreshes)
 *   GET /api/logs            → JSON log entries (query params: last, level, search)
 *   GET /api/status          → JSON bot health / stats
 *   POST /api/logs/clear     → Clear log buffer
 *
 * All routes require ?token=<DEBUG_TOKEN> query parameter.
 */

import { Client } from "discord.js";
import express, { NextFunction, Request, Response } from "express";
import { logBuffer, LogLevel } from "./logBuffer";

const DEFAULT_PORT = 9090;

export class DebugPanel {
  private static instance: DebugPanel;
  private app = express();
  private server: any = null;
  private client: Client | null = null;
  private token: string;
  private port: number;
  private startedAt = new Date();

  private constructor() {
    this.token = process.env.DEBUG_TOKEN || "";
    this.port = parseInt(process.env.DEBUG_PORT || "") || DEFAULT_PORT;
  }

  public static getInstance(): DebugPanel {
    if (!this.instance) this.instance = new DebugPanel();
    return this.instance;
  }

  /** Call once the Discord client is ready */
  public start(client: Client): void {
    if (!this.token) {
      console.log("[DebugPanel] ⚠️ DEBUG_TOKEN not set – debug panel disabled");
      return;
    }

    this.client = client;

    // ── Auth middleware ─────────────────────────────────────
    const auth = (req: Request, res: Response, next: NextFunction): void => {
      if (req.query.token !== this.token) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    };

    this.app.use(auth);

    // ── JSON API ───────────────────────────────────────────
    this.app.get("/api/logs", (_req: Request, res: Response) => {
      const last = parseInt(_req.query.last as string) || 200;
      const level = _req.query.level as LogLevel | undefined;
      const search = _req.query.search as string | undefined;
      res.json(logBuffer.getEntries({ last, level, search }));
    });

    this.app.post("/api/logs/clear", (_req: Request, res: Response) => {
      logBuffer.clear();
      res.json({ ok: true });
    });

    this.app.get("/api/status", (_req: Request, res: Response) => {
      const mem = process.memoryUsage();
      res.json({
        bot: {
          username: this.client?.user?.username ?? "unknown",
          guilds: this.client?.guilds.cache.size ?? 0,
          uptime: process.uptime(),
          startedAt: this.startedAt.toISOString(),
        },
        memory: {
          rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
        },
        logs: {
          buffered: logBuffer.size,
        },
        node: process.version,
        platform: process.platform,
      });
    });

    // ── HTML UI ────────────────────────────────────────────
    this.app.get("/", (req: Request, res: Response) => {
      res.type("html").send(this.renderHTML(this.token));
    });

    // ── Start server ───────────────────────────────────────
    this.server = this.app.listen(this.port, () => {
      console.log(`[DebugPanel] 🔒 Debug panel running on port ${this.port}`);
    });
  }

  public stop(): void {
    this.server?.close();
  }

  // ── Self-contained HTML page ─────────────────────────────
  private renderHTML(token: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>🔧 Bot Debug Panel</title>
<style>
  :root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#c9d1d9;--muted:#8b949e;--accent:#58a6ff;--red:#f85149;--orange:#d29922;--green:#3fb950}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'SF Mono','Cascadia Code','Consolas',monospace;font-size:13px;padding:16px}
  h1{font-size:18px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .status-bar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .badge{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px}
  .badge .val{color:var(--accent);font-weight:600}
  .controls{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
  .controls input,.controls select,.controls button{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px;font-family:inherit}
  .controls input{flex:1;min-width:200px}
  .controls button{cursor:pointer;font-weight:600}
  .controls button:hover{border-color:var(--accent)}
  .controls button.danger{border-color:var(--red)}
  .controls button.danger:hover{background:var(--red);color:#fff}
  #logContainer{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px;overflow-y:auto;height:calc(100vh - 180px);scroll-behavior:smooth}
  .entry{padding:2px 6px;border-radius:3px;white-space:pre-wrap;word-break:break-all;line-height:1.5}
  .entry:hover{background:rgba(255,255,255,.04)}
  .entry .ts{color:var(--muted);margin-right:6px}
  .entry .lvl{font-weight:700;margin-right:6px;min-width:42px;display:inline-block}
  .entry .lvl.error{color:var(--red)}
  .entry .lvl.warn{color:var(--orange)}
  .entry .lvl.info,.entry .lvl.log{color:var(--green)}
  .entry .lvl.debug{color:var(--muted)}
  .live-dot{width:8px;height:8px;background:var(--green);border-radius:50%;display:inline-block;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .paused .live-dot{background:var(--orange);animation:none}
  #autoScroll{accent-color:var(--accent)}
</style>
</head>
<body>
<h1><span class="live-dot" id="liveDot"></span> Bot Debug Panel</h1>

<div class="status-bar" id="statusBar">loading…</div>

<div class="controls">
  <input type="text" id="search" placeholder="🔍 Filter logs…"/>
  <select id="level">
    <option value="">All levels</option>
    <option value="log">log</option>
    <option value="info">info</option>
    <option value="warn">warn</option>
    <option value="error">error</option>
    <option value="debug">debug</option>
  </select>
  <label><input type="checkbox" id="autoScroll" checked/> Auto-scroll</label>
  <label><input type="checkbox" id="liveToggle" checked/> Live</label>
  <button class="danger" id="clearBtn">Clear</button>
</div>

<div id="logContainer"></div>

<script>
const TOKEN="${token}";
const API="/api";
let live=true,lastTs="";

const $=id=>document.getElementById(id);
const container=$("logContainer");

// ── Fetch status ───────────────────────────────────────
async function fetchStatus(){
  try{
    const r=await fetch(API+"/status?token="+TOKEN);
    const d=await r.json();
    const up=Math.floor(d.bot.uptime);
    const h=Math.floor(up/3600),m=Math.floor((up%3600)/60),s=up%60;
    $("statusBar").innerHTML=[
      badge("Bot",d.bot.username),
      badge("Guilds",d.bot.guilds),
      badge("Uptime",h+"h "+m+"m "+s+"s"),
      badge("Mem",d.memory.rss),
      badge("Heap",d.memory.heapUsed),
      badge("Logs",d.logs.buffered),
      badge("Node",d.node),
    ].join("");
  }catch(e){$("statusBar").textContent="⚠️ Failed to fetch status";}
}
function badge(k,v){return '<span class="badge">'+k+': <span class="val">'+v+'</span></span>';}

// ── Fetch logs ─────────────────────────────────────────
async function fetchLogs(){
  if(!live)return;
  const level=$("level").value;
  const search=$("search").value;
  let url=API+"/logs?token="+TOKEN+"&last=500";
  if(level)url+="&level="+level;
  if(search)url+="&search="+encodeURIComponent(search);
  try{
    const r=await fetch(url);
    const entries=await r.json();
    renderLogs(entries);
  }catch(e){}
}

function renderLogs(entries){
  container.innerHTML=entries.map(e=>{
    const ts='<span class="ts">'+e.ts.replace("T"," ").substring(0,19)+'</span>';
    const lvl='<span class="lvl '+e.level+'">'+e.level.toUpperCase().padEnd(5)+'</span>';
    const msg=escHtml(e.message);
    return '<div class="entry">'+ts+lvl+msg+'</div>';
  }).join("");
  if($("autoScroll").checked){
    container.scrollTop=container.scrollHeight;
  }
}

function escHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

// ── Events ─────────────────────────────────────────────
$("clearBtn").onclick=async()=>{
  await fetch(API+"/logs/clear?token="+TOKEN,{method:"POST"});
  container.innerHTML="";
};
$("liveToggle").onchange=function(){
  live=this.checked;
  document.body.classList.toggle("paused",!live);
};
$("search").oninput=fetchLogs;
$("level").onchange=fetchLogs;

// ── Polling loop ───────────────────────────────────────
setInterval(fetchLogs,2000);
setInterval(fetchStatus,5000);
fetchStatus();
fetchLogs();
</script>
</body>
</html>`;
  }
}
