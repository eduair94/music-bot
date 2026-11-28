import mongoose from "mongoose";
import { Feedback } from "../../models/Feedback";
import { GuildAcquisition } from "../../models/GuildAcquisition";
import { postWebhook, usableWebhookUrl } from "../../shared/feedbackWebhook";
import { FEEDBACK_KINDS, type FeedbackKind, inviteDailyKey, netPromoterScore, refLabel } from "../../shared/growth";
import {
  type AcquisitionRow,
  buildGrowthReport,
  type DailyClicks,
  type PlacementRow,
  windowDays
} from "../../shared/growthReport";
import { getRedis } from "../../shared/services/redis";
import { isPrimary } from "../../utils/instance";
import { referrerIdFromRef, withTimeout } from "./logic";

/**
 * Weekly growth digest for the staff channel: the checks the growth plan
 * (docs/growth/README.md) asks for every week, posted so nobody has to
 * remember them. Last 7 full UTC days vs the 7 before: invite clicks, new
 * servers, how many played a first song (target ACTIVATION_TARGET_PCT) and
 * how fast, removals, the sources and website buttons that brought servers,
 * feedback, and NPS over 90 days.
 *
 * The funnel numbers come from shared/growthReport.ts, the same code as the
 * dashboard's /admin → Growth panel, so both always agree.
 *
 * Runs on the primary only: an hourly check posts on Mondays from 13:00 UTC,
 * and a Redis `SET growth:digest:<ISO week> NX` makes restarts and extra
 * processes post once. Webhook: GROWTH_DIGEST_WEBHOOK_URL, else
 * FEEDBACK_WEBHOOK_URL; without either it stays off.
 * Manual run: scripts/growthDigest.ts (--dry-run prints the payload).
 */

export const DIGEST_DAYS = 7;
export const DIGEST_NPS_DAYS = 90;
/** Share of new servers that should play a song (growth plan target). */
export const ACTIVATION_TARGET_PCT = 60;
/** Posts on this UTC weekday (1 = Monday) from DIGEST_HOUR_UTC on. */
export const DIGEST_WEEKDAY_UTC = 1;
export const DIGEST_HOUR_UTC = 13;
export const DIGEST_CHECK_MS = 3_600_000;
export const DIGEST_LOCK_TTL_S = 8 * 86_400;
/** Visible characters of a feedback message in the digest. */
export const FEEDBACK_PREVIEW_MAX = 150;
export const FEEDBACK_PREVIEW_COUNT = 3;

const DAY_MS = 86_400_000;
const REDIS_TIMEOUT_MS = 5000;
const MONGO_TIMEOUT_MS = 10_000;
const WEBHOOK_TIMEOUT_MS = 8000;
const COLORS = { ok: 0x5be49b, watch: 0xf8aa2a, bad: 0xff5a48 } as const;

/** Redis lock so each ISO week's digest is posted once. */
export const digestLockKey = (isoWeek: string) => `growth:digest:${isoWeek}`;

// ── Pure ────────────────────────────────────────────────────────────────────

/** ISO 8601 week of `date` (UTC), e.g. "2026-W49"; weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // The Thursday of this week decides the ISO year.
  day.setUTCDate(day.getUTCDate() + 3 - ((day.getUTCDay() + 6) % 7));
  const year = day.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const firstThursday = jan4.getTime() + (3 - ((jan4.getUTCDay() + 6) % 7)) * DAY_MS;
  const week = 1 + Math.round((day.getTime() - firstThursday) / (7 * DAY_MS));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The scheduled post is due on Mondays from 13:00 UTC (until midnight). */
export function digestDue(now: Date): boolean {
  return now.getUTCDay() === DIGEST_WEEKDAY_UTC && now.getUTCHours() >= DIGEST_HOUR_UTC;
}

/** Midnight UTC of the last full day before `now`. */
function lastFullDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}

/** Days whose click hashes the digest needs: both windows, oldest first. */
export function digestDays(now: Date): string[] {
  return windowDays(DIGEST_DAYS * 2, lastFullDay(now));
}

/** Feedback fields the digest reads. Contact details and user/server ids are never loaded. */
export interface DigestFeedback {
  kind: FeedbackKind;
  source?: string;
  message?: string;
  score?: number | null;
  createdAt: Date | string;
}

