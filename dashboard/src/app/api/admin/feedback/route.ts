import { adminJson, requireOwner, requireOwnerAction } from "@/lib/admin-auth";
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

/** GET ?kind=&status=&limit= — latest feedback, 90-day counts by kind, NPS. */
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
  const since = new Date(Date.now() - FEEDBACK_WINDOW_DAYS * 86400_000);

  try {
    await connectToDatabase();
    const [docs, byKind, byStatus, npsDocs] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).limit(limit).lean<FeedbackDoc[]>(),
      Feedback.aggregate<{ _id: FeedbackKind; n: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$kind", n: { $sum: 1 } } },
      ]),
      Feedback.aggregate<{ _id: FeedbackStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Feedback.find({ kind: "nps", createdAt: { $gte: since }, score: { $type: "number" } }, { score: 1 })
        .limit(10_000)
        .lean<{ score: number }[]>(),
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

/** PATCH { id, status } — triage one item (new → read → done). */
export async function PATCH(request: Request) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = body?.id;
  const status = body?.status;
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return adminJson({ ok: false, error: "Invalid id" }, 400);
  if (typeof status !== "string" || !(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    return adminJson({ ok: false, error: "Invalid status" }, 400);
  }

  try {
    await connectToDatabase();
    const res = await Feedback.updateOne({ _id: id }, { $set: { status } });
    if (res.matchedCount === 0) return adminJson({ ok: false, error: "Not found" }, 404);
    return adminJson({ ok: true });
  } catch (error) {
    console.error("[admin/feedback] update error:", error);
    return adminJson({ ok: false, error: "Internal server error" }, 500);
  }
}
