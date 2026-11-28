/**
 * Install funnel aggregation shared by the dashboard's admin Growth panel
 * (GET /api/admin/growth) and the bot's weekly staff digest
 * (services/growth/digest.ts), so both use the same definitions of join
 * rate, activation, time to first song and placements. Pure, unit tested in
 * tests/unit/growthReport.test.ts.
 *
 * Inputs: per-day invite click hashes from Redis (`growth:invite_daily:<day>`,
 * field = ref) and the bot's `guildacquisitions` rows from Mongo. Output: the
 * per-day series, a per-source funnel (clicks → joins → activated → still
 * installed / removed), median time to first song and the top referrers.
 *
 * A server that rejoined counts in the window under the source of its latest
 * join (`lastRef`); servers that were already there when tracking started
 * (`backfilled`, never rejoined) are left out of joins and only counted.
 */
import { refLabel } from "./growth";

export const GROWTH_DAYS_DEFAULT = 30;
export const GROWTH_DAYS_MAX = 120;

export interface AcquisitionRow {
  guildId: string;
  name?: string;
  memberCount?: number;
  ref: string;
  lastRef?: string;
  /** Website button of the matched click (`site-hero`…). */
  placement?: string;
  joinedAt: Date | string;
  firstPlayAt?: Date | string | null;
  leftAt?: Date | string | null;
  rejoins?: number;
  backfilled?: boolean;
  referralRewardedAt?: Date | string | null;
  country?: string;
}

export interface DailyClicks {
  date: string;
  counts: Record<string, number>;
}

export interface DayPoint {
  date: string;
  total: number;
  byRef: Record<string, number>;
}

export interface FunnelRow {
  ref: string;
  label: string;
  clicks: number;
  joins: number;
  activated: number;
  installed: number;
  removed: number;
  /** joins / clicks in %, null without clicks. */
  joinRate: number | null;
  /** activated / joins in %, null without joins. */
  activationRate: number | null;
  medianHoursToFirstPlay: number | null;
}

/** Website button performance: which placement turns visitors into servers. */
export interface PlacementRow {
  placement: string;
  label: string;
  clicks: number;
  joins: number;
  activated: number;
  /** joins / clicks in %, null without clicks. */
  joinRate: number | null;
}

/** Daily-hash fields that start with this are website placements, not sources. */
export const PLACEMENT_FIELD_PREFIX = "@";

export interface ReferrerRow {
  userId: string;
  servers: number;
  installed: number;
  activated: number;
  rewarded: number;
}

export interface RecentJoin {
  guildId: string;
  name: string;
  memberCount: number;
  ref: string;
  label: string;
  joinedAt: string;
  rejoin: boolean;
  firstPlayAt: string | null;
  leftAt: string | null;
  country?: string;
}

export interface GrowthConfig {
  gaServer: boolean;
  gaClient: boolean;
  clarity: boolean;
}

export interface GrowthReport {
  days: number;
  from: string;
  to: string;
  clicksByDay: DayPoint[];
  joinsByDay: DayPoint[];
  funnel: FunnelRow[];
  totals: FunnelRow;
  placements: PlacementRow[];
  topReferrers: ReferrerRow[];
  recent: RecentJoin[];
  /** Servers that were already there when tracking started (and never rejoined). */
  preTracking: number;
  config: GrowthConfig;
  sources: { redis: boolean; mongo: boolean };
  generatedAt: string;
}

/** `?days=` → 1..GROWTH_DAYS_MAX (default 30). */
export function clampDays(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return GROWTH_DAYS_DEFAULT;
  return Math.min(GROWTH_DAYS_MAX, n);
}