export interface GrowthDigestInput {
  now: Date;
  /** Per-day click hashes covering both windows (digestDays); missing days count as 0. */
  dailyClicks: DailyClicks[];
  /** Every `guildacquisitions` row. */
  acquisitions: AcquisitionRow[];
  /** Feedback from the last DIGEST_NPS_DAYS days. */
  feedback: DigestFeedback[];
  sources: { redis: boolean; mongo: boolean };
}

export interface ChannelRow {
  ref: string;
  label: string;
  clicks: number;
  joins: number;
  joinRate: number | null;
}

export interface WeekStats {
  from: string;
  to: string;
  /** Invite clicks by channel (website-button counters excluded). */
  clicks: number;
  /** Tracked joins (servers there before tracking excluded), rejoins included. */
  joins: number;
  /** Joined servers that have played a song. */
  activated: number;
  /** activated / joins in %, null without joins. */
  activationRate: number | null;
  medianHoursToFirstPlay: number | null;
  /** Servers whose bot left during the window (any server, tracked or not). */
  removed: number;
  /** joins − removed. */
  net: number;
  referralJoins: number;
  /** Sources by joins then clicks; personal referral links merged into one row. */
  channels: ChannelRow[];
  /** Website buttons by joins then clicks. */
  placements: PlacementRow[];
  feedbackByKind: Record<FeedbackKind, number>;
  feedbackCount: number;
}

export interface DigestStats {
  current: WeekStats;
  previous: WeekStats;
  /** Newest first, with a message, current window only. */
  latestFeedback: DigestFeedback[];
  nps: number | null;
  npsResponses: number;
  /** Servers with the primary bot right now (acquisition rows without leftAt); null when Mongo was unavailable. */
  installedNow: number | null;
  sources: { redis: boolean; mongo: boolean };
}

export interface DigestEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
  timestamp: string;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const rate = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : null);

const REFERRAL_ROW = "referrals";

function weekStats(input: GrowthDigestInput, endDay: Date): WeekStats {
  const report = buildGrowthReport({
    days: DIGEST_DAYS,
    now: endDay,
    dailyClicks: input.dailyClicks,
    acquisitions: input.acquisitions,
    config: { gaServer: false, gaClient: false, clarity: false },
    sources: input.sources
  });
  const start = Date.parse(`${report.from}T00:00:00.000Z`);
  const end = Date.parse(`${report.to}T00:00:00.000Z`) + DAY_MS;
  const inWindow = (value: Date | string | null | undefined) => {
    const t = toMs(value);
    return t !== null && t >= start && t < end;
  };

  const removed = input.acquisitions.filter((row) => inWindow(row.leftAt)).length;

  // Personal referral links (`u-<id>`) are one source here: per-referrer rows stay in /admin.
  const channels: ChannelRow[] = [];
  const referrals: ChannelRow = { ref: REFERRAL_ROW, label: "Referral links", clicks: 0, joins: 0, joinRate: null };
  for (const row of report.funnel) {
    if (referrerIdFromRef(row.ref)) {
      referrals.clicks += row.clicks;
      referrals.joins += row.joins;
    } else {
      channels.push({ ref: row.ref, label: row.label, clicks: row.clicks, joins: row.joins, joinRate: row.joinRate });
    }
  }
  if (referrals.clicks || referrals.joins)
    channels.push({ ...referrals, joinRate: rate(referrals.joins, referrals.clicks) });
  channels.sort((a, b) => b.joins - a.joins || b.clicks - a.clicks || a.ref.localeCompare(b.ref));

  const feedbackByKind = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k, 0])) as Record<FeedbackKind, number>;
  let feedbackCount = 0;
  for (const fb of input.feedback) {
    if (!inWindow(fb.createdAt) || !(fb.kind in feedbackByKind)) continue;
    feedbackByKind[fb.kind] += 1;
    feedbackCount += 1;
  }

  return {
    from: report.from,
    to: report.to,
    clicks: report.totals.clicks,
    joins: report.totals.joins,
    activated: report.totals.activated,
    activationRate: report.totals.activationRate,
    medianHoursToFirstPlay: report.totals.medianHoursToFirstPlay,
    removed,
    net: report.totals.joins - removed,
    referralJoins: referrals.joins,
    channels,
    placements: report.placements,
    feedbackByKind,
    feedbackCount
  };
}

