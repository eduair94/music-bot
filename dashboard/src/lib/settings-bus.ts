import "server-only";
import { fleetKeys, type FleetEvent } from "../../../shared/fleet";
import { getRedis } from "./redis";

/**
 * Tell the bot (every instance) that a server's settings changed, so it
 * drops its cached copy, and tell open dashboards (the live stream forwards
 * `bypass:events:<guildId>` as `event: settings`). Channel names match the
 * bot's services/settingsBus.ts.
 */
export const SETTINGS_CHANNEL = "bypass:settings";
/** Same channel the /stream route subscribes to. */
export const guildEventsChannel = fleetKeys.events;

export async function publishSettingsChanged(guildId: string, keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis
      .multi()
      .publish(SETTINGS_CHANNEL, JSON.stringify({ guildId, origin: "dashboard" }))
      .publish(guildEventsChannel(guildId), JSON.stringify({ type: "settings", keys } satisfies FleetEvent))
      .exec();
  } catch (error) {
    // The bot's cache also expires on its own (5 min); a failed publish only delays the change.
    console.error("[settings-bus] Publish failed:", (error as Error)?.message ?? error);
  }
}
