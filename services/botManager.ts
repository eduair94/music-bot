import { ChildProcess, fork } from "child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { BotStatus, ILinkedBot, LinkedBot } from "../models/LinkedBot";
import { PatreonUser } from "../models/PatreonUser";
import { linkedBotAllowance } from "../shared/types";
import type { LinkedBotMessage } from "../structs/Bot";
import { config } from "../utils/config";

/**
 * Premium users' private bots.
 *
 * A private bot is the full Bypass bot running on the user's own Discord
 * application: the primary forks `index.js` once per bot with that bot's
 * token and LINKED_BOT_ID set (utils/instance.ts `isLinked`), so it has every
 * command, the player card, Hi-Fi audio and 24/7, but none of Bypass's
 * global state. This service decides which bots run, starts and stops them,
 * restarts them after a crash, and stops them when their owner's Premium
 * ends.
 *
 * Desired state lives in the LinkedBot `status`: "online" and "starting" are
 * meant to run and start again when the primary restarts; "stopped" (the owner
 * or the Premium sweep stopped it), "error" (it cannot run) and "offline"
 * (linked, never started) stay down.
 */

interface BotProcess {
  child: ChildProcess;
  botId: string;
  name: string;
  startedAt: number;
  /** Set when we asked it to stop, so its exit isn't treated as a crash. */
  stopping: boolean;
  /** Last error it reported before exiting (bad token, login refused, …). */
  lastError: string | null;
  /** Songs already added to totalSongsPlayed from this process's reports. */
  songsReported: number;
}

/** Errors a restart cannot fix: the owner has to act (new token, other application). */
const FATAL_ERRORS = [/rejected the bot token/i, /login failed/i, /belongs to a Bypass bot/i, /disallowed intents/i, /invalid token/i];

const RESTART_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESTARTS = 5;
const STOP_GRACE_MS = 12_000;
const SWEEP_MS = 30 * 60 * 1000;

/** Env vars a private bot must not inherit: other bots' tokens and Bypass-only secrets. */
const PRIVATE_ENV = [/^TOKEN_\d+$/, /^BOT_ENCRYPTION_KEY$/, /^DEBUG_TOKEN$/, /PATREON/i, /WEBHOOK/i, /^BOT_INSTANCE$/];

/** Each private bot is a full bot process (~150-250 MB); cap them per host. */
function maxRunning(): number {
  const n = Number(process.env.LINKED_BOTS_MAX);
  return Number.isInteger(n) && n >= 0 ? n : 5;
}

/** The entry point a child runs: dist/index.js in production, index.ts under ts-node. */
function entryPoint(): { file: string; execArgv: string[] } {
  const heap = ["--max-old-space-size=384"];
  const js = path.join(__dirname, "..", "index.js");
  if (existsSync(js)) return { file: js, execArgv: heap };
  return { file: path.join(__dirname, "..", "index.ts"), execArgv: [...heap, "-r", "ts-node/register"] };
}

export class BotManagerService {
  private static instance: BotManagerService;
  private readonly running = new Map<string, BotProcess>();
  private readonly restarts = new Map<string, number[]>();
  private readonly encryptionKey: Uint8Array | null;
  private initialized = false;
  private sweepTimer: NodeJS.Timeout | null = null;

  private constructor() {
    const keyHex = config.BOT_ENCRYPTION_KEY || process.env.BOT_ENCRYPTION_KEY || "";
    // Without the dashboard's key no stored token can be read; refuse to start bots rather than guess.
    this.encryptionKey = /^[0-9a-f]{64}$/i.test(keyHex) ? new Uint8Array(Buffer.from(keyHex, "hex")) : null;
    if (!this.encryptionKey) console.warn("[BotManager] ⚠️ BOT_ENCRYPTION_KEY is missing or not 64 hex characters; private bots are disabled");
  }

  public static getInstance(): BotManagerService {
    if (!this.instance) this.instance = new BotManagerService();
    return this.instance;
  }

