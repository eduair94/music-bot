import { fleetKeys, instanceName, parseInstance } from "../shared/fleet";

/**
 * Which fleet instance this process is (env BOT_INSTANCE, default 1).
 * Each instance is a full copy of the bot with its own TOKEN; instance 1 is
 * the primary (slash commands, listings, support server, Patreon, metrics).
 */
function readInstance(): number {
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

/** "Bypass", "Bypass 2", … */
export const INSTANCE_NAME: string = instanceName(INSTANCE);

/** Redis keys for this instance. */
export const instanceKeys = {
  playback: (guildId: string) => fleetKeys.playback(guildId, INSTANCE),
  status: fleetKeys.status(INSTANCE),
  guilds: fleetKeys.guilds(INSTANCE),
  events: fleetKeys.events
} as const;

/** Log prefix that tells instances apart in shared logs. */
export function instanceTag(): string {
  return isPrimary ? "" : `[#${INSTANCE}] `;
}
