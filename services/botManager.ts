import { ChildProcess, fork } from "child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import path from "path";
import { BotStatus, ILinkedBot, LinkedBot } from "../models/LinkedBot";
import { getMaxLinkedBots } from "../shared/types";
import { config } from "../utils/config";

/**
 * Active bot process info
 */
interface BotProcess {
  process: ChildProcess;
  botId: string;
  ownerId: string;
  startedAt: Date;
}

/**
 * BotManagerService - Manages user-linked Discord bot instances
 * 
 * Features:
 * - Encrypt/decrypt bot tokens securely
 * - Spawn bot processes as child processes
 * - Monitor bot health and restart on failure
 * - Enforce tier-based limits
 */
export class BotManagerService {
  private static instance: BotManagerService;
  private activeProcesses: Map<string, BotProcess> = new Map();
  private encryptionKey: Uint8Array;
  private initialized = false;

  private constructor() {
    // Use a 32-byte key for AES-256 (from config or generate)
    const keyHex = config.BOT_ENCRYPTION_KEY || process.env.BOT_ENCRYPTION_KEY;
    if (keyHex && keyHex.length === 64) {
      this.encryptionKey = new Uint8Array(Buffer.from(keyHex, "hex"));
    } else {
      // Generate a random key if not provided (warning: tokens won't persist across restarts!)
      console.warn("[BotManager] ⚠️ No BOT_ENCRYPTION_KEY set. Using random key - tokens won't persist!");
      this.encryptionKey = new Uint8Array(randomBytes(32));
    }
  }

  public static getInstance(): BotManagerService {
    if (!this.instance) {
      this.instance = new BotManagerService();
    }
    return this.instance;
  }

  /**
   * Initialize the bot manager
   * Restarts any bots that were running before shutdown
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("[BotManager] ��� Initializing Bot Manager Service...");

    try {
      // Find all bots that should be running
      const botsToStart = await LinkedBot.find({ 
        status: { $in: ["online", "starting"] } 
      });

      // Mark them as offline first (they'll be started properly)
      await LinkedBot.updateMany(
        { status: { $in: ["online", "starting"] } },
        { status: "offline", processId: null }
      );

      // Restart each bot
      for (const bot of botsToStart) {
        try {
          await this.startBot(bot.botId);
          console.log(`[BotManager] ✅ Restarted bot: ${bot.botUsername}`);
        } catch (error) {
          console.error(`[BotManager] ❌ Failed to restart bot ${bot.botUsername}:`, error);
        }
      }

      this.initialized = true;
      console.log(`[BotManager] ✅ Initialized with ${this.activeProcesses.size} active bots`);
    } catch (error) {
      console.error("[BotManager] ❌ Initialization failed:", error);
    }
  }

  /**
   * Encrypt a bot token for storage
   */
  public encryptToken(token: string): { encryptedToken: string; tokenIv: string } {
    const ivBuffer = randomBytes(16);
    const iv = new Uint8Array(ivBuffer);
    const cipher = createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    return {
      encryptedToken: encrypted,
      tokenIv: ivBuffer.toString("hex"),
    };
  }

