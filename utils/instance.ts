import { fleetKeys, instanceName, parseInstance } from "../shared/fleet";
import type { IGuildSettings, IStay247Settings } from "../shared/types";

/**
 * A premium user's private bot: the full bot running on the user's own
 * Discord application, spawned by BotManagerService (services/botManager.ts)
 * with LINKED_BOT_ID set. It owns its own slash commands but none of
 * Bypass's global state: no fleet routing, no dashboard bus, no Redis guild
 * lists or heartbeat, its own 24/7 slot.
 */
export const LINKED_BOT_ID: string | null = process.env.LINKED_BOT_ID?.trim() || null;
export const isLinked: boolean = LINKED_BOT_ID !== null;

/** Servers a private bot answers in (env LINKED_ALLOWED_GUILDS, comma-separated); empty = any. */
export const LINKED_ALLOWED_GUILDS: ReadonlySet<string> = new Set(
  (process.env.LINKED_ALLOWED_GUILDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

/**
 * Which fleet instance this process is (env BOT_INSTANCE, default 1).
 * Each instance is a full copy of the bot with its own TOKEN; instance 1 is
 * the primary (slash commands, listings, support server, Patreon, metrics).
 * A private bot is instance 0: any instance-keyed write it might still make
 * lands outside the 1-8 range Bypass and its dashboard read.
 */
function readInstance(): number {
  if (isLinked) return 0;
  const raw = process.env.BOT_INSTANCE;
  if (raw === undefined || raw.trim() === "") return 1;
  const parsed = parseInstance(raw);
  if (parsed === null) {
    console.warn(`[Instance] ⚠️ BOT_INSTANCE="${raw}" is not 1-8; running as instance 1`);
    return 1;
  }
  return parsed;
}

export const INSTANCE: number = readInstance();

/** The primary owns the slash commands and everything global. */
export const isPrimary: boolean = INSTANCE === 1;

/** Processes that register and answer slash commands: the primary and private bots. */
export const ownsSlashCommands: boolean = isPrimary || isLinked;

/** "Bypass", "Bypass 2", …; a private bot's own name. */
export const INSTANCE_NAME: string = isLinked ? process.env.LINKED_BOT_NAME?.trim() || "Private bot" : instanceName(INSTANCE);

/** Redis keys for this instance. */
export const instanceKeys = {
  playback: (guildId: string) => fleetKeys.playback(guildId, INSTANCE),
  status: fleetKeys.status(INSTANCE),
  guilds: fleetKeys.guilds(INSTANCE),
  events: fleetKeys.events
} as const;

/**
 * Where this process keeps its 24/7 state: instance 1 the top-level
 * `stay247`, instances 2+ `fleet.stay247.<n>`, a private bot
 * `fleet.stay247.L<botId>`, so none of them ever rejoins another's channel.
 */
export const STAY247_SLOT: number | string = isLinked ? `L${LINKED_BOT_ID}` : INSTANCE;

/** This instance's 24/7 state (see STAY247_SLOT). */
export function stay247Of(
  settings: Pick<IGuildSettings, "stay247" | "fleet"> | null | undefined,
  slot: number | string = STAY247_SLOT
): IStay247Settings | undefined {
  if (!settings) return undefined;
  return slot === 1 ? settings.stay247 : settings.fleet?.stay247?.[String(slot)];
}

/** Settings update that writes this instance's 24/7 state. */
export function stay247Update(value: IStay247Settings, slot: number | string = STAY247_SLOT): Partial<IGuildSettings> {
  return slot === 1 ? { stay247: value } : ({ [`fleet.stay247.${slot}`]: value } as Partial<IGuildSettings>);
}

/** A private bot's counters, reported to its manager (structs/Bot.ts reportLinked). */
export const linkedStats = { songsPlayed: 0 };
