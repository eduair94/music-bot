import axios from "axios";
import { Client, Routes } from "discord.js";

/**
 * Posts the server count (and, where supported, the command list) to bot
 * listing sites. Each site is enabled by its own API token in the env; sites
 * without a token are skipped silently. Listing rank depends on fresh stats,
 * and some lists hide bots that never post them.
 */
interface ListSite {
  name: string;
  env: string;
  stats(
    id: string,
    servers: number,
    shards: number,
    users: number,
    voiceConnections: number,
    commandCount: number
  ): { method: "post" | "put" | "patch"; url: string; data?: unknown };
  /** Minimum time between stats posts (default 5 min). */
  minIntervalMs?: number;
  /** Header value for the token (most lists take the raw token). */
  auth?(token: string): string;
  commands?(id: string, commands: unknown[]): { method: "post" | "put" | "patch"; url: string; data: unknown };
}

const SITES: ListSite[] = [
  {
    // top.gg v1: project token from Project → Integrations & API (Bearer).
    name: "top.gg",
    env: "TOPGG_TOKEN",
    minIntervalMs: 15 * 60 * 1000,
    stats: (_id, servers, shards) => ({ method: "patch", url: "https://top.gg/api/v1/projects/@me/metrics", data: { server_count: servers, shard_count: shards } }),
    commands: (_id, commands) => ({ method: "put", url: "https://top.gg/api/v1/projects/@me/commands", data: commands }),
    auth: (token) => (token.startsWith("Bearer ") ? token : `Bearer ${token}`)
  },
  {
    // top.gg legacy (v0) token, if that's what the dashboard issued.
    name: "top.gg (v0)",
    env: "TOPGG_LEGACY_TOKEN",
    minIntervalMs: 15 * 60 * 1000,
    stats: (id, servers, shards) => ({ method: "post", url: `https://top.gg/api/bots/${id}/stats`, data: { server_count: servers, shard_count: shards } })
  },
  {
    name: "discordbotlist.com",
    env: "DISCORDBOTLIST_TOKEN",
    stats: (id, servers, _shards, users, voice) => ({ method: "post", url: `https://discordbotlist.com/api/v1/bots/${id}/stats`, data: { guilds: servers, users, voice_connections: voice } }),
    commands: (id, commands) => ({ method: "post", url: `https://discordbotlist.com/api/v1/bots/${id}/commands`, data: commands }),
    auth: (token) => (token.startsWith("Bot ") ? token : `Bot ${token}`)
  },
  {
    name: "discord.bots.gg",
    env: "DISCORDBOTSGG_TOKEN",
    stats: (id, servers, shards) => ({ method: "post", url: `https://discord.bots.gg/api/v1/bots/${id}/stats`, data: { guildCount: servers, shardCount: shards } })
  },
  {
    name: "discords.com",
    env: "DISCORDS_TOKEN",
    minIntervalMs: 30 * 60 * 1000,
    stats: (id, servers) => ({ method: "post", url: `https://discords.com/bots/api/bot/${id}/setservers`, data: { server_count: servers } })
  },
  {
    name: "botlist.me",
    env: "BOTLISTME_TOKEN",
    stats: (id, servers, shards) => ({ method: "post", url: `https://api.botlist.me/api/v1/bots/${id}/stats`, data: { server_count: servers, shard_count: shards } })
  },
  {
    name: "discordlist.gg",
    env: "DISCORDLISTGG_TOKEN",
    stats: (id, servers) => ({ method: "put", url: `https://api.discordlist.gg/v0/bots/${id}/guilds?count=${servers}` }),
    auth: (token) => `Bearer ${token}`
  },
  {
    name: "voidbots.net",
    env: "VOIDBOTS_TOKEN",
    minIntervalMs: 10 * 60 * 1000,
    stats: (id, servers, shards) => ({ method: "post", url: `https://api.voidbots.net/bot/stats/${id}`, data: { server_count: servers, shard_count: shards } })
  },
  {
    // Revokes the key after repeated early posts: one post per 6 h, never more.
    name: "discord.place",
    env: "DISCORDPLACE_TOKEN",
    minIntervalMs: 6 * 60 * 60 * 1000 + 60_000,
    stats: (id, servers, _shards, _users, _voice, commandCount) => ({ method: "patch", url: `https://api.discord.place/bots/${id}/stats`, data: { server_count: servers, command_count: commandCount } })
  },
  {
    name: "radarcord.net",
    env: "RADARCORD_TOKEN",
    stats: (id, servers, shards) => ({ method: "post", url: `https://radar.cpdv.net/api/bot/${id}/stats`, data: { guilds: servers, shards } })
  },
  {
    name: "bots.ondiscord.xyz",
    env: "BOTSONDISCORD_TOKEN",
    stats: (id, servers) => ({ method: "post", url: `https://bots.ondiscord.xyz/bot-api/bots/${id}/guilds`, data: { guildCount: servers } })
  }
];

