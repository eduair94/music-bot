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
      const online = this.client?.isReady() ?? false;
      res.status(online ? 200 : 503).json({
        bot: {
          username: this.client?.user?.username ?? "unknown",
          guilds: this.client?.guilds.cache.size ?? 0,
          online,
          wsStatus: this.client?.ws.status ?? -1,
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

    // ── Self-test (loopback only) ──────────────────────────
    // Drives the real play pipeline without a user, for verifying a deploy:
    //   docker exec music-bot node -e "fetch('http://127.0.0.1:9090/api/selftest?token=…&action=play&guild=…&voice=…&text=…&query=…',{method:'POST'}).then(r=>r.text()).then(console.log)"
    this.app.post("/api/selftest", async (req: Request, res: Response) => {
      const ip = req.socket.remoteAddress ?? "";
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
        res.status(403).json({ error: "loopback only" });
        return;
      }
      try {
        res.json(await this.selfTest(req.query as Record<string, string>));
      } catch (error) {
        res.status(500).json({ error: (error as Error)?.message ?? String(error) });
      }
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
  /**
   * action=play|state|stop|skip|radio|aiplaylist; guild, voice, text, query, autoplay=1.
   * radio: station=<id> | prompt=<text> | query=<song>. aiplaylist: prompt, count.
   */
  private async selfTest(q: Record<string, string>): Promise<unknown> {
    const { DiscordPlayerService } = await import("./discordPlayer");
    const service = DiscordPlayerService.getInstance();
    const guild = this.client?.guilds.cache.get(q.guild);
    if (!guild) throw new Error("unknown guild");
    const queue = () => service.getQueue(guild.id);

    const state = () => {
      const current = queue();
      const meta = (current?.metadata || {}) as any;
      const voice = guild.members.me?.voice.channel;
      return {
        connected: Boolean(voice),
        voiceChannel: voice?.name ?? null,
        voiceStatus: (voice as any)?.status ?? null,
        playing: current?.node.isPlaying() ?? false,
        position: current?.node.getTimestamp()?.current.label ?? null,
        current: current?.currentTrack ? `${current.currentTrack.title} — ${current.currentTrack.author}` : null,
        requestedBy: current?.currentTrack?.requestedBy?.username ?? null,
        upNext: current?.tracks.toArray().slice(0, 3).map((t) => `${t.title}${(t.metadata as any)?.aiRadio ? " [ai]" : (t.metadata as any)?.autoplay ? " [autoplay]" : ""}`) ?? [],
        queued: current?.tracks.size ?? 0,
        autoplay: Boolean(meta.autoplay),
        radio: meta.radio
          ? { kind: meta.radio.kind, label: meta.radio.label, anchors: meta.radio.anchorIds?.length ?? 0, picks: meta.radio.picks, batches: `${meta.radio.batches}/${meta.radio.batchLimit}` }
          : null,
        stay247: Boolean(meta.stay247),
        volume: current?.node.volume ?? null
      };
    };

    if (q.action === "state") return state();
    if (q.action === "stop") {
      queue()?.delete();
      return { stopped: true };
    }
    if (q.action === "skip") {
      queue()?.node.skip();
      return { skipped: true };
    }
    if (q.action === "play") {
      const voice = guild.channels.cache.get(q.voice);
      const text = guild.channels.cache.get(q.text);
      if (!voice?.isVoiceBased() || !text?.isTextBased()) throw new Error("voice/text channel not found");
      const result = await service.play(voice, q.query || "never gonna give you up", text as any, 128, 25, {
        requestedBy: this.client!.user
      });
      if (result && q.autoplay === "1") {
        const meta = (result.queue.metadata || {}) as any;
        meta.autoplay = true;
        result.queue.metadata = meta;
        const { ensureAutoplayNext } = await import("./autoplay");
        void ensureAutoplayNext(result.queue);
      }
      return { started: result?.track.title ?? null, added: result?.added, queuePosition: result?.position, ...state() };
    }
    if (q.action === "radio" || q.action === "aiplaylist") {
      const voice = guild.channels.cache.get(q.voice);
      const text = guild.channels.cache.get(q.text);
      if (!voice?.isVoiceBased() || !text?.isTextBased()) throw new Error("voice/text channel not found");
      const radio = await import("./radio");
      const { generatePlaylist, songLine } = await import("./ai/playlistGenerator");
      const me = this.client!.user;

      let first: string;
      let request: import("./radio").RadioRequest | null = null;
      let rest: { artist: string; title: string }[] = [];
      let ai: { title: string; description: string; tracks: number } | null = null;
      if (q.prompt) {
        const playlist = await generatePlaylist({
          prompt: q.prompt,
          count: q.action === "aiplaylist" ? Math.min(50, Number(q.count) || 10) : 10,
          language: q.lang || "en",
          feature: q.action === "aiplaylist" ? "ai_playlist" : "ai_radio"
        });
        ai = { title: playlist.title, description: playlist.description, tracks: playlist.tracks.length };
        first = songLine(playlist.tracks[0]);
        rest = playlist.tracks.slice(1);
        if (q.action === "radio") request = { kind: "ai", label: q.prompt, prompt: q.prompt, pending: rest, batchLimit: Number(q.batches) || 3, language: q.lang || "en" };
      } else if (q.station && radio.isStationId(q.station)) {
        const [seed, ...more] = radio.shuffledSeeds(q.station);
        first = seed;
        request = { kind: "station", label: q.station, anchorQueries: more };
      } else {
        first = q.query || "never gonna give you up";
        request = { kind: "song", label: first };
      }

      const result = await service.play(voice, first, text as any, 128, 25, { requestedBy: me });
      if (!result) throw new Error("nothing played");
      if (request) {
        radio.startRadio(result.queue, request, result.track, me);
        const { ensureAutoplayNext } = await import("./autoplay");
        void ensureAutoplayNext(result.queue);
      } else {
        // aiplaylist: the rest of the songs, matched on YouTube when they play.
        const tracks = rest.map((song) => radio.aiQueueTrack(song, me)).filter((t): t is NonNullable<typeof t> => t !== null);
        for (const t of tracks) t.setMetadata({});
        if (tracks.length) result.queue.addTrack(tracks);
      }
      return { started: result.track.title, ai, ...state() };
    }
    throw new Error("unknown action");
  }

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
      badge("Online",d.bot.online?"yes":"no"),
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