  /** Start every bot that should be running (after a restart or deploy). */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.encryptionKey) return;

    const wanted = await LinkedBot.find({ status: { $in: ["online", "starting"] } }).sort({ createdAt: 1 }).lean<ILinkedBot[]>();
    for (const bot of wanted) {
      const result = await this.startBot(bot.botId);
      if (!result.success) console.warn(`[BotManager] ${bot.botUsername} not started: ${result.error}`);
    }
    this.sweepTimer = setInterval(() => void this.sweepEntitlements().catch((e) => console.error("[BotManager] Sweep failed:", e)), SWEEP_MS);
    this.sweepTimer.unref();
    console.log(`[BotManager] ✅ ${this.running.size} private bot(s) running`);
  }

  // ------------------------------------------------------------- tokens

  /** AES-256-CBC with BOT_ENCRYPTION_KEY, the same scheme the dashboard writes. */
  public encryptToken(token: string): { encryptedToken: string; tokenIv: string } {
    if (!this.encryptionKey) throw new Error("BOT_ENCRYPTION_KEY is not configured");
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", this.encryptionKey, new Uint8Array(iv));
    const encryptedToken = cipher.update(token, "utf8", "hex") + cipher.final("hex");
    return { encryptedToken, tokenIv: iv.toString("hex") };
  }

  public decryptToken(encryptedToken: string, tokenIv: string): string {
    if (!this.encryptionKey) throw new Error("BOT_ENCRYPTION_KEY is not configured");
    const decipher = createDecipheriv("aes-256-cbc", this.encryptionKey, new Uint8Array(Buffer.from(tokenIv, "hex")));
    return decipher.update(encryptedToken, "hex", "utf8") + decipher.final("utf8");
  }

  // -------------------------------------------------------- entitlement

  /** How many private bots `ownerId` may run right now. */
  public async allowance(ownerId: string): Promise<number> {
    const isOwner = Boolean(config.OWNER_ID) && config.OWNER_ID === ownerId;
    if (isOwner) return linkedBotAllowance(null, true);
    const patron = await PatreonUser.findOne({ discordId: ownerId }, { isPremium: 1, pledgeAmountCents: 1 }).lean();
    return linkedBotAllowance(patron as { isPremium: boolean; pledgeAmountCents: number } | null);
  }

  /** The owner's oldest bots fill the allowance; is this one among them? */
  private async entitled(bot: ILinkedBot): Promise<boolean> {
    const allowance = await this.allowance(bot.ownerId);
    if (allowance <= 0) return false;
    const mine = await LinkedBot.find({ ownerId: bot.ownerId }, { botId: 1 }).sort({ createdAt: 1 }).lean();
    const position = mine.findIndex((b) => b.botId === bot.botId);
    return position >= 0 && position < allowance;
  }

  /** Stop the bots whose owner no longer has Premium (or dropped to a smaller tier). */
  private async sweepEntitlements(): Promise<void> {
    for (const botId of [...this.running.keys()]) {
      const bot = await LinkedBot.findOne({ botId }).lean<ILinkedBot>();
      if (!bot) {
        await this.stopBot(botId, "stopped");
        continue;
      }
      if (!(await this.entitled(bot))) {
        await this.stopBot(botId, "stopped", "Premium membership ended; renew it to start this bot again");
      }
    }
  }

  // ----------------------------------------------------------- lifecycle

  private async setStatus(botId: string, status: BotStatus, extra: Partial<ILinkedBot> = {}): Promise<void> {
    await LinkedBot.updateOne({ botId }, { status, lastStatusChange: new Date(), ...extra }).catch((error) =>
      console.error(`[BotManager] Could not save status for ${botId}:`, (error as Error).message)
    );
  }

  public async startBot(botId: string): Promise<{ success: boolean; error?: string }> {
    if (this.running.has(botId)) return { success: true };
    if (!this.encryptionKey) return { success: false, error: "Private bots are not configured on this server" };

    const bot = await LinkedBot.findOne({ botId }).lean<ILinkedBot>();
    if (!bot) return { success: false, error: "Bot not found" };

    if (!(await this.entitled(bot))) {
      const error = "Private bots need an active Premium membership";
      await this.setStatus(botId, "stopped", { lastError: error, processId: null });
      return { success: false, error };
    }
    if (this.running.size >= maxRunning()) {
      const error = "Every private-bot slot on this server is in use right now; try again later";
      await this.setStatus(botId, "error", { lastError: error, processId: null });
      return { success: false, error };
    }

    let token: string;
    try {
      token = this.decryptToken(bot.encryptedToken, bot.tokenIv);
    } catch {
      const error = "The saved token can't be read; link the bot again";
      await this.setStatus(botId, "error", { lastError: error, processId: null });
      return { success: false, error };
    }

    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!PRIVATE_ENV.some((pattern) => pattern.test(key))) env[key] = value;
    }
    Object.assign(env, {
      TOKEN: token,
      LINKED_BOT_ID: bot.botId,
      LINKED_BOT_NAME: bot.botUsername,
      LINKED_OWNER_ID: bot.ownerId,
      LINKED_ALLOWED_GUILDS: (bot.allowedGuilds ?? []).join(",")
    });

    const { file, execArgv } = entryPoint();
    const child = fork(file, [], { env, execArgv, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    const entry: BotProcess = { child, botId, name: bot.botUsername, startedAt: Date.now(), stopping: false, lastError: null, songsReported: 0 };
    this.running.set(botId, entry);
    await this.setStatus(botId, "starting", { processId: child.pid ? String(child.pid) : null, lastError: null });

    // Its logs join the primary's, tagged with the bot's name (tokens are never logged).
    const tag = `[Private ${bot.botUsername}]`;
    const pipe = (stream: NodeJS.ReadableStream | null, write: (line: string) => void) => {
      let buffer = "";
      stream?.setEncoding("utf8");
      stream?.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) write(`${tag} ${line}`);
      });
    };
    pipe(child.stdout, (line) => console.log(line));
    pipe(child.stderr, (line) => console.error(line));

    child.on("message", (message: LinkedBotMessage) => void this.onMessage(entry, message));
    child.on("exit", (code, signal) => void this.onExit(entry, code, signal));
    child.on("error", (error) => {
      entry.lastError = error.message;
      console.error(`${tag} process error:`, error.message);
    });

    console.log(`[BotManager] ▶️ Starting private bot ${bot.botUsername} (${botId})`);
    return { success: true };
  }

  private async onMessage(entry: BotProcess, message: LinkedBotMessage): Promise<void> {
    if (!message || typeof message !== "object") return;
    if (message.type === "error") {
      entry.lastError = String(message.error).slice(0, 300);
      await this.setStatus(entry.botId, "error", { lastError: entry.lastError });
      return;
    }
    const update: Partial<ILinkedBot> = { totalGuilds: message.guilds };
    if (message.botUsername) update.botUsername = message.botUsername;
    if (message.botAvatar !== undefined) update.botAvatar = message.botAvatar;
    // The child counts songs since it started; add what's new since its last report.
    const songs = Math.max(0, (message.songsPlayed ?? entry.songsReported) - entry.songsReported);
    entry.songsReported += songs;
    if (message.type === "ready") {
      await this.setStatus(entry.botId, "online", { ...update, lastError: null });
      console.log(`[BotManager] ✅ Private bot ${entry.name} online in ${message.guilds} server(s)`);
    } else {
      await LinkedBot.updateOne({ botId: entry.botId }, update).catch(() => undefined);
    }
    if (songs > 0) await LinkedBot.updateOne({ botId: entry.botId }, { $inc: { totalSongsPlayed: songs } }).catch(() => undefined);
  }

  private async onExit(entry: BotProcess, code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    if (this.running.get(entry.botId) === entry) this.running.delete(entry.botId);
    if (entry.stopping) return;

    const fatal = entry.lastError && FATAL_ERRORS.some((pattern) => pattern.test(entry.lastError!));
    console.warn(`[BotManager] ⚠️ Private bot ${entry.name} exited (code ${code}, signal ${signal})${entry.lastError ? `: ${entry.lastError}` : ""}`);
    if (fatal) {
      await this.setStatus(entry.botId, "error", { lastError: entry.lastError, processId: null });
      return;
    }

    // Crashes restart, unless it keeps crashing.
    const now = Date.now();
    const recent = (this.restarts.get(entry.botId) ?? []).filter((t) => now - t < RESTART_WINDOW_MS);
    if (recent.length >= MAX_RESTARTS) {
      await this.setStatus(entry.botId, "error", {
        lastError: entry.lastError ?? "It crashed several times in a row; start it again from the dashboard",
        processId: null
      });
      return;
    }
    recent.push(now);
    this.restarts.set(entry.botId, recent);
    await this.setStatus(entry.botId, "starting", { processId: null });
    setTimeout(() => void this.startBot(entry.botId), Math.min(60_000, 2_000 * 2 ** recent.length)).unref();
  }

  /**
   * Stop a bot. `status` is what it should stay as: "stopped" (owner or
   * sweep) or "offline" (only the process ends, e.g. the primary shutting
   * down, so it starts again afterwards).
   */
  public async stopBot(botId: string, status: BotStatus = "stopped", lastError: string | null = null): Promise<{ success: boolean; error?: string }> {
    const entry = this.running.get(botId);
    if (status !== "offline") await this.setStatus(botId, status, { processId: null, lastError });
    if (!entry) return { success: true };

    entry.stopping = true;
    const exited = new Promise<void>((resolve) => entry.child.once("exit", () => resolve()));
    try {
      // index.ts shuts down cleanly (leaves voice, clears statuses) on this message.
      entry.child.send("shutdown");
    } catch {
      entry.child.kill("SIGTERM");
    }
    const timer = setTimeout(() => entry.child.kill("SIGKILL"), STOP_GRACE_MS);
    await exited;
    clearTimeout(timer);
    this.running.delete(botId);
    console.log(`[BotManager] ⏹️ Private bot ${entry.name} stopped`);
    return { success: true };
  }

  public async restartBot(botId: string): Promise<{ success: boolean; error?: string }> {
    await this.stopBot(botId, "offline");
    this.restarts.delete(botId);
    return this.startBot(botId);
  }

  public isRunning(botId: string): boolean {
    return this.running.has(botId);
  }

  /** The primary is going down: end the children but keep them marked to run. */
  public async shutdown(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await Promise.allSettled([...this.running.keys()].map((botId) => this.stopBot(botId, "offline")));
  }
}