export class BotListService {
  private static instance: BotListService;
  private started = false;
  private lastPosted = new Map<string, number>();

  public static getInstance(): BotListService {
    if (!this.instance) this.instance = new BotListService();
    return this.instance;
  }

  public enabledSites(): string[] {
    return SITES.filter((s) => process.env[s.env]).map((s) => s.name);
  }

  public start(client: Client): void {
    if (this.started) return;
    this.started = true;
    const enabled = this.enabledSites();
    if (enabled.length === 0) {
      console.log("[BotLists] No listing tokens configured; skipping stats posting");
      return;
    }
    console.log(`[BotLists] Posting stats to: ${enabled.join(", ")}`);
    // Give the cache a moment after READY, then every 30 minutes.
    setTimeout(() => void this.postAll(client), 60_000).unref();
    setInterval(() => void this.postStats(client), 30 * 60 * 1000).unref();
  }

  private async postAll(client: Client): Promise<void> {
    await this.postStats(client);
    await this.postCommands(client);
  }

  private counts(client: Client) {
    const servers = client.guilds.cache.size;
    const shards = client.shard?.count ?? client.ws.shards.size ?? 1;
    const users = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const voice = client.guilds.cache.filter((g) => Boolean(g.members.me?.voice.channelId)).size;
    return { servers, shards: Math.max(1, shards), users, voice };
  }

  public async postStats(client: Client): Promise<void> {
    const id = client.user?.id;
    if (!id) return;
    const { servers, shards, users, voice } = this.counts(client);
    const commandCount = client.application?.commands.cache.size || 0;
    await Promise.all(
      SITES.filter((s) => process.env[s.env]).map(async (site) => {
        // Most lists rate-limit stats to about one post per few minutes.
        const last = this.lastPosted.get(site.name) ?? 0;
        if (Date.now() - last < (site.minIntervalMs ?? 5 * 60 * 1000)) return;
        const token = process.env[site.env]!;
        const req = site.stats(id, servers, shards, users, voice, commandCount);
        try {
          // Count the attempt too: a failing site must not be hammered.
          this.lastPosted.set(site.name, Date.now());
          const res = await axios.request({
            method: req.method,
            url: req.url,
            data: req.data,
            timeout: 10_000,
            headers: { Authorization: site.auth ? site.auth(token) : token, "Content-Type": "application/json" }
          });
          // botlist.me answers 200 with {"error": "..."} for problems.
          if (res.data && typeof res.data === "object" && typeof (res.data as any).error === "string") {
            console.warn(`[BotLists] ${site.name} stats rejected: ${(res.data as any).error}`);
          }
        } catch (error: any) {
          console.warn(`[BotLists] ${site.name} stats failed: ${error?.response?.status ?? ""} ${error?.message ?? error}`);
        }
      })
    );
  }

  /** Sync the slash command list to sites that show it on the bot page. */
  public async postCommands(client: Client): Promise<void> {
    const id = client.user?.id;
    if (!id) return;
    let registered: unknown[] = [];
    try {
      // Raw API JSON: discord.js objects carry BigInt permission fields that JSON can't serialize.
      registered = (await client.rest.get(Routes.applicationCommands(id))) as unknown[];
    } catch {
      return;
    }
    if (registered.length === 0) return;

    for (const site of SITES.filter((s) => s.commands && process.env[s.env])) {
      const token = process.env[site.env]!;
      const req = site.commands!(id, registered);
      try {
        await axios.request({
          method: req.method,
          url: req.url,
          data: req.data,
          timeout: 15_000,
          headers: { Authorization: site.auth ? site.auth(token) : token, "Content-Type": "application/json" }
        });
        console.log(`[BotLists] ✅ ${site.name}: synced ${registered.length} commands`);
      } catch (error: any) {
        console.warn(`[BotLists] ${site.name} command sync failed: ${error?.response?.status ?? ""} ${error?.message ?? error}`);
      }
    }
  }
}