  /**
   * Decrypt a stored bot token
   */
  public decryptToken(encryptedToken: string, tokenIv: string): string {
    const iv = new Uint8Array(Buffer.from(tokenIv, "hex"));
    const decipher = createDecipheriv("aes-256-cbc", this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedToken, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Validate a bot token and extract bot info
   */
  public async validateToken(token: string): Promise<{
    valid: boolean;
    botId?: string;
    username?: string;
    avatar?: string | null;
    error?: string;
  }> {
    try {
      // Use Discord API to validate token
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: "Invalid bot token" };
        }
        return { valid: false, error: `Discord API error: ${response.status}` };
      }

      const data = await response.json();
      
      // Verify it's a bot account
      if (!data.bot) {
        return { valid: false, error: "Token is not a bot token" };
      }

      return {
        valid: true,
        botId: data.id,
        username: data.username,
        avatar: data.avatar,
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : "Validation failed" 
      };
    }
  }

  /**
   * Get the number of linked bots for a user
   */
  public async getUserBotCount(userId: string): Promise<number> {
    return LinkedBot.countDocuments({ ownerId: userId });
  }

  /**
   * Check if a user can link more bots based on their tier
   */
  public canLinkBot(pledgeCents: number, currentCount: number): boolean {
    const limit = getMaxLinkedBots(pledgeCents);
    return currentCount < limit;
  }

  /**
   * Link a new bot for a user
   */
  public async linkBot(
    ownerId: string,
    ownerUsername: string,
    token: string,
    pledgeCents: number
  ): Promise<{ success: boolean; bot?: ILinkedBot; error?: string }> {
    try {
      // Check tier limit
      const currentCount = await this.getUserBotCount(ownerId);
      const limit = getMaxLinkedBots(pledgeCents);
      if (!this.canLinkBot(pledgeCents, currentCount)) {
        return { 
          success: false, 
          error: limit === 0 
            ? "Your plan does not support linking bots. Please upgrade to Basic or higher."
            : `You have reached your limit of ${limit} linked bot(s). Please upgrade to link more.`
        };
      }

      // Validate the token
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check if bot is already linked
      const existingBot = await LinkedBot.findOne({ botId: validation.botId });
      if (existingBot) {
        if (existingBot.ownerId === ownerId) {
          return { success: false, error: "You have already linked this bot" };
        }
        return { success: false, error: "This bot is already linked by another user" };
      }

      // Encrypt the token
      const { encryptedToken, tokenIv } = this.encryptToken(token);

      // Create the linked bot record
      const linkedBot = await LinkedBot.create({
        ownerId,
        ownerUsername,
        botId: validation.botId!,
        botUsername: validation.username!,
        botAvatar: validation.avatar,
        encryptedToken,
        tokenIv,
        status: "offline",
      });

      return { success: true, bot: linkedBot };
    } catch (error) {
      console.error("[BotManager] ❌ Error linking bot:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to link bot" 
      };
    }
  }

  /**
   * Unlink a bot
   */
  public async unlinkBot(botId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const bot = await LinkedBot.findOne({ botId, ownerId });
      if (!bot) {
        return { success: false, error: "Bot not found or you don't own it" };
      }

      // Stop the bot if running
      await this.stopBot(botId);

      // Delete the record
      await LinkedBot.deleteOne({ botId, ownerId });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to unlink bot" 
      };
    }
  }

  /**
   * Start a linked bot
   */
  public async startBot(botId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const bot = await LinkedBot.findOne({ botId });
      if (!bot) {
        return { success: false, error: "Bot not found" };
      }

      // Check if already running
      if (this.activeProcesses.has(botId)) {
        return { success: false, error: "Bot is already running" };
      }

      // Decrypt the token
      const token = this.decryptToken(bot.encryptedToken, bot.tokenIv);

      // Update status
      await LinkedBot.updateOne(
        { botId },
        { status: "starting", lastStatusChange: new Date() }
      );

      // Fork a new process for this bot
      const workerPath = path.join(__dirname, "..", "workers", "linkedBotWorker.js");
      
      const child = fork(workerPath, [], {
        env: {
          ...process.env,
        },
        silent: true,
      });

      // Store the process
      this.activeProcesses.set(botId, {
        process: child,
        botId,
        ownerId: bot.ownerId,
        startedAt: new Date(),
      });

      // Send configuration to worker via IPC
      child.send({
        type: "start",
        config: {
          token,
          botId,
          ownerId: bot.ownerId,
          mongodbUri: config.MONGODB_URI,
          allowedGuilds: bot.allowedGuilds || [],
        },
      });

      // Handle process events
      child.on("message", async (message: { type: string; status?: string; error?: string; stats?: { guilds: number; songsPlayed: number; uptime: number }; botId?: string; botUsername?: string; botAvatar?: string }) => {
        if (message.type === "ready") {
          await LinkedBot.updateOne(
            { botId },
            { 
              status: "online", 
              lastStatusChange: new Date(),
              lastError: null,
              processId: String(child.pid),
            }
          );
          console.log(`[BotManager] ✅ Bot ${bot.botUsername} is now online`);
        } else if (message.type === "stats" && message.stats) {
          await LinkedBot.updateOne(
            { botId },
            { 
              totalGuilds: message.stats.guilds,
              totalSongsPlayed: message.stats.songsPlayed,
            }
          );
        } else if (message.type === "error") {
          console.error(`[BotManager] ❌ Bot ${bot.botUsername} error:`, message.error);
          await LinkedBot.updateOne(
            { botId },
            { lastError: message.error }
          );
        }
      });

      child.on("exit", async (code) => {
        this.activeProcesses.delete(botId);
        
        const status: BotStatus = code === 0 ? "stopped" : "error";
        await LinkedBot.updateOne(
          { botId },
          { 
            status, 
            lastStatusChange: new Date(),
            processId: null,
            lastError: code !== 0 ? `Process exited with code ${code}` : null,
          }
        );
        console.log(`[BotManager] Bot ${bot.botUsername} exited with code ${code}`);
      });

      child.on("error", async (error) => {
        console.error(`[BotManager] ❌ Bot ${bot.botUsername} process error:`, error);
        await LinkedBot.updateOne(
          { botId },
          { 
            status: "error", 
            lastStatusChange: new Date(),
            lastError: error.message,
          }
        );
      });

      // Pipe stdout/stderr to main process logs
      child.stdout?.on("data", (data) => {
        console.log(`[LinkedBot:${bot.botUsername}] ${data.toString().trim()}`);
      });

      child.stderr?.on("data", (data) => {
        console.error(`[LinkedBot:${bot.botUsername}] ${data.toString().trim()}`);
      });

      return { success: true };
    } catch (error) {
      console.error("[BotManager] ❌ Error starting bot:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to start bot" 
      };
    }
  }

  /**
   * Stop a running bot
   */
  public async stopBot(botId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const process = this.activeProcesses.get(botId);
      
      if (process) {
        // Send graceful shutdown signal
        process.process.send({ type: "shutdown" });
        
        // Wait for graceful shutdown (max 5 seconds)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            process.process.kill("SIGKILL");
            resolve();
          }, 5000);

          process.process.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        this.activeProcesses.delete(botId);
      }

      await LinkedBot.updateOne(
        { botId },
        { 
          status: "stopped", 
          lastStatusChange: new Date(),
          processId: null,
        }
      );

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to stop bot" 
      };
    }
  }

  /**
   * Restart a bot
   */
  public async restartBot(botId: string): Promise<{ success: boolean; error?: string }> {
    await this.stopBot(botId);
    return this.startBot(botId);
  }

  /**
   * Get all bots for a user
   */
  public async getUserBots(ownerId: string): Promise<ILinkedBot[]> {
    return LinkedBot.find({ ownerId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Get bot status
   */
  public async getBotStatus(botId: string): Promise<{
    status: BotStatus;
    uptime?: number;
    guilds?: number;
  } | null> {
    const bot = await LinkedBot.findOne({ botId });
    if (!bot) return null;

    const process = this.activeProcesses.get(botId);
    
    return {
      status: bot.status,
      uptime: process ? Date.now() - process.startedAt.getTime() : undefined,
      guilds: bot.totalGuilds,
    };
  }

  /**
   * Graceful shutdown - stop all bots
   */
  public async shutdown(): Promise<void> {
    console.log("[BotManager] �� Shutting down all linked bots...");
    
    const stopPromises = Array.from(this.activeProcesses.keys()).map(botId => 
      this.stopBot(botId)
    );
    
    await Promise.all(stopPromises);
    console.log("[BotManager] ✅ All linked bots stopped");
  }
}

export default BotManagerService;
