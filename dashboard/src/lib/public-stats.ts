import "server-only";
import { configuredInstances, fleetKeys } from "../../../shared/fleet";
import { GuildSettingsModel } from "./models/GuildSettings";
import { connectToDatabase } from "./mongodb";
import { type PublicStats, summarizeFleet } from "./public-stats-shape";
import { getRedis, REDIS_KEYS } from "./redis";
import { GITHUB_URL } from "./site";

/*
 * Live public numbers for the landing pages. Every read is bounded by a short
 * timeout and a failure returns null, so a slow Redis or Mongo can never hold
 * up or break a marketing page: the page simply renders without the numbers.
 */

const TIMEOUT_MS = 1500;
const MEMO_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function parse(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Last count Mongo returned: a cold connection can miss the timeout, the number shouldn't vanish. */
let lastSongsPlayed: number | null = null;

async function readSongsPlayed(): Promise<number | null> {
  if (!process.env.MONGODB_URI) return null;
  const result = await withTimeout(
    (async () => {
      await connectToDatabase();
      const [row] = await GuildSettingsModel.aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: "$totalSongsPlayed" } } },
      ]);
      return row?.total ?? 0;
    })(),
  );
  if (typeof result === "number") lastSongsPlayed = result;
  return lastSongsPlayed;
}

async function load(): Promise<PublicStats | null> {
  const redis = getRedis();
  if (!redis) return null;
  const players = configuredInstances().map((m) => ({ instance: m.instance, name: m.name }));

  const pipeline = redis.pipeline();
  for (const p of players) {
    pipeline.get(fleetKeys.status(p.instance));
    pipeline.smembers(fleetKeys.guilds(p.instance));
  }
  pipeline.get(fleetKeys.legacyStatus);
  pipeline.smembers(fleetKeys.legacyGuilds);

  const [results, songsPlayed] = await Promise.all([withTimeout(pipeline.exec()), readSongsPlayed()]);
  if (!results) return null;

  let i = 0;
  const next = () => {
    const [err, value] = results[i++] ?? [null, null];
    return err ? null : value;
  };
  const heartbeats = new Map<number, Record<string, unknown> | null>();
  const guildSets = new Map<number, string[]>();
  for (const p of players) {
    heartbeats.set(p.instance, parse(next()));
    const ids = next();
    guildSets.set(p.instance, Array.isArray(ids) ? (ids as string[]) : []);
  }
  const legacyStatus = parse(next());
  const legacy = next();
  const legacyGuilds = Array.isArray(legacy) ? (legacy as string[]) : [];
  if (!heartbeats.get(1)) heartbeats.set(1, legacyStatus);

  // Member counts live in the primary's per-guild metadata.
  const ids = new Set<string>([...guildSets.values()].flat());
  if (ids.size === 0) legacyGuilds.forEach((id) => ids.add(id));
  const guildMembers = new Map<string, number>();
  if (ids.size > 0) {
    const meta = redis.pipeline();
    for (const id of ids) meta.get(REDIS_KEYS.BOT_GUILD(id));
    const rows = await withTimeout(meta.exec());
    [...ids].forEach((id, n) => {
      const [err, value] = rows?.[n] ?? [null, null];
      const count = err ? null : parse(value)?.memberCount;
      if (typeof count === "number") guildMembers.set(id, count);
    });
  }

  return summarizeFleet({ players, heartbeats, guildSets, legacyGuilds, guildMembers, songsPlayed, now: Date.now() });
}

const memo: { at: number; value: PublicStats | null; inflight: Promise<PublicStats | null> | null } = {
  at: 0,
  value: null,
  inflight: null,
};

/** Live servers, members, players and songs played; null when Redis is unreachable. */
export async function getPublicStats(): Promise<PublicStats | null> {
  if (memo.value && Date.now() - memo.at < MEMO_MS) return memo.value;
  if (!memo.inflight) {
    memo.inflight = load()
      .catch((error) => {
        console.error("[public-stats] load failed:", error instanceof Error ? error.message : error);
        return null;
      })
      .then((value) => {
        if (value) {
          memo.value = value;
          memo.at = Date.now();
        }
        memo.inflight = null;
        return value;
      });
  }
  return memo.inflight;
}

/** Date of the last push to the public repository; null when GitHub doesn't answer. */
export async function getRepoPushedAt(): Promise<string | null> {
  const api = GITHUB_URL.replace("https://github.com/", "https://api.github.com/repos/");
  const res = await withTimeout(
    fetch(api, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "bypass-site" },
      next: { revalidate: 3600 },
    }),
    2500,
  );
  if (!res?.ok) return null;
  const body = (await withTimeout(res.json() as Promise<{ pushed_at?: unknown }>)) ?? null;
  return typeof body?.pushed_at === "string" ? body.pushed_at : null;
}
