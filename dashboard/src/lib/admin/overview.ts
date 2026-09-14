import "server-only";
import type { IBotHeartbeat, LinkedBotStatus } from "../../../../shared/types";
import type { AdminOverview, MembershipEvent, RecentError } from "@/types/admin";
import { BotEventModel, IBotEventRecord } from "../models/BotEvent";
import { GuildSettingsModel } from "../models/GuildSettings";
import { LinkedBotModel } from "../models/LinkedBot";
import { PatreonUserModel } from "../models/PatreonUser";
import { PlaybackState } from "../models/PlaybackState";
import { PremiumGuild } from "../models/PremiumGuild";
import { connectToDatabase } from "../mongodb";
import { getAllBotGuildsData, getBotStatus, pingRedis } from "../redis";
import { errorRate, fillDailySeries, freshness } from "./aggregate";
import { debugPanelConfigured, fetchDebugPanel } from "./debug-panel";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Any event that counts as an error for the admin console. */
const ERROR_MATCH = {
  $or: [{ kind: "error" }, { kind: "command", ok: false }, { kind: "track", event: "error" }]
};

const EMPTY_LINKED: Record<LinkedBotStatus, number> = { offline: 0, starting: 0, online: 0, error: 0, stopped: 0 };

async function timed(fn: () => Promise<void>): Promise<{ ok: boolean; ms: number | null }> {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: null };
  }
}

interface PlaybackLite {
  isPlaying: boolean;
  isPaused: boolean;
}

