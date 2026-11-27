/** Pure helpers that turn aggregation buckets into complete series (tested in activity-shape.test.ts). */

/** Plays split by the fleet bot that played them: `{ "1": 40, "2": 12 }`, keyed by instance number. */
export type InstanceSplit = Record<string, number>;

/** A play's instance as a key. Rows written before the bot recorded it (or anything out of 1..8) count as Bypass, "1". */
export function instanceKey(value: unknown): string {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? String(n) : "1";
}

/** `{ instance, plays }` buckets folded into one split; empty counts are dropped. */
export function splitByInstance(rows: { instance?: unknown; plays: number }[] | undefined): InstanceSplit {
  const out: InstanceSplit = {};
  for (const row of rows ?? []) {
    if (!(row.plays > 0)) continue;
    const key = instanceKey(row.instance);
    out[key] = (out[key] ?? 0) + row.plays;
  }
  return out;
}

/** The bot with the most plays in a split (ties go to the lower instance); 1 when the split is empty. */
export function dominantInstance(split: InstanceSplit): number {
  let best = 1;
  let most = 0;
  for (const [key, plays] of Object.entries(split)) {
    const n = Number(key);
    if (plays > most || (plays === most && plays > 0 && n < best)) {
      best = n;
      most = plays;
    }
  }
  return best;
}

/** One entry per UTC day of the window, oldest first, zero-filled. */
export function fillDaily(
  days: number,
  rows: { _id: string; plays: number; listeningMs: number; byInstance?: InstanceSplit }[],
  now: Date = new Date()
): { date: string; plays: number; listeningMs: number; byInstance: InstanceSplit }[] {
  const byDate = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; plays: number; listeningMs: number; byInstance: InstanceSplit }[] = [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    const row = byDate.get(date);
    const plays = row?.plays ?? 0;
    out.push({ date, plays, listeningMs: row?.listeningMs ?? 0, byInstance: row?.byInstance ?? (plays > 0 ? { "1": plays } : {}) });
  }
  return out;
}

/** Plays per UTC hour, index 0-23. */
export function fillHours(rows: { _id: number; plays: number }[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const row of rows) if (Number.isInteger(row._id) && row._id >= 0 && row._id < 24) hours[row._id] = row.plays;
  return hours;
}

/** `?days=` accepts 7 or 30 (default 7). */
export function parseDays(value: string | null): 7 | 30 {
  return value === "30" ? 30 : 7;
}

/** `?limit=` clamped to 1..max (default `fallback`). */
export function parseLimit(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}
