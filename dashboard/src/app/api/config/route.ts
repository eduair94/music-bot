import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * Public bot configuration - returns non-sensitive values needed by the client
 */
export async function GET() {
  return NextResponse.json({
    botClientId: process.env.DISCORD_BOT_CLIENT_ID,
    botPermissions: "3147776", // Required permissions for music bot
    botScopes: "bot applications.commands",
  });
}