/** UTC `yyyy-mm-dd` for the last `days` days, oldest first, ending on `now`'s day. */
export function windowDays(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function ms(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function iso(value: Date | string | null | undefined): string | null {
  const t = ms(value);
  return t === null ? null : new Date(t).toISOString();
}

/** Source of the row's latest join. */
export function joinRef(row: AcquisitionRow): string {
  return (row.rejoins ?? 0) > 0 && row.lastRef ? row.lastRef : row.ref;
}

/** A join tracking saw happen (not a server backfilled at startup that never came back). */
export function isTrackedJoin(row: AcquisitionRow): boolean {
  return !row.backfilled || (row.rejoins ?? 0) > 0;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

interface Bucket {
  clicks: number;
  joins: number;
  activated: number;
  installed: number;
  removed: number;
  hours: number[];
}

const emptyBucket = (): Bucket => ({ clicks: 0, joins: 0, activated: 0, installed: 0, removed: 0, hours: [] });

function toRow(ref: string, b: Bucket): FunnelRow {
  return {
    ref,
    label: ref === "*" ? "All sources" : refLabel(ref),
    clicks: b.clicks,
    joins: b.joins,
    activated: b.activated,
    installed: b.installed,
    removed: b.removed,
    joinRate: pct(b.joins, b.clicks),
    activationRate: pct(b.activated, b.joins),
    medianHoursToFirstPlay: round1(median(b.hours)),
  };
}

export function buildGrowthReport(input: {
  days: number;
  now?: Date;
  dailyClicks: DailyClicks[];
  acquisitions: AcquisitionRow[];
  config: GrowthConfig;
  sources: { redis: boolean; mongo: boolean };
}): GrowthReport {
  const now = input.now ?? new Date();
  const dates = windowDays(input.days, now);
  const inWindow = new Set(dates);
  const startMs = Date.parse(`${dates[0]}T00:00:00.000Z`);

  const clicksByDay = new Map<string, DayPoint>(dates.map((d) => [d, { date: d, total: 0, byRef: {} }]));
  const joinsByDay = new Map<string, DayPoint>(dates.map((d) => [d, { date: d, total: 0, byRef: {} }]));
  const buckets = new Map<string, Bucket>();
  const total = emptyBucket();
  const bucket = (ref: string) => {
    let b = buckets.get(ref);
    if (!b) buckets.set(ref, (b = emptyBucket()));
    return b;
  };

  const placements = new Map<string, PlacementRow>();
  const placement = (p: string) => {
    let row = placements.get(p);
    if (!row) placements.set(p, (row = { placement: p, label: refLabel(p), clicks: 0, joins: 0, activated: 0, joinRate: null }));
    return row;
  };

  for (const day of input.dailyClicks) {
    const point = clicksByDay.get(day.date);
    if (!point) continue;
    for (const [ref, raw] of Object.entries(day.counts ?? {})) {
      const n = Math.max(0, Math.floor(Number(raw) || 0));
      if (!n) continue;
      if (ref.startsWith(PLACEMENT_FIELD_PREFIX)) {
        placement(ref.slice(PLACEMENT_FIELD_PREFIX.length)).clicks += n;
        continue;
      }
      point.byRef[ref] = (point.byRef[ref] ?? 0) + n;
      point.total += n;
      bucket(ref).clicks += n;
      total.clicks += n;
    }
  }

  let preTracking = 0;
  const recent: RecentJoin[] = [];
  for (const row of input.acquisitions) {
    if (!isTrackedJoin(row)) {
      preTracking++;
      continue;
    }
    const joined = ms(row.joinedAt);
    if (joined === null) continue;
    const day = new Date(joined).toISOString().slice(0, 10);
    if (!inWindow.has(day) || joined < startMs) continue;

    const ref = joinRef(row);
    const point = joinsByDay.get(day)!;
    point.byRef[ref] = (point.byRef[ref] ?? 0) + 1;
    point.total += 1;

    const firstPlay = ms(row.firstPlayAt);
    const left = ms(row.leftAt);
    if (row.placement) {
      const p = placement(row.placement);
      p.joins += 1;
      if (firstPlay !== null) p.activated += 1;
    }
    for (const b of [bucket(ref), total]) {
      b.joins += 1;
      if (firstPlay !== null) b.activated += 1;
      if (left === null) b.installed += 1;
      else b.removed += 1;
      // A rejoin may carry a first song from an earlier stay: only same-stay delays count.
      if (firstPlay !== null && firstPlay >= joined) b.hours.push((firstPlay - joined) / 3_600_000);
    }

    recent.push({
      guildId: row.guildId,
      name: row.name || row.guildId,
      memberCount: row.memberCount ?? 0,
      ref,
      label: refLabel(ref),
      joinedAt: new Date(joined).toISOString(),
      rejoin: (row.rejoins ?? 0) > 0,
      firstPlayAt: iso(row.firstPlayAt),
      leftAt: iso(row.leftAt),
      country: row.country,
    });
  }

  // Referrers are all-time: a referral link keeps working long after the window.
  const referrers = new Map<string, ReferrerRow>();
  for (const row of input.acquisitions) {
    const match = /^u-(\d{15,22})$/.exec(row.ref);
    if (!match) continue;
    const r = referrers.get(match[1]) ?? { userId: match[1], servers: 0, installed: 0, activated: 0, rewarded: 0 };
    r.servers += 1;
    if (ms(row.leftAt) === null) r.installed += 1;
    if (ms(row.firstPlayAt) !== null) r.activated += 1;
    if (ms(row.referralRewardedAt) !== null) r.rewarded += 1;
    referrers.set(match[1], r);
  }

  const funnel = [...buckets.entries()]
    .map(([ref, b]) => toRow(ref, b))
    .sort((a, b) => b.joins - a.joins || b.clicks - a.clicks || a.ref.localeCompare(b.ref));

  return {
    days: input.days,
    from: dates[0],
    to: dates[dates.length - 1],
    clicksByDay: dates.map((d) => clicksByDay.get(d)!),
    joinsByDay: dates.map((d) => joinsByDay.get(d)!),
    funnel,
    totals: toRow("*", total),
    placements: [...placements.values()]
      .map((p) => ({ ...p, joinRate: p.clicks ? Math.round((p.joins / p.clicks) * 1000) / 10 : null }))
      .sort((a, b) => b.joins - a.joins || b.clicks - a.clicks || a.placement.localeCompare(b.placement)),
    topReferrers: [...referrers.values()].sort((a, b) => b.installed - a.installed || b.servers - a.servers).slice(0, 10),
    recent: recent.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 15),
    preTracking,
    config: input.config,
    sources: input.sources,
    generatedAt: now.toISOString(),
  };
}
