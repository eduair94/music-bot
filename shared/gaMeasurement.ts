/**
 * GA4 Measurement Protocol: server-side events for things the browser never
 * sees (the bot joined a server, a server played its first song).
 *
 * Env (bot `.env` and/or `dashboard/.env`):
 *   GA_MEASUREMENT_ID  G-XXXXXXX (falls back to NEXT_PUBLIC_GA_ID)
 *   GA_API_SECRET      Admin → Data streams → <web stream> → Measurement Protocol API secrets
 * Without both, every call is a no-op. Never throws; failures are logged once a minute.
 *
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

export interface GaServerEvent {
  name: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface GaSendOptions {
  /** The visitor's `_ga` client id. When unknown, pass a stable pseudo id (e.g. `guild.<id>`). */
  clientId: string;
  /** Session id from `_ga_<container>`; ties the event to that session's source/medium. */
  sessionId?: string;
  /** When the event happened (defaults to now). GA accepts up to 72 h in the past. */
  timestampMs?: number;
  /** Hashed user id, never a raw Discord id. */
  userId?: string;
}

let lastErrorLog = 0;

export function gaServerConfigured(): boolean {
  return Boolean(measurementId() && process.env.GA_API_SECRET);
}

function measurementId(): string | undefined {
  return process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID || undefined;
}

/** Pseudo client id for events with no browser behind them: `<10 digits>.<10 digits>` from a seed. */
export function pseudoClientId(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return `${String(h1).padStart(10, "0").slice(0, 10)}.${String(h2).padStart(10, "0").slice(0, 10)}`;
}

export async function sendGaEvents(opts: GaSendOptions, events: GaServerEvent[]): Promise<boolean> {
  const id = measurementId();
  const secret = process.env.GA_API_SECRET;
  if (!id || !secret || !events.length) return false;

  const body = {
    client_id: opts.clientId,
    ...(opts.userId ? { user_id: opts.userId } : {}),
    ...(opts.timestampMs ? { timestamp_micros: Math.round(opts.timestampMs * 1000) } : {}),
    events: events.map((e) => ({
      name: e.name,
      params: {
        // Without engagement time GA4 drops server events from most reports.
        engagement_time_msec: 1,
        ...(opts.sessionId ? { session_id: opts.sessionId } : {}),
        ...Object.fromEntries(Object.entries(e.params ?? {}).filter(([, v]) => v !== undefined))
      }
    }))
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000)
      }
    );
    // MP answers 204 even for malformed events; only transport errors surface here.
    return res.ok;
  } catch (error) {
    if (Date.now() - lastErrorLog > 60_000) {
      lastErrorLog = Date.now();
      console.warn("[ga-mp] send failed:", (error as Error).message);
    }
    return false;
  }
}
