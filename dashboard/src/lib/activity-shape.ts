/** Pure helpers that turn aggregation buckets into complete series (tested in activity-shape.test.ts). */

/** One entry per UTC day of the window, oldest first, zero-filled. */
export function fillDaily(
  days: number,
  rows: { _id: string; plays: number; listeningMs: number }[],
  now: Date = new Date()
): { date: string; plays: number; listeningMs: number }[] {
  const byDate = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; plays: number; listeningMs: number }[] = [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    const row = byDate.get(date);
    out.push({ date, plays: row?.plays ?? 0, listeningMs: row?.listeningMs ?? 0 });
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
