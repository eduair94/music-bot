export interface DailyPoint {
  date: string;
  commands: number;
  tracks: number;
  errors: number;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Continuous UTC-day series ending today; missing days are zero. */
export function fillDailySeries(rows: Partial<DailyPoint>[], days: number, now: Date = new Date()): DailyPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = utcDay(d);
    const row = byDate.get(date);
    out.push({
      date,
      commands: Number(row?.commands ?? 0),
      tracks: Number(row?.tracks ?? 0),
      errors: Number(row?.errors ?? 0)
    });
  }
  return out;
}

export function delta(curr: number, prev: number): { abs: number; pct: number | null } {
  const abs = curr - prev;
  const pct = prev > 0 ? Math.round((abs / prev) * 1000) / 10 : null;
  return { abs, pct };
}

export function errorRate(errors: number, total: number): number {
  return total > 0 ? Math.round((errors / total) * 1000) / 10 : 0;
}

export type Freshness = "fresh" | "stale" | "offline";

/** Heartbeat age → fresh (<90 s), stale (<10 min), offline. */
export function freshness(
  ts: string | null | undefined,
  now: number = Date.now()
): { state: Freshness; ageSec: number | null } {
  if (!ts) return { state: "offline", ageSec: null };
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return { state: "offline", ageSec: null };
  const ageSec = Math.max(0, Math.round((now - t) / 1000));
  if (ageSec < 90) return { state: "fresh", ageSec };
  if (ageSec < 600) return { state: "stale", ageSec };
  return { state: "offline", ageSec };
}
