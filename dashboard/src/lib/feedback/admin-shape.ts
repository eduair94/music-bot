/** Response shapes of /api/admin/feedback, shared by the route and the owner console panel. */
import type { FeedbackKind, FeedbackRecord, FeedbackSource } from "../../../../shared/growth";

export type FeedbackStatus = FeedbackRecord["status"];
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ["new", "read", "done"];

/** Counts and NPS cover this many days. */
export const FEEDBACK_WINDOW_DAYS = 90;

export interface AdminFeedbackItem {
  id: string;
  kind: FeedbackKind;
  source: FeedbackSource;
  message: string;
  score?: number;
  contact?: string;
  quoteOk?: boolean;
  userId?: string;
  userName?: string;
  guildId?: string;
  context?: string;
  locale?: string;
  country?: string;
  status: FeedbackStatus;
  createdAt: string;
}

export interface AdminNps {
  /** -100..100, null without answers. */
  score: number | null;
  n: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface AdminFeedbackResponse {
  items: AdminFeedbackItem[];
  countsByKind: Record<FeedbackKind, number>;
  countsByStatus: Record<FeedbackStatus, number>;
  nps: AdminNps;
  windowDays: number;
  generatedAt: string;
}

/** NPS breakdown from 0-10 scores (same rule as netPromoterScore). */
export function npsBreakdown(scores: number[], score: number | null): AdminNps {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10);
  return {
    score,
    n: valid.length,
    promoters: valid.filter((s) => s >= 9).length,
    passives: valid.filter((s) => s >= 7 && s <= 8).length,
    detractors: valid.filter((s) => s <= 6).length,
  };
}