/** Every number the digest shows, from plain data. */
export function digestStats(input: GrowthDigestInput): DigestStats {
  const endDay = lastFullDay(input.now);
  const current = weekStats(input, endDay);
  const previous = weekStats(input, new Date(endDay.getTime() - DIGEST_DAYS * DAY_MS));

  const start = Date.parse(`${current.from}T00:00:00.000Z`);
  const end = Date.parse(`${current.to}T00:00:00.000Z`) + DAY_MS;
  const latestFeedback = input.feedback
    .filter((fb) => {
      const t = toMs(fb.createdAt);
      return t !== null && t >= start && t < end && Boolean(fb.message?.trim());
    })
    .sort((a, b) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0));

  const npsSince = input.now.getTime() - DIGEST_NPS_DAYS * DAY_MS;
  const scores = input.feedback
    .filter((fb) => fb.kind === "nps" && typeof fb.score === "number" && (toMs(fb.createdAt) ?? 0) >= npsSince)
    .map((fb) => fb.score as number);
  const nps = netPromoterScore(scores);

  return {
    current,
    previous,
    latestFeedback,
    nps,
    npsResponses: nps === null ? 0 : scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10).length,
    installedNow: input.sources.mongo ? input.acquisitions.filter((row) => toMs(row.leftAt) === null).length : null,
    sources: input.sources
  };
}

/** Rule-driven "Look at" notes; empty when nothing needs attention. */
export function lookAtNotes(stats: DigestStats): string[] {
  if (!stats.sources.mongo) return [];
  const { joins, removed, activationRate } = stats.current;
  const notes: string[] = [];
  if (joins === 0) {
    notes.push("No new servers: check the bot-list invite links carry `?ref=`");
  } else if (activationRate !== null && activationRate < ACTIVATION_TARGET_PCT) {
    notes.push(
      `Fewer than ${ACTIVATION_TARGET_PCT}% of new servers played a song: watch /install and first dashboard visits in Clarity, read the feedback`
    );
  }
  if (removed > joins) {
    notes.push(
      `More servers removed the bot than added it (${removed} vs ${joins}): see which ones left in /admin → Growth and read the feedback`
    );
  }
  return notes;
}

const fmt = (n: number) => String(round1(n));

/** " (+3)", " (-1.5 h)", " (±0)"; empty when either side is unknown. */
export function formatDelta(current: number | null, previous: number | null, unit = ""): string {
  if (current === null || previous === null) return "";
  const diff = round1(current - previous);
  if (diff === 0) return " (±0)";
  return ` (${diff > 0 ? "+" : "-"}${fmt(Math.abs(diff))}${unit})`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${fmt(hours)} h`;
  return `${fmt(hours / 24)} days`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Collapsed to one line, cut to FEEDBACK_PREVIEW_MAX visible characters, Markdown escaped (no masked links). */
export function feedbackPreview(message: string): string {
  // Code points, so an emoji is never cut in half.
  const chars = Array.from(message.replace(/\s+/g, " ").trim());
  const cut =
    chars.length > FEEDBACK_PREVIEW_MAX
      ? `${chars
          .slice(0, FEEDBACK_PREVIEW_MAX - 1)
          .join("")
          .trimEnd()}…`
      : chars.join("");
  return cut.replace(/([\\`*_~|[\]<>])/g, "\\$1");
}

function clampField(value: string): string {
  return value.length > 1024 ? `${value.slice(0, 1023)}…` : value;
}

const KIND_COUNT: Record<FeedbackKind, [string, string]> = {
  idea: ["idea", "ideas"],
  bug: ["bug report", "bug reports"],
  praise: ["praise", "praise"],
  other: ["other", "other"],
  nps: ["NPS answer", "NPS answers"]
};

const KIND_TITLE: Record<FeedbackKind, string> = {
  idea: "Idea",
  bug: "Bug",
  praise: "Praise",
  other: "Other",
  nps: "NPS"
};

