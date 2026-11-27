import "server-only";
import { getRedis } from "@/lib/redis";
import { configuredInstances, fleetKeys } from "../../../shared/fleet";
import { normalizePlayback } from "./fleet-state";

/*
 * Stage presence for the servers list: which Bypass bots are in each server,
 * which are on air (in a voice channel) and what they play. Read once for
 * every listed server in a single Redis pipeline; when Redis is missing,
 * slow or down the list simply renders without live state.
 */

/** air = in a voice channel · bench = in the server, idle · off = not responding · out = not in the server. */
export type StageState = "air" | "bench" | "off" | "out";

export interface StageLane {
  instance: number;
  name: string;
  state: StageState;
  /** On air: the song (absent while it waits in the channel with nothing queued). */
  title?: string;
  author?: string;
  /** On air: the voice channel. */
  channel?: string;
  paused?: boolean;
  listeners?: number;
}

export interface StagePresence {
  lanes: StageLane[];
  onAir: number;
  bench: number;
  missing: number;
}

/** The fields presence needs from a fleet instance (`GET /fleet` shape, demo fixtures, or Redis). */
export interface PresenceSource {
  instance: number;
  name: string;
  inGuild: boolean;
  online: boolean;
  playback: {
    isConnected: boolean;
    isPaused?: boolean;
    voiceChannelName?: string;
    listeners?: number;
    currentTrack?: { title: string; author: string };
  } | null;
}

/** Same counting rules as the Fleet bill: on air = connected, bench = in the server, online and not connected. */
export function presenceFrom(sources: PresenceSource[]): StagePresence {
  const lanes = [...sources]
    .sort((a, b) => a.instance - b.instance)
    .map((s): StageLane => {
      const p = s.playback;
      const state: StageState = !s.inGuild ? "out" : !s.online ? "off" : p?.isConnected ? "air" : "bench";
      if (state !== "air" || !p) return { instance: s.instance, name: s.name, state };
      return {
        instance: s.instance,
        name: s.name,
        state,
        title: p.currentTrack?.title || undefined,
        author: p.currentTrack?.author || undefined,
        channel: p.voiceChannelName,
        paused: Boolean(p.isPaused),
        listeners: p.listeners,
      };
    });
  return {
    lanes,
    onAir: lanes.filter((l) => l.state === "air").length,
    bench: lanes.filter((l) => l.state === "bench").length,
    missing: lanes.filter((l) => l.state === "out").length,
  };
}

function parse(value: unknown): Record<string, any> | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Presence for every server in `guildIds` (all of which have Bypass, the
 * primary). One pipeline: each instance's heartbeat, then per server and
 * instance its `bot:guilds:<n>` membership and `playback:<guildId>:<n>`
 * state, plus the legacy `playback:<guildId>` key instance 1 still writes.
 * Servers missing from the result have no live state to show.
 */
export async function readStagePresence(guildIds: string[], timeoutMs = 1500): Promise<Map<string, StagePresence>> {
  const out = new Map<string, StagePresence>();
  const redis = getRedis();
  if (!redis || guildIds.length === 0) return out;

  const members = configuredInstances();
  const pipeline = redis.pipeline();
  for (const m of members) pipeline.get(fleetKeys.status(m.instance));
  pipeline.get(fleetKeys.legacyStatus);
  for (const id of guildIds) {
    pipeline.get(fleetKeys.legacyPlayback(id));
    for (const m of members) {
      pipeline.sismember(fleetKeys.guilds(m.instance), id);
      pipeline.get(fleetKeys.playback(id, m.instance));
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let results: [Error | null, unknown][] | null;
  try {
    results = await Promise.race([
      pipeline.exec(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error("[presence] Redis pipeline failed:", error instanceof Error ? error.message : error);
    return out;
  } finally {
    clearTimeout(timer);
  }
  if (!results) return out;

  let i = 0;
  const next = () => {
    const [err, value] = results![i++] ?? [null, null];
    return err ? null : value;
  };

  // Heartbeats; instance 1 falls back to the legacy `bot:status` key.
  const statuses = new Map<number, Record<string, any> | null>(members.map((m) => [m.instance, parse(next())]));
  const legacyStatus = parse(next());
  if (!statuses.get(1)) statuses.set(1, legacyStatus);
  const online = new Map<number, boolean>(
    members.map((m) => {
      const status = statuses.get(m.instance);
      return [m.instance, Boolean(status && status.online !== false)];
    }),
  );

  for (const id of guildIds) {
    const legacyPlayback = parse(next());
    const sources: PresenceSource[] = members.map((m) => {
      const member = next();
      const raw = parse(next()) ?? (m.instance === 1 ? legacyPlayback : null);
      return {
        instance: m.instance,
        name: m.name,
        // The list only holds servers Bypass (instance 1) is in.
        inGuild: m.instance === 1 || member === 1,
        online: online.get(m.instance) ?? false,
        playback: raw ? normalizePlayback(raw, id, m.instance) : null,
      };
    });
    out.set(id, presenceFrom(sources));
  }
  return out;
}
