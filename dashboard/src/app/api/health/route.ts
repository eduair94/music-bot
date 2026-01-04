/**
 * Health Check API Route
 * 
 * GET /api/health
 */

import { NextResponse } from "next/server";
import { isPatreonConfigured } from "@/lib/patreon";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "music-bot-dashboard",
    timestamp: new Date().toISOString(),
    patreonConfigured: isPatreonConfigured(),
    webhookSecretConfigured: !!process.env.PATREON_WEBHOOK_SECRET,
  });
}
