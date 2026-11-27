import type { LivePlaybackState, LiveTrack } from "../../../shared/fleet";
import type { PermissionContext } from "../../../shared/permissions";
import { isSnowflake } from "../../../shared/permissions";
import { normalizeTrack } from "./fleet-state";

/**
 * POST /api/guilds/[guildId]/commands, the pure parts (unit-tested):
 * parameter checks, the contract's 1-based queue positions to the bot's
 * 0-based indexes, search results, and the permission context.
 */

/** Commands the dashboard may send (docs/plans/2026-11-27-dashboard-api.md). */
export const DASHBOARD_COMMANDS = new Set([
  "play", "pause", "resume", "skip", "previous", "stop", "volume", "seek", "shuffle", "loop",
  "autoplay", "filter", "remove", "move", "skipto", "clear", "join", "leave", "search"
]);

const MAX_POSITIONS = 100;

export type Param = string | number | boolean | number[];
export type Params = Record<string, Param>;
export type Checked = { ok: true; params: Params } | { ok: false; error: string };

/** A queue position as the contract sends it: 1 = first song in the upcoming queue. */
export const isPosition = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1;
/** Contract position (1-based) -> the bot executor's queue index (0-based). */
export const toIndex = (position: number): number => position - 1;

/**
 * Keep primitive params (and `positions`, a list of numbers) only, then
 * check the ones each command needs. Queue positions arrive 1-based and
 * leave 0-based, as the bot's executor indexes `queue.tracks`. Volume is
 * clamped to the server's maximum (the bot caps at 100 too).
 */
export function checkCommandParams(command: string, raw: unknown, maxVolume: number): Checked {
  const params: Params = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" ? value.length <= 500 : typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean") {
        params[key] = value as string | number | boolean;
      } else if (key === "positions" && Array.isArray(value)) {
        params.positions = value as number[];
      }
    }
  }
  const fail = (error: string): Checked => ({ ok: false, error });
  if ("voiceChannelId" in params && !isSnowflake(params.voiceChannelId)) return fail("voiceChannelId must be a channel id");
  // Only remove takes a list; it is validated below.
  if (command !== "remove") delete params.positions;

  switch (command) {
    case "play":
    case "search":
      if (typeof params.query !== "string" || !params.query.trim()) return fail("query is required");
      params.query = params.query.trim();
      break;
    case "join":
      if (!isSnowflake(params.voiceChannelId)) return fail("voiceChannelId is required");
      break;
    case "volume":
      if (typeof params.volume !== "number") return fail("volume must be a number");
      params.volume = Math.round(Math.min(maxVolume, Math.max(0, params.volume)));
      break;
    case "seek": {
      // Contract: `position` in ms (not a queue position); the v1 player sends `seconds`.
      const at = params.position ?? params.seconds;
      if (typeof at !== "number" || at < 0) return fail("position must be a non-negative number");
      break;
    }
    case "loop":
      if (params.loopMode !== "off" && params.loopMode !== "track" && params.loopMode !== "queue") return fail("loopMode must be off, track or queue");
      break;
    case "autoplay":
      if (typeof params.enabled !== "boolean") return fail("enabled must be true or false");
      break;
    case "filter":
      if (typeof params.name !== "string" || !/^[a-z0-9_]{1,32}$/i.test(params.name)) return fail("name must be an effect name");
      if (typeof params.enabled !== "boolean") return fail("enabled must be true or false");
      break;
    case "remove": {
      if (params.positions !== undefined) {
        const list = params.positions as unknown[];
        if (list.length === 0 || list.length > MAX_POSITIONS || !list.every(isPosition)) {
          return fail(`positions must be 1 to ${MAX_POSITIONS} queue positions (1 = next song)`);
        }
        params.positions = [...new Set(list as number[])].map(toIndex);
        delete params.position;
        break;
      }
      if (!isPosition(params.position)) return fail("position must be a queue position (1 = next song)");
      params.position = toIndex(params.position);
      break;
    }
    case "skipto":
      if (!isPosition(params.position)) return fail("position must be a queue position (1 = next song)");
      params.position = toIndex(params.position);
      break;
    case "move":
      if (!isPosition(params.from) || !isPosition(params.to)) return fail("from and to must be queue positions (1 = next song)");
      params.from = toIndex(params.from);
      params.to = toIndex(params.to);
      break;
  }
  return { ok: true, params };
}

/** `search` results in the contract's Track shape, whatever the bot wrote. */
export function searchData(data: unknown): { results: LiveTrack[] } {
  const raw = data && typeof data === "object" ? (data as { results?: unknown }).results : undefined;
  const results = Array.isArray(raw) ? raw.map(normalizeTrack).filter((t): t is LiveTrack => Boolean(t && t.url)) : [];
  return { results };
}

export type PlaybackSnapshot = Pick<LivePlaybackState, "voiceChannelId" | "listeners" | "currentTrack" | "queue">;

/** Who is sending the command (see GuildAccess). */
export interface CommandMember {
  userId: string;
  voiceChannelId: string | null;
}

/** The member is the only listener in the instance's voice channel. */
export function isAloneWithBot(member: CommandMember, playback: PlaybackSnapshot | null): boolean {
  return Boolean(member.voiceChannelId && playback?.voiceChannelId === member.voiceChannelId && playback.listeners === 1);
}

/**
 * Context for a dashboard command: whether the member requested the song(s)
 * it targets (skip: the current one; remove: queue index `position` or
 * `positions`, already 0-based like the bot's executor) and whether they are
 * alone with the bot (aloneIsDj).
 */
export function commandContext(member: CommandMember, command: string, params: Record<string, unknown>, playback: PlaybackSnapshot | null): PermissionContext {
  if (!playback) return {};
  let requesterIds: (string | undefined)[] = [];
  if (command === "skip") requesterIds = [playback.currentTrack?.requestedBy?.id];
  if (command === "remove") {
    const indexes = Array.isArray(params.positions) ? params.positions : [params.position];
    requesterIds = indexes.map((index) => (typeof index === "number" ? playback.queue?.[index]?.requestedBy?.id : undefined));
  }
  return {
    isRequester: requesterIds.length > 0 && requesterIds.every((id) => Boolean(id && id === member.userId)),
    aloneWithBot: isAloneWithBot(member, playback)
  };
}