function feedbackField(stats: DigestStats): string {
  const { current, previous } = stats;
  if (!current.feedbackCount) return `None this week${formatDelta(0, previous.feedbackCount)}`;
  const counts = FEEDBACK_KINDS.filter((k) => current.feedbackByKind[k] > 0)
    .map((k) => plural(current.feedbackByKind[k], ...KIND_COUNT[k]))
    .join(" · ");
  const lines = [`${current.feedbackCount}${formatDelta(current.feedbackCount, previous.feedbackCount)}: ${counts}`];
  for (const fb of stats.latestFeedback.slice(0, FEEDBACK_PREVIEW_COUNT)) {
    const title =
      fb.kind === "nps" && typeof fb.score === "number" ? `NPS ${fb.score}` : KIND_TITLE[fb.kind] ?? "Feedback";
    const source = fb.source && /^[a-z]{1,20}$/.test(fb.source) ? ` (${fb.source})` : "";
    lines.push(`• **${title}**${source}: ${feedbackPreview(fb.message ?? "")}`);
  }
  const more = stats.latestFeedback.length - FEEDBACK_PREVIEW_COUNT;
  if (more > 0) lines.push(`…and ${more} more in /admin → Feedback`);
  return clampField(lines.join("\n"));
}

function rowLine(label: string, joins: number, clicks: number, joinRate: number | null): string {
  const parts = [plural(joins, "join")];
  if (clicks) parts.push(plural(clicks, "click"));
  if (joinRate !== null) parts.push(`${fmt(joinRate)}% join rate`);
  return `**${label}**: ${parts.join(" · ")}`;
}

/**
 * The digest as a Discord embed (English, staff only). Pure: `input` is
 * plain data, see collectDigestInput for where it comes from.
 */
export function buildGrowthDigest(input: GrowthDigestInput): DigestEmbed {
  const stats = digestStats(input);
  const { current: cur, previous: prev } = stats;
  const notes = lookAtNotes(stats);
  const quiet = cur.clicks === 0 && cur.joins === 0 && cur.removed === 0 && cur.feedbackCount === 0;

  const description = [
    `Last ${DIGEST_DAYS} full days (UTC), changes vs ${prev.from} → ${prev.to}. Target: ${ACTIVATION_TARGET_PCT}% of new servers play a song.`
  ];
  if (!stats.sources.redis) description.push("⚠️ Redis was unreachable: invite clicks are missing.");
  if (!stats.sources.mongo) description.push("⚠️ MongoDB was unreachable: servers, removals and feedback are missing.");
  if (quiet && stats.sources.redis && stats.sources.mongo) {
    const before =
      prev.joins || prev.clicks
        ? ` (the week before: ${plural(prev.joins, "join")}, ${plural(prev.clicks, "click")})`
        : "";
    description.push(`Quiet week: no invite clicks, new servers, removals or feedback${before}.`);
  }

  const fields: DigestEmbed["fields"] = [];
  const nps =
    stats.nps === null
      ? null
      : {
          name: `NPS (${DIGEST_NPS_DAYS} days)`,
          value: `${signed(stats.nps)} from ${plural(stats.npsResponses, "answer")}`,
          inline: true
        };
  const installed =
    stats.installedNow === null
      ? null
      : { name: "Servers with Bypass now", value: String(stats.installedNow), inline: true };

  if (!quiet) {
    const activation =
      cur.activationRate === null
        ? "—"
        : `${cur.activated} · ${fmt(cur.activationRate)}%${formatDelta(cur.activationRate, prev.activationRate, " pts")}`;
    const median =
      cur.medianHoursToFirstPlay === null
        ? "—"
        : `${formatHours(cur.medianHoursToFirstPlay)}${formatDelta(cur.medianHoursToFirstPlay, prev.medianHoursToFirstPlay, " h")}`;
    fields.push(
      { name: "Invite clicks", value: `${cur.clicks}${formatDelta(cur.clicks, prev.clicks)}`, inline: true },
      { name: "Servers joined", value: `${cur.joins}${formatDelta(cur.joins, prev.joins)}`, inline: true },
      { name: "Played a song", value: activation, inline: true },
      { name: "Median time to first song", value: median, inline: true },
      { name: "Removed", value: `${cur.removed}${formatDelta(cur.removed, prev.removed)}`, inline: true },
      { name: "Net installs", value: `${signed(cur.net)}${formatDelta(cur.net, prev.net)}`, inline: true },
      {
        name: "Referral joins",
        value: `${cur.referralJoins}${formatDelta(cur.referralJoins, prev.referralJoins)}`,
        inline: true
      }
    );
    if (installed) fields.push(installed);
    if (nps) fields.push(nps);

    const channels = cur.channels.slice(0, 3);
    if (channels.length) {
      fields.push({
        name: "Top sources",
        value: clampField(channels.map((c) => rowLine(c.label, c.joins, c.clicks, c.joinRate)).join("\n"))
      });
    }
    const buttons = cur.placements.slice(0, 3);
    if (buttons.length) {
      fields.push({
        name: "Website buttons",
        value: clampField(
          buttons.map((p) => rowLine(p.label || refLabel(p.placement), p.joins, p.clicks, p.joinRate)).join("\n")
        )
      });
    }
    fields.push({ name: "Feedback", value: feedbackField(stats) });
  } else {
    if (installed) fields.push(installed);
    if (nps) fields.push(nps);
  }
  if (stats.sources.mongo)
    fields.push({
      name: "Look at",
      value: clampField(notes.length ? notes.map((n) => `• ${n}`).join("\n") : "Nothing flagged this week.")
    });

  return {
    title: `Weekly growth digest · ${cur.from} → ${cur.to}`,
    description: description.join("\n"),
    color: cur.removed > cur.joins || !stats.sources.mongo ? COLORS.bad : notes.length ? COLORS.watch : COLORS.ok,
    fields,
    footer: { text: "Bypass growth · details in /admin → Growth and Feedback" },
    timestamp: input.now.toISOString()
  };
}