export async function loadOverview(now: Date = new Date()): Promise<AdminOverview> {
  const nowMs = now.getTime();
  const d24 = new Date(nowMs - DAY);
  const d48 = new Date(nowMs - 2 * DAY);
  const d7 = new Date(nowMs - 7 * DAY);
  const d14 = new Date(nowMs - 14 * DAY);
  const d30 = new Date(nowMs - 30 * DAY);

  // ── Redis: heartbeat + guild inventory ─────────────────────
  const redis = await pingRedis();
  const heartbeat = redis.ok ? ((await getBotStatus()) as IBotHeartbeat | null) : null;
  const guilds = redis.ok ? await getAllBotGuildsData() : [];
  const guildNames = new Map(guilds.map((g) => [g.id, g.name]));
  const fresh = freshness(heartbeat?.ts ?? null, nowMs);

  // ── Mongo + debug panel reachability ───────────────────────
  const mongo = await timed(async () => {
    const conn = await connectToDatabase();
    await conn.db?.admin().ping();
  });

  const debugPanel = debugPanelConfigured()
    ? await timed(async () => {
        const r = await fetchDebugPanel("/api/status", 2000);
        if (!r.ok) throw new Error(String(r.status));
      })
    : { ok: false, ms: null };

  let totals: AdminOverview["totals"] = {
    guilds: guilds.length,
    members: guilds.reduce((s, g) => s + (g.memberCount || 0), 0),
    playing: fresh.state === "fresh" ? (heartbeat?.queues.playing ?? 0) : 0,
    paused: fresh.state === "fresh" ? (heartbeat?.queues.paused ?? 0) : 0,
    premiumUsers: 0,
    premiumGuilds: 0,
    linkedBots: { ...EMPTY_LINKED },
    guildsWithSettings: 0
  };
  let activity: AdminOverview["activity"] = {
    commands24h: 0,
    commandsPrev24h: 0,
    tracks24h: 0,
    tracksPrev24h: 0,
    errors24h: 0,
    errorRate24h: 0,
    uniqueUsers7d: 0,
    uniqueGuilds7d: 0
  };
  let series14d = fillDailySeries([], 14, now);
  let topCommands7d: AdminOverview["topCommands7d"] = [];
  let sources7d: AdminOverview["sources7d"] = [];
  let recentErrors: RecentError[] = [];
  let membership30d: AdminOverview["membership30d"] = { joins: 0, leaves: 0, recent: [] };

  if (mongo.ok) {
    try {
      const [
        premiumUsers,
        premiumGuilds,
        linkedRows,
        guildsWithSettings,
        playbackRows,
        commands24h,
        commandsPrev24h,
        tracks24h,
        tracksPrev24h,
        errors24h,
        uniqueUsers,
        uniqueGuilds,
        seriesRows,
        topRows,
        sourceRows,
        errorRows,
        joins,
        leaves,
        membershipRows
      ] = await Promise.all([
        PatreonUserModel.countDocuments({ isPremium: true }),
        PremiumGuild.countDocuments({ isActive: true }),
        LinkedBotModel.aggregate<{ _id: LinkedBotStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
        GuildSettingsModel.countDocuments({}),
        fresh.state === "fresh"
          ? Promise.resolve([] as PlaybackLite[])
          : PlaybackState.find({}).select("isPlaying isPaused").lean<PlaybackLite[]>(),
        BotEventModel.countDocuments({ kind: "command", ts: { $gte: d24 } }),
        BotEventModel.countDocuments({ kind: "command", ts: { $gte: d48, $lt: d24 } }),
        BotEventModel.countDocuments({ kind: "track", event: "start", ts: { $gte: d24 } }),
        BotEventModel.countDocuments({ kind: "track", event: "start", ts: { $gte: d48, $lt: d24 } }),
        BotEventModel.countDocuments({ ts: { $gte: d24 }, ...ERROR_MATCH }),
        BotEventModel.distinct("userId", { kind: "command", ts: { $gte: d7 } }),
        BotEventModel.distinct("guildId", { kind: { $in: ["command", "track"] }, ts: { $gte: d7 } }),
        BotEventModel.aggregate<{ _id: string; commands: number; tracks: number; errors: number }>([
          { $match: { ts: { $gte: d14 } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } },
              commands: { $sum: { $cond: [{ $eq: ["$kind", "command"] }, 1, 0] } },
              tracks: {
                $sum: { $cond: [{ $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "start"] }] }, 1, 0] }
              },
              errors: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$kind", "error"] },
                        { $and: [{ $eq: ["$kind", "command"] }, { $eq: ["$ok", false] }] },
                        { $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "error"] }] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        BotEventModel.aggregate<{ _id: string; count: number; failed: number }>([
          { $match: { kind: "command", ts: { $gte: d7 } } },
          { $group: { _id: "$command", count: { $sum: 1 }, failed: { $sum: { $cond: ["$ok", 0, 1] } } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        BotEventModel.aggregate<{ _id: string; starts: number; errors: number }>([
          { $match: { kind: "track", event: { $in: ["start", "error"] }, ts: { $gte: d7 } } },
          {
            $group: {
              _id: "$source",
              starts: { $sum: { $cond: [{ $eq: ["$event", "start"] }, 1, 0] } },
              errors: { $sum: { $cond: [{ $eq: ["$event", "error"] }, 1, 0] } }
            }
          },
          { $sort: { starts: -1 } }
        ]),
        BotEventModel.find(ERROR_MATCH).sort({ ts: -1 }).limit(20).lean<IBotEventRecord[]>(),
        BotEventModel.countDocuments({ kind: "guild", event: "join", ts: { $gte: d30 } }),
        BotEventModel.countDocuments({ kind: "guild", event: "leave", ts: { $gte: d30 } }),
        BotEventModel.find({ kind: "guild", ts: { $gte: d30 } }).sort({ ts: -1 }).limit(10).lean<IBotEventRecord[]>()
      ]);

      const linkedBots = { ...EMPTY_LINKED };
      for (const r of linkedRows) if (r._id in linkedBots) linkedBots[r._id] = r.n;

      totals = {
        ...totals,
        premiumUsers,
        premiumGuilds,
        linkedBots,
        guildsWithSettings,
        playing: fresh.state === "fresh" ? totals.playing : playbackRows.filter((p) => p.isPlaying).length,
        paused: fresh.state === "fresh" ? totals.paused : playbackRows.filter((p) => p.isPaused).length
      };

      activity = {
        commands24h,
        commandsPrev24h,
        tracks24h,
        tracksPrev24h,
        errors24h,
        errorRate24h: errorRate(errors24h, commands24h + tracks24h),
        uniqueUsers7d: uniqueUsers.filter(Boolean).length,
        uniqueGuilds7d: uniqueGuilds.filter(Boolean).length
      };

      series14d = fillDailySeries(
        seriesRows.map((r) => ({ date: r._id, commands: r.commands, tracks: r.tracks, errors: r.errors })),
        14,
        now
      );
      topCommands7d = topRows.map((r) => ({ command: r._id || "unknown", count: r.count, failed: r.failed }));
      sources7d = sourceRows.map((r) => ({ source: r._id || "unknown", starts: r.starts, errors: r.errors }));
      recentErrors = errorRows.map((e) => toRecentError(e, guildNames));
      membership30d = {
        joins,
        leaves,
        recent: membershipRows.map<MembershipEvent>((e) => ({
          ts: new Date(e.ts).toISOString(),
          event: e.event === "leave" ? "leave" : "join",
          guildId: e.guildId || "",
          name: e.name || guildNames.get(e.guildId || "") || e.guildId || "unknown",
          memberCount: e.memberCount || 0
        }))
      };
    } catch (error) {
      console.error("[admin/overview] Mongo aggregation failed:", error);
    }
  }

  return {
    status: { heartbeat, state: fresh.state, ageSec: fresh.ageSec },
    infra: {
      redis: { ok: redis.ok, ms: redis.ms },
      mongo: { ok: mongo.ok, ms: mongo.ms },
      debugPanel: { configured: debugPanelConfigured(), ok: debugPanel.ok, ms: debugPanel.ms }
    },
    totals,
    activity,
    series14d,
    topCommands7d,
    sources7d,
    recentErrors,
    membership30d,
    generatedAt: now.toISOString()
  };
}

function toRecentError(e: IBotEventRecord, guildNames: Map<string, string>): RecentError {
  const base = {
    ts: new Date(e.ts).toISOString(),
    guildId: e.guildId,
    guildName: e.guildId ? guildNames.get(e.guildId) : undefined
  };
  if (e.kind === "command") {
    return { ...base, kind: "command", command: e.command, message: e.error || "Command failed" };
  }
  if (e.kind === "track") {
    return { ...base, kind: "track", track: e.title, message: e.error || "Track error" };
  }
  return { ...base, kind: "error", scope: e.scope, command: e.command, track: e.track, message: e.message || "Error" };
}
