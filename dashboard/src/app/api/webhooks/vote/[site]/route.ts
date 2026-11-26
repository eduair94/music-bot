/**
 * Vote webhooks from bot listing sites.
 *
 * POST /api/webhooks/vote/{topgg|discordbotlist|discords|botlistme|voidbots|discordplace}
 *
 * Each site is enabled by its secret in the env (see lib/votes.ts). A valid
 * vote is stored in Mongo `votes`; the bot reads it to grant 24/7 mode and
 * studio quality for 12 hours. With VOTE_LOG_WEBHOOK_URL set, each vote is
 * also announced in a Discord channel (e.g. #votes in the support server).
 */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Vote } from "@/lib/models/Vote";
import { authorize, parseVote, SITE_LABELS, SITE_SECRETS } from "@/lib/votes";

export const dynamic = "force-dynamic";

async function announce(site: string, userId: string): Promise<void> {
  const url = process.env.VOTE_LOG_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🗳️ <@${userId}> voted on **${SITE_LABELS[site]}**. Thank you! 24/7 mode and studio quality are on for 12 hours.`,
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* announcement is best-effort */
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ site: string }> }) {
  const { site } = await context.params;
  const secretVar = SITE_SECRETS[site];
  if (!secretVar) return NextResponse.json({ error: "Unknown site" }, { status: 404 });

  const secret = process.env[secretVar];
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const rawBody = await request.text();
  if (authorize(site, request.headers, rawBody, secret) !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vote = parseVote(site, body);
  if (!vote) return NextResponse.json({ ok: true, ignored: true });
  if (vote.test) {
    console.log(`[Vote] Test webhook from ${SITE_LABELS[site]} for ${vote.userId}`);
    return NextResponse.json({ ok: true, test: true });
  }

  try {
    await connectToDatabase();
    // Retries resend the same vote: one document per user/site/vote time.
    await Vote.updateOne(
      { userId: vote.userId, site: SITE_LABELS[site], votedAt: vote.votedAt },
      { $setOnInsert: { ...vote, site: SITE_LABELS[site] } },
      { upsert: true }
    );
  } catch (error) {
    console.error("[Vote] Could not store vote:", error);
    // 5xx makes the site retry later.
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  console.log(`[Vote] ${SITE_LABELS[site]} vote from ${vote.userId}`);
  void announce(site, vote.userId);
  return NextResponse.json({ ok: true });
}