/** Webhook body: never pings, whatever a feedback message contains. */
export function digestPayload(embed: DigestEmbed) {
  return { username: "Bypass growth", allowed_mentions: { parse: [] as string[] }, embeds: [embed] };
}

/** GROWTH_DIGEST_WEBHOOK_URL, else FEEDBACK_WEBHOOK_URL (https only); null = digest off. */
export function digestWebhookUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return usableWebhookUrl(env.GROWTH_DIGEST_WEBHOOK_URL) ?? usableWebhookUrl(env.FEEDBACK_WEBHOOK_URL);
}

// ── I/O ─────────────────────────────────────────────────────────────────────

function warn(scope: string, error: unknown): void {
  console.warn(`[Growth] ${scope}:`, (error as Error)?.message ?? error);
}

/** Click hashes per day; null when Redis is unavailable. */
async function readDailyClicks(days: string[]): Promise<DailyClicks[] | null> {
  try {
    const pipeline = getRedis().pipeline();
    for (const day of days) pipeline.hgetall(inviteDailyKey(day));
    const results = await withTimeout(pipeline.exec(), REDIS_TIMEOUT_MS, null);
    // ioredis resolves a pipeline with one error per command when it cannot connect.
    if (!results || (results.length > 0 && results.every(([error]) => error))) return null;
    return days.map((date, i) => {
      const [error, value] = results[i] ?? [null, null];
      const counts: Record<string, number> = {};
      if (!error && value && typeof value === "object") {
        for (const [ref, n] of Object.entries(value as Record<string, string>)) counts[ref] = Number(n) || 0;
      }
      return { date, counts };
    });
  } catch (error) {
    warn("digest clicks unavailable", error);
    return null;
  }
}

async function readAcquisitions(): Promise<AcquisitionRow[] | null> {
  try {
    const query = GuildAcquisition.find({})
      .select(
        "guildId name memberCount ref lastRef placement joinedAt firstPlayAt leftAt rejoins backfilled referralRewardedAt country -_id"
      )
      .sort({ joinedAt: -1 })
      .limit(20_000)
      .maxTimeMS(MONGO_TIMEOUT_MS)
      .lean<AcquisitionRow[]>()
      .exec();
    return await withTimeout(query, MONGO_TIMEOUT_MS + 1000, null);
  } catch (error) {
    warn("digest acquisitions unavailable", error);
    return null;
  }
}

