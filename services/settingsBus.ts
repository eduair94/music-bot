import { randomUUID } from "crypto";
import { fleetKeys, type FleetEvent } from "../shared/fleet";
import { getRedis, getRedisSubscriber } from "../shared/services/redis";

/**
 * Settings change notifications over Redis pub/sub.
 *
 * - `bypass:settings` carries `{ guildId }`: every bot process drops that
 *   server's cached settings. The dashboard publishes it after each write;
 *   the bot publishes it after its own writes so other instances follow.
 * - `bypass:events:<guildId>` carries `{ type: "settings", keys }` for the
 *   dashboard's live stream (forwarded as `event: settings`).
 */
export const SETTINGS_CHANNEL = "bypass:settings";
export const guildEventsChannel = fleetKeys.events;

/** Tags our own messages so this process does not drop the entry it just wrote. */
const ORIGIN = `bot-${process.pid}-${randomUUID().slice(0, 8)}`;

let active = false;

/**
 * Subscribe to `bypass:settings`; `onChange` runs with the guild id of each
 * change made elsewhere. Call once Redis is known to be reachable.
 */
export async function startSettingsInvalidation(onChange: (guildId: string) => void): Promise<void> {
  if (active) return;
  const subscriber = getRedisSubscriber();
  subscriber.on("message", (channel: string, message: string) => {
    if (channel !== SETTINGS_CHANNEL) return;
    try {
      const payload = JSON.parse(message) as { guildId?: unknown; origin?: unknown };
      if (payload.origin === ORIGIN) return;
      if (typeof payload.guildId === "string" && /^\d{15,25}$/.test(payload.guildId)) onChange(payload.guildId);
    } catch {
      /* not ours */
    }
  });
  await subscriber.subscribe(SETTINGS_CHANNEL);
  active = true;
  console.log(`[Settings] Listening for changes on ${SETTINGS_CHANNEL}`);
}

/** Tell other processes (bot instances, dashboard stream) that a server's settings changed. No-op without Redis. */
export function publishSettingsChanged(guildId: string, keys: string[]): void {
  if (!active) return;
  const redis = getRedis();
  void redis
    .multi()
    .publish(SETTINGS_CHANNEL, JSON.stringify({ guildId, origin: ORIGIN }))
    .publish(guildEventsChannel(guildId), JSON.stringify({ type: "settings", keys } satisfies FleetEvent))
    .exec()
    .catch((error: unknown) => console.warn("[Settings] Publish failed:", (error as Error)?.message ?? error));
}
