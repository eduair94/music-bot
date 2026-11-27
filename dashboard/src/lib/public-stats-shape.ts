/**
 * Public, unauthenticated numbers about Bypass (home page, /status,
 * /api/public/stats). Pure: lib/public-stats.ts reads Redis and Mongo and
 * hands the raw values here.
 */

import { freshness } from "./admin/aggregate";

export type PlayerState = "online" | "stale" | "offline";

export interface PlayerStatus {
  instance: number;
  name: string;
  state: PlayerState;
  /** Gateway round trip in ms; null unless online. */
  pingMs: number | null;
  servers: number;
  /** ISO time of the last process start; null when never seen. */
  startedAt: string | null;
  /** Seconds since the last heartbeat; null when never seen. */
  lastSeenSec: number | null;
  playing: number;
}

export interface PublicStats {
  /** Distinct servers with at least one Bypass player. */
  servers: number;
  /** Sum of member counts of those servers (the figure bot lists show). */
  members: number;
  /** Songs playing right now, across online players. */
  playingNow: number;
  /** Lifetime songs played (counted since September 2026); null when Mongo is unavailable. */
  songsPlayed: number | null;
  players: PlayerStatus[];
  /** Players with a fresh heartbeat. */
  online: number;
  generatedAt: string;
}

export interface FleetInput {
  players: { instance: number; name: string }[];
  /** Raw `bot:status:<n>` values. */
  heartbeats: Map<number, Record<string, unknown> | null>;
  /** Raw `bot:guilds:<n>` members. */
  guildSets: Map<number, string[]>;
  /** Raw legacy `bot:guilds` members (instance 1 before the fleet). */
  legacyGuilds: string[];
  /** memberCount from `bot:guild:<id>`. */
  guildMembers: Map<string, number>;
  songsPlayed: number | null;
  now: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function summarizeFleet(input: FleetInput): PublicStats {
  const { players, heartbeats, guildSets, legacyGuilds, guildMembers, songsPlayed, now } = input;

  const union = new Set<string>();
  for (const ids of guildSets.values()) for (const id of ids) union.add(id);
  if (union.size === 0) for (const id of legacyGuilds) union.add(id);

  const statuses: PlayerStatus[] = players.map(({ instance, name }) => {
    const hb = heartbeats.get(instance) ?? null;
    // `{ online: false }` is the bot's "gateway lost" marker, not a heartbeat.
    const beating = hb && hb.online !== false;
    const ts = beating && typeof hb.ts === "string" ? hb.ts : null;
    const fresh = freshness(ts, now);
    const state: PlayerState = fresh.state === "fresh" ? "online" : fresh.state === "stale" ? "stale" : "offline";
    const queues = (beating ? hb.queues : null) as { playing?: unknown } | null;
    const ws = (beating ? hb.ws : null) as { ping?: unknown } | null;
    return {
      instance,
      name,
      state,
      pingMs: state === "online" && ws && num(ws.ping) > 0 ? Math.round(num(ws.ping)) : null,
      servers: guildSets.get(instance)?.length || (beating ? num(hb.guildCount) : 0),
      startedAt: beating && typeof hb.startedAt === "string" ? hb.startedAt : null,
      lastSeenSec: fresh.ageSec,
      playing: state === "online" ? num(queues?.playing) : 0,
    };
  });

  let members = 0;
  for (const id of union) members += guildMembers.get(id) ?? 0;
  if (members === 0) {
    // Per-guild metadata missing (expired or not yet written): use the primary's own total.
    const primary = heartbeats.get(1);
    if (primary && primary.online !== false) members = num(primary.memberCount);
  }

  return {
    servers: union.size,
    members,
    playingNow: statuses.reduce((sum, p) => sum + p.playing, 0),
    songsPlayed,
    players: statuses,
    online: statuses.filter((p) => p.state === "online").length,
    generatedAt: new Date(now).toISOString(),
  };
}

const exact = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** "25", "2,075", "96.6K": exact below ten thousand, compact above. */
export function compactCount(n: number): string {
  return n < 10_000 ? exact.format(n) : compact.format(n);
}

/** "3d 4h", "5h 12m", "8m": time since an ISO instant. */
export function uptimeLabel(startedAt: string | null, now: number): string {
  if (!startedAt) return "—";
  const sec = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
