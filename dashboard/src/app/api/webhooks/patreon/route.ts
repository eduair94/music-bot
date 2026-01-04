/**
 * Patreon Webhook API Route
 * 
 * POST /api/webhooks/patreon
 * 
 * Handles incoming webhooks from Patreon for:
 * - members:pledge:create - New pledge
 * - members:pledge:update - Updated pledge
 * - members:pledge:delete - Cancelled pledge
 * - members:create - New member
 * - members:update - Member updated
 * - members:delete - Member deleted
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, handleWebhook, isPatreonConfigured } from "@/lib/patreon";

export async function POST(request: NextRequest) {
  console.log("[Webhook] Received Patreon webhook");

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Get headers
    const signature = request.headers.get("x-patreon-signature");
    const event = request.headers.get("x-patreon-event");

    console.log(`[Webhook] Event: ${event}`);
    console.log(`[Webhook] Signature present: ${!!signature}`);

    // Verify signature if webhook secret is configured
    if (process.env.PATREON_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn("[Webhook] Missing signature header");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 }
        );
      }

      if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn("[Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }

      console.log("[Webhook] Signature verified ✓");
    } else {
      console.warn("[Webhook] No webhook secret configured, skipping signature verification");
    }

    // Process the webhook
    const result = await handleWebhook(event || "unknown", body);
    console.log(`[Webhook] ${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/patreon
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    patreonConfigured: isPatreonConfigured(),
    webhookSecretConfigured: !!process.env.PATREON_WEBHOOK_SECRET,
  });
}