async function readFeedback(since: Date): Promise<DigestFeedback[] | null> {
  try {
    const query = Feedback.find({ createdAt: { $gte: since } })
      .select("kind source message score createdAt -_id")
      .sort({ createdAt: -1 })
      .limit(5000)
      .maxTimeMS(MONGO_TIMEOUT_MS)
      .lean<DigestFeedback[]>()
      .exec();
    return await withTimeout(query, MONGO_TIMEOUT_MS + 1000, null);
  } catch (error) {
    warn("digest feedback unavailable", error);
    return null;
  }
}

/** Reads the digest's data from Redis and Mongo (each with a timeout); never throws. */
export async function collectDigestInput(now: Date = new Date()): Promise<GrowthDigestInput> {
  const [dailyClicks, acquisitions, feedback] = await Promise.all([
    readDailyClicks(digestDays(now)),
    readAcquisitions(),
    readFeedback(new Date(now.getTime() - DIGEST_NPS_DAYS * DAY_MS))
  ]);
  return {
    now,
    dailyClicks: dailyClicks ?? [],
    acquisitions: acquisitions ?? [],
    feedback: feedback ?? [],
    sources: { redis: dailyClicks !== null, mongo: acquisitions !== null && feedback !== null }
  };
}

/**
 * Builds and posts the digest once. Resolves true when Discord accepted it;
 * false without a webhook URL or on any failure. Never throws.
 */
export async function postGrowthDigest(
  options: { now?: Date; url?: string; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  try {
    const url = options.url ?? digestWebhookUrl();
    if (!url) return false;
    const input = await collectDigestInput(options.now ?? new Date());
    return await postWebhook(url, digestPayload(buildGrowthDigest(input)), {
      label: "Growth digest",
      timeoutMs: WEBHOOK_TIMEOUT_MS,
      fetchImpl: options.fetchImpl
    });
  } catch (error) {
    warn("digest failed", error);
    return false;
  }
}

let started = false;
let running = false;

/** One scheduler tick: posts when due, MongoDB is up and this week's Redis lock is free. Never throws. */
export async function runScheduledDigest(now: Date = new Date()): Promise<void> {
  if (running || !digestDue(now)) return;
  running = true;
  try {
    // Mongoose readyState 1 = connected; a digest without Mongo would be all zeroes.
    if (mongoose.connection.readyState !== 1) {
      console.warn("[Growth] Weekly digest due but MongoDB is not connected; next check in an hour");
      return;
    }
    const week = isoWeekKey(now);
    const redis = getRedis();
    const lock = await withTimeout<"OK" | null | "unavailable">(
      redis.set(digestLockKey(week), "1", "EX", DIGEST_LOCK_TTL_S, "NX"),
      REDIS_TIMEOUT_MS,
      "unavailable"
    );
    if (lock === "unavailable") {
      // Without the lock a restart could post twice: wait for Redis.
      console.warn("[Growth] Weekly digest due but Redis is unavailable; next check in an hour");
      return;
    }
    if (lock !== "OK") return; // Already posted this week.
    if (await postGrowthDigest({ now })) {
      console.log(`[Growth] Weekly digest posted (${week})`);
    } else {
      await withTimeout(redis.del(digestLockKey(week)), REDIS_TIMEOUT_MS, 0);
      console.warn(`[Growth] Weekly digest (${week}) was not posted; next check in an hour`);
    }
  } catch (error) {
    warn("weekly digest check failed", error);
  } finally {
    running = false;
  }
}

/**
 * Primary ready: check every hour (first check a minute after startup).
 * Private bots and fleet instances never post; without a webhook URL it logs once and stays off.
 */
export function startGrowthDigest(): void {
  if (!isPrimary || started) return;
  if (!digestWebhookUrl()) {
    console.log("[Growth] Weekly digest off (set GROWTH_DIGEST_WEBHOOK_URL or FEEDBACK_WEBHOOK_URL)");
    return;
  }
  started = true;
  const tick = () => void runScheduledDigest();
  setTimeout(tick, 60_000).unref();
  setInterval(tick, DIGEST_CHECK_MS).unref();
  console.log(`[Growth] Weekly digest on: Mondays from ${DIGEST_HOUR_UTC}:00 UTC`);
}
