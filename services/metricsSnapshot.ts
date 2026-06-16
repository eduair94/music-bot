import { Client } from "discord.js";
import { MetricsSnapshot } from "../models/MetricsSnapshot";
import { PatreonUser } from "../models/PatreonUser";
import { DatabaseService } from "./database";
import { DiscordPlayerService } from "./discordPlayer";

/**
 * MetricsSnapshotService — captures one daily metrics snapshot so the dashboard
 * can chart real growth over time.
 *
 * Runs an upsert keyed by the UTC calendar day, so repeated runs within a day
 * (startup + interval) keep refining that day's numbers rather than duplicating.
 */
export class MetricsSnapshotService {
  private static instance: MetricsSnapshotService;
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): MetricsSnapshotService {
    if (!this.instance) {
      this.instance = new MetricsSnapshotService();
    }
    return this.instance;
  }

  /** Start capturing: one immediately, then every 6 hours. */
  public start(client: Client): void {
    this.client = client;
    void this.capture();
    this.timer = setInterval(() => void this.capture(), 6 * 60 * 60 * 1000);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private utcDay(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private async capture(): Promise<void> {
    if (!this.client) return;
    if (!DatabaseService.getInstance().isReady()) return;

    try {
      const guilds = this.client.guilds.cache;
      const totalGuilds = guilds.size;
      const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);

      // Active = guilds with a currently-playing queue
      let activeGuilds = 0;
      const player = DiscordPlayerService.getInstance().getPlayer();
      if (player) {
        for (const node of player.nodes.cache.values()) {
          if (node.node.isPlaying()) activeGuilds++;
        }
      }

      const [premiumUsers, founders] = await Promise.all([
        PatreonUser.countDocuments({ isPremium: true }),
        PatreonUser.countDocuments({ isFounder: true }),
      ]);

      await MetricsSnapshot.updateOne(
        { date: this.utcDay() },
        {
          $set: {
            totalGuilds,
            totalMembers,
            activeGuilds,
            premiumUsers,
            founders,
            capturedAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(
        `[Metrics] 📈 Snapshot ${this.utcDay()}: ${totalGuilds} servers, ${totalMembers} members, ${premiumUsers} premium`
      );
    } catch (error) {
      console.error("[Metrics] Snapshot capture failed:", error);
    }
  }
}
