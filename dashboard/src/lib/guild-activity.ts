import "server-only";
import { formatDuration } from "../../../shared/types";
import { BotEventModel } from "./models/BotEvent";
import { PlayHistoryModel, type IPlayHistory } from "./models/PlayHistory";
import { dominantInstance, fillDaily, fillHours, instanceKey, splitByInstance } from "./activity-shape";

/**
 * Server analytics from the bot's own records: `playhistory` (one row per
 * song that started, 30-day TTL) and `botevents` (track "skip" events).
 * Dates are UTC. Plays are also split by the fleet bot that played them
 * (`instance`; rows from before the bot recorded it count as 1).
 */

/** The row's bot, with old rows (no `instance`) read as Bypass. */
const INSTANCE = { $ifNull: ["$instance", 1] };

type InstanceBuckets = { instance: unknown; plays: number }[];

interface ActivityFacets {
  totals: { plays: number; listeningMs: number; requesters: (string | null)[] }[];
  instances: { _id: unknown; plays: number }[];
  daily: { _id: string; plays: number; listeningMs: number; instances: InstanceBuckets }[];
  hours: { _id: number; plays: number }[];
  topTracks: { _id: string; title: string; author: string; thumbnail: string; plays: number; instances: InstanceBuckets }[];
  topRequesters: { _id: string; username: string; plays: number }[];
  sources: { _id: string | null; plays: number }[];
}

/** Guess-the-song previews (Deezer CDN clips) recorded before the game was excluded from history. */
const GUESS_PREVIEW = /cdn-preview|dzcdn\.net/;

export async function guildActivity(guildId: string, days: number, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const [facets] = (await PlayHistoryModel.aggregate([
    { $match: { guildId, playedAt: { $gte: since }, url: { $not: GUESS_PREVIEW } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              plays: { $sum: 1 },
              listeningMs: { $sum: { $ifNull: ["$duration", 0] } },
              requesters: { $addToSet: "$requestedBy.id" }
            }
          }
        ],
        instances: [{ $group: { _id: INSTANCE, plays: { $sum: 1 } } }],
        daily: [
          {
            $group: {
              _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$playedAt" } }, instance: INSTANCE },
              plays: { $sum: 1 },
              listeningMs: { $sum: { $ifNull: ["$duration", 0] } }
            }
          },
          {
            $group: {
              _id: "$_id.date",
              plays: { $sum: "$plays" },
              listeningMs: { $sum: "$listeningMs" },
              instances: { $push: { instance: "$_id.instance", plays: "$plays" } }
            }
          }
        ],
        hours: [{ $group: { _id: { $hour: "$playedAt" }, plays: { $sum: 1 } } }],
        topTracks: [
          {
            $group: {
              _id: { url: "$url", instance: INSTANCE },
              title: { $first: "$title" },
              author: { $first: "$author" },
              thumbnail: { $first: "$thumbnail" },
              plays: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: "$_id.url",
              title: { $first: "$title" },
              author: { $first: "$author" },
              thumbnail: { $first: "$thumbnail" },
              plays: { $sum: "$plays" },
              instances: { $push: { instance: "$_id.instance", plays: "$plays" } }
            }
          },
          { $sort: { plays: -1, _id: 1 } },
          { $limit: 10 }
        ],
        topRequesters: [
          { $match: { "requestedBy.id": { $type: "string" } } },
          { $sort: { playedAt: -1 } },
          { $group: { _id: "$requestedBy.id", username: { $first: "$requestedBy.username" }, plays: { $sum: 1 } } },
          { $sort: { plays: -1, _id: 1 } },
          { $limit: 10 }
        ],
        sources: [{ $group: { _id: "$source", plays: { $sum: 1 } } }]
      }
    }
  ])) as ActivityFacets[];

  const skips = await BotEventModel.countDocuments({ kind: "track", event: "skip", guildId, ts: { $gte: since } });
  const totals = facets?.totals[0];

  return {
    totals: {
      plays: totals?.plays ?? 0,
      listeningMs: totals?.listeningMs ?? 0,
      requesters: (totals?.requesters ?? []).filter((id) => typeof id === "string" && id).length,
      skips,
      byInstance: splitByInstance((facets?.instances ?? []).map((i) => ({ instance: i._id, plays: i.plays })))
    },
    daily: fillDaily(
      days,
      (facets?.daily ?? []).map((d) => ({ _id: d._id, plays: d.plays, listeningMs: d.listeningMs, byInstance: splitByInstance(d.instances) })),
      now
    ),
    hours: fillHours(facets?.hours ?? []),
    topTracks: (facets?.topTracks ?? []).map((t) => {
      const byInstance = splitByInstance(t.instances);
      return {
        title: t.title ?? "",
        author: t.author ?? "",
        url: t._id,
        thumbnail: t.thumbnail ?? "",
        plays: t.plays,
        byInstance,
        /** The bot that played it most. */
        instance: dominantInstance(byInstance)
      };
    }),
    topRequesters: (facets?.topRequesters ?? []).map((r) => ({
      id: r._id,
      username: r.username ?? "",
      // playhistory does not keep avatars
      avatar: null as string | null,
      plays: r.plays
    })),
    sources: Object.fromEntries((facets?.sources ?? []).map((s) => [s._id || "unknown", s.plays])) as Record<string, number>
  };
}

export async function guildHistory(guildId: string, limit: number) {
  const rows = (await PlayHistoryModel.find({ guildId, url: { $not: GUESS_PREVIEW } }).sort({ playedAt: -1 }).limit(limit).lean()) as unknown as IPlayHistory[];
  return rows.map((row) => ({
    title: row.title,
    author: row.author ?? "",
    url: row.url,
    thumbnail: row.thumbnail ?? "",
    duration: row.duration ? formatDuration(row.duration) : "",
    durationMs: row.duration ?? 0,
    source: row.source ?? "unknown",
    requestedBy: row.requestedBy ? { id: row.requestedBy.id, username: row.requestedBy.username ?? "" } : null,
    playedAt: row.playedAt,
    autoplay: Boolean(row.autoplay),
    instance: Number(instanceKey(row.instance))
  }));
}
