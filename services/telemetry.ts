import { execFile } from "child_process";
import { Client, version as discordJsVersion } from "discord.js";
import { BotEvent as BotEventModel } from "../models/BotEvent";
import { GuildData, isRedisAvailable, setBotStatus, syncBotGuildsWithData } from "../shared/services/redis";
import type { BotEvent, ErrorScope, IBotHeartbeat } from "../shared/types";
import { DatabaseService } from "./database";
import { DiscordPlayerService } from "./discordPlayer";
import { PatreonService } from "./patreon";
import { errorMessage } from "./telemetry/events";
import { buildHeartbeat, cpuPercent } from "./telemetry/heartbeat";

const HEARTBEAT_MS = 20_000;

/** Snapshot of guild data the dashboard reads from Redis (`bot:guild:<id>`). */
export function collectGuildData(client: Client): GuildData[] {
  return client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    memberCount: g.memberCount,
    ownerId: g.ownerId,
    joinedAt: g.joinedTimestamp || Date.now()
  }));
}

function readVersion(candidates: string[]): string {
  for (const c of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const v = require(c)?.version;
      if (typeof v === "string") return v;
    } catch {
      // try next candidate
    }
  }
  return "unknown";
}

/**
 * TelemetryService — heartbeat to Redis every 20 s and fire-and-forget event
 * writes to Mongo. Never throws into bot code paths.
 */
export class TelemetryService {
  private static instance: TelemetryService;
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly startedAt = new Date();
  private lastCpu = process.cpuUsage();
  private lastTick = Date.now();
  private ytDlpVersion: string | null = null;
  private lastError: IBotHeartbeat["lastError"];
  private lastRecordFailureLog = 0;
  private readonly botVersion = readVersion(["../package.json", "../../package.json"]);
  private readonly discordPlayerVersion = readVersion(["discord-player/package.json"]);

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!this.instance) this.instance = new TelemetryService();
    return this.instance;
  }

  public start(client: Client): void {
    this.client = client;
    void this.resolveYtDlpVersion();
    void this.tick();
    this.timer = setInterval(() => void this.tick(), HEARTBEAT_MS);
    this.timer.unref?.();
    console.log("[Telemetry] ✅ Heartbeat started");
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Remember the last error so the next heartbeat surfaces it. */
  public noteError(scope: ErrorScope, error: unknown): void {
    this.lastError = {
      ts: new Date().toISOString(),
      scope,
      message: (errorMessage(error) ?? "Unknown error").slice(0, 200)
    };
  }

  /** Fire-and-forget event write. Drops silently when Mongo is not ready. */
  public record(event: BotEvent): void {
    if (!DatabaseService.getInstance().isReady()) return;
    BotEventModel.create(event).then(
      () => undefined,
      (err: unknown) => {
        const now = Date.now();
        if (now - this.lastRecordFailureLog > 60_000) {
          this.lastRecordFailureLog = now;
          console.error("[Telemetry] Event write failed:", errorMessage(err));
        }
      }
    );
  }

  /** Re-publish guild data and a heartbeat (used by the dashboard `admin_resync` action). */
  public async resyncNow(): Promise<{ guilds: number }> {
    if (!this.client) throw new Error("Telemetry not started");
    const guilds = collectGuildData(this.client);
    await syncBotGuildsWithData(guilds);
    await this.tick();
    return { guilds: guilds.length };
  }

  public async tick(): Promise<void> {
    const client = this.client;
    if (!client?.user) return;
    try {
      if (!(await isRedisAvailable())) return;
      const now = Date.now();
      const cpu = process.cpuUsage();
      const pct = cpuPercent(this.lastCpu, cpu, now - this.lastTick);
      this.lastCpu = cpu;
      this.lastTick = now;
      const mem = process.memoryUsage();
      const hb = buildHeartbeat({
        id: client.user.id,
        username: client.user.username,
        avatar: client.user.avatar,
        startedAt: this.startedAt,
        now: new Date(now),
        guildCount: client.guilds.cache.size,
        memberCount: client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0),
        wsPing: client.ws.ping,
        wsStatus: client.ws.status,
        queues: this.queueStats(),
        memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
        cpuPercent: pct,
        node: process.version,
        platform: process.platform,
        pid: process.pid,
        versions: {
          bot: this.botVersion,
          discordJs: discordJsVersion,
          discordPlayer: this.discordPlayerVersion,
          ytDlp: this.ytDlpVersion
        },
        services: {
          mongo: DatabaseService.getInstance().isReady(),
          patreon: PatreonService.getInstance().isConfigured(),
          debugPanel: !!process.env.DEBUG_TOKEN
        },
        lastError: this.lastError
      });
      await setBotStatus(hb);
    } catch (error) {
      console.error("[Telemetry] Heartbeat failed:", errorMessage(error));
    }
  }

  private queueStats(): IBotHeartbeat["queues"] {
    const stats = { total: 0, playing: 0, paused: 0, voiceConnections: 0 };
    const player = DiscordPlayerService.getInstance().getPlayer();
    if (!player) return stats;
    for (const q of player.nodes.cache.values()) {
      if (!q || q.deleted) continue;
      stats.total++;
      if (q.node.isPlaying()) stats.playing++;
      if (q.node.isPaused()) stats.paused++;
      if (q.connection) stats.voiceConnections++;
    }
    return stats;
  }

  private resolveYtDlpVersion(): Promise<void> {
    return new Promise((resolve) => {
      execFile("yt-dlp", ["--version"], { timeout: 10_000 }, (err, stdout) => {
        this.ytDlpVersion = err ? null : String(stdout).trim() || null;
        resolve();
      });
    });
  }
}
