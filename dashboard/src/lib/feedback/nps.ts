/**
 * When the dashboard's NPS survey may appear. Pure helpers; the component
 * (components/feedback/NpsSurvey.tsx) keeps the state in localStorage.
 *
 * Shown to someone who opened the dashboard on at least NPS_MIN_DAYS distinct
 * days and hasn't answered or dismissed it in the last NPS_COOLDOWN_DAYS.
 */

/** JSON array of local "YYYY-MM-DD" days the dashboard was opened. */
export const NPS_DAYS_KEY = "bp_nps_days";
/** JSON { at: ms epoch, action: "answered" | "dismissed" }. */
export const NPS_LAST_KEY = "bp_nps_last";

export const NPS_MIN_DAYS = 3;
export const NPS_COOLDOWN_DAYS = 90;
/** Time on the page before the card slides in. */
export const NPS_DELAY_MS = 20_000;
/** Day stamps kept; only the count up to NPS_MIN_DAYS matters. */
const DAYS_KEPT = 30;

export type NpsAction = "answered" | "dismissed";
export type NpsBand = "promoter" | "passive" | "detractor";

/** Local calendar day, so a late-night session doesn't count as two days. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDays(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  } catch {
    return [];
  }
}

/** Adds today (once) and keeps the most recent DAYS_KEPT days. */
export function withVisit(days: string[], today: string): string[] {
  const unique = Array.from(new Set([...days, today])).sort();
  return unique.slice(-DAYS_KEPT);
}

export function parseLast(raw: string | null): { at: number; action: NpsAction } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { at?: unknown; action?: unknown };
    if (typeof value.at !== "number" || !Number.isFinite(value.at)) return null;
    const action = value.action === "answered" ? "answered" : "dismissed";
    return { at: value.at, action };
  } catch {
    return null;
  }
}

export function shouldShowNps(days: string[], lastAt: number | null, now: number): boolean {
  if (days.length < NPS_MIN_DAYS) return false;
  if (lastAt === null) return true;
  return now - lastAt >= NPS_COOLDOWN_DAYS * 86400_000;
}

/** 9-10 promoter, 7-8 passive, 0-6 detractor. */
export function npsBandOf(score: number): NpsBand {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}
