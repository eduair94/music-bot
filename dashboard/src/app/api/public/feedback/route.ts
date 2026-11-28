/**
 * POST /api/public/feedback — the site's feedback dialog and the dashboard's
 * NPS survey. No login needed; a session, when present, attaches the Discord
 * id and name. Same-origin only, honeypot field `website`, rate-limited in
 * Redis (lib/feedback/rate-limit.ts). Stored in Mongo `feedbacks`, then
 * forwarded to the staff channel webhook after the response is sent.
 */
import { auth } from "@/auth";
import { isSameOrigin } from "@/lib/admin/guards";
import { checkFeedbackRate } from "@/lib/feedback/rate-limit";
import { clientIp, FEEDBACK_BODY_MAX_BYTES, parseCountry, parseLocale, validateFeedback } from "@/lib/feedback/validate";
import { Feedback } from "@/lib/models/Feedback";
import { connectToDatabase } from "@/lib/mongodb";
import { after, NextResponse } from "next/server";
import { forwardFeedback } from "../../../../../../shared/feedbackWebhook";
import type { FeedbackRecord } from "../../../../../../shared/growth";

export const dynamic = "force-dynamic";

const STORE_TIMEOUT_MS = 6000;

function json(data: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function currentUser(): Promise<{ userId?: string; userName?: string }> {
  try {
    const session = await auth();
    const id = session?.user?.discordId;
    return id ? { userId: id, userName: session?.user?.name?.slice(0, 64) || undefined } : {};
  } catch {
    return {};
  }
}

async function store(record: FeedbackRecord): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await connectToDatabase();
        await Feedback.create(record);
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Mongo did not answer in ${STORE_TIMEOUT_MS} ms`)), STORE_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    console.error("[feedback] could not store:", error instanceof Error ? error.message : error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return json({ ok: false, error: "Cross-origin request rejected" }, 403);
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > FEEDBACK_BODY_MAX_BYTES) return json({ ok: false, error: "Message too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  const result = validateFeedback(body);
  if (!result.ok) return json({ ok: false, error: result.error, field: result.field }, 400);
  // Honeypot: look successful so the bot moves on, keep nothing.
  if (result.spam) return json({ ok: true });

  const rate = await checkFeedbackRate(clientIp(request.headers));
  if (!rate.allowed) {
    const error =
      rate.scope === "ip"
        ? "You've sent a lot of feedback in the last hour. Try again later, or tell us in the support server."
        : "We're getting a lot of feedback right now. Try again later, or tell us in the support server.";
    return json({ ok: false, error }, 429, { "Retry-After": String(rate.retryAfterS) });
  }

  const record: FeedbackRecord = {
    ...result.value,
    ...(await currentUser()),
    status: "new",
    createdAt: new Date(),
  };
  const country = parseCountry(request.headers.get("cf-ipcountry"));
  const locale = parseLocale(request.headers.get("accept-language"));
  if (country) record.country = country;
  if (locale) record.locale = locale;

  if (await store(record)) {
    // Saved: the staff-channel post can finish after the response.
    after(async () => {
      await forwardFeedback(record);
    });
    return json({ ok: true });
  }

  // Not saved: the webhook is the only copy, so wait for it.
  if (await forwardFeedback(record)) return json({ ok: true });
  return json({ ok: false, error: "We couldn't save that right now. Please try again in a minute." }, 503);
}
