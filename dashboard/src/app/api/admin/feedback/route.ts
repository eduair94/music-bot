import { adminJson, requireOwner, requireOwnerAction } from "@/lib/admin-auth";
import { feedbackUpdate, NOT_QUOTABLE_ERROR, parseAdminFeedbackPatch } from "@/lib/feedback/admin-patch";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_WINDOW_DAYS,
  npsBreakdown,
  type AdminFeedbackItem,
  type AdminFeedbackResponse,
  type FeedbackStatus,
} from "@/lib/feedback/admin-shape";
import { Feedback } from "@/lib/models/Feedback";
import { connectToDatabase } from "@/lib/mongodb";
import type { NextRequest } from "next/server";
import { FEEDBACK_KINDS, netPromoterScore, type FeedbackKind, type FeedbackRecord } from "../../../../../../shared/growth";

export const dynamic = "force-dynamic";

type FeedbackDoc = FeedbackRecord & { _id: { toString(): string } };

function toItem(doc: FeedbackDoc): AdminFeedbackItem {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    source: doc.source,
    message: doc.message ?? "",
    score: doc.score,
    contact: doc.contact,
    quoteOk: doc.quoteOk,
    featured: doc.featured === true ? true : undefined,
    featuredAt: doc.featuredAt ? new Date(doc.featuredAt).toISOString() : undefined,
    quoteAttribution: doc.quoteAttribution,
    userId: doc.userId,
    userName: doc.userName,
    guildId: doc.guildId,
    context: doc.context,
    locale: doc.locale,
    country: doc.country,
    status: doc.status ?? "new",
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/** GET ?kind=&status=&featured=1&limit= — latest feedback, 90-day counts by kind, NPS, items on the site. */
export async function GET(request: NextRequest) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;

  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  const status = params.get("status");
  const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 50));
  const filter: Record<string, unknown> = {};
  if (kind && (FEEDBACK_KINDS as readonly string[]).includes(kind)) filter.kind = kind;
  if (status && (FEEDBACK_STATUSES as readonly string[]).includes(status)) filter.status = status;
  if (params.get("featured") === "1") filter.featured = true;
  const since = new Date(Date.now() - FEEDBACK_WINDOW_DAYS * 86400_000);

  try {
    await connectToDatabase();
    const [docs, byKind, byStatus, npsDocs, featuredCount] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).limit(limit).lean<FeedbackDoc[]>(),
      Feedback.aggregate<{ _id: FeedbackKind; n: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$kind", n: { $sum: 1 } } },
      ]),
      Feedback.aggregate<{ _id: FeedbackStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Feedback.find({ kind: "nps", createdAt: { $gte: since }, score: { $type: "number" } }, { score: 1 })
        .limit(10_000)
        .lean<{ score: number }[]>(),
      // Same condition as the landing page's read (lib/testimonials.ts).
      Feedback.countDocuments({ featured: true, quoteOk: true }),
    ]);

    const countsByKind = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k, 0])) as Record<FeedbackKind, number>;
    for (const row of byKind) if (row._id in countsByKind) countsByKind[row._id] = row.n;
    const countsByStatus = Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])) as Record<FeedbackStatus, number>;
    for (const row of byStatus) if (row._id in countsByStatus) countsByStatus[row._id] = row.n;
    const scores = npsDocs.map((d) => d.score);

    const body: AdminFeedbackResponse = {
      items: docs.map(toItem),
      countsByKind,
      countsByStatus,
      featuredCount,
      nps: npsBreakdown(scores, netPromoterScore(scores)),
      windowDays: FEEDBACK_WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/feedback] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}

/**
 * PATCH { id, status?, featured?, quoteAttribution? }: triage one item
 * (new → read → done), put it on / take it off the landing page, set the
 * line shown under the quote. Featuring needs the author's quoteOk (400
 * otherwise); unfeaturing is always allowed.
 */
export async function PATCH(request: Request) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;

  const parsed = parseAdminFeedbackPatch(await request.json().catch(() => null));
  if (!parsed.ok) return adminJson({ ok: false, error: parsed.error }, 400);
  const patch = parsed.value;

  try {
    await connectToDatabase();
    const { filter, update } = feedbackUpdate(patch, new Date());
    const res = await Feedback.updateOne(filter, update);
    if (res.matchedCount === 0) {
      // Featuring filters on quoteOk: tell "not quotable" apart from "gone".
      if (patch.featured === true && (await Feedback.exists({ _id: patch.id }))) {
        return adminJson({ ok: false, error: NOT_QUOTABLE_ERROR }, 400);
      }
      return adminJson({ ok: false, error: "Not found" }, 404);
    }
    return adminJson({ ok: true });
  } catch (error) {
    console.error("[admin/feedback] update error:", error);
    return adminJson({ ok: false, error: "Internal server error" }, 500);
  }
}
