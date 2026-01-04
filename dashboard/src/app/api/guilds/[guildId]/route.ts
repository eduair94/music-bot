import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchUserGuilds, hasManagePermission } from "@/lib/discord";
import { connectToDatabase } from "@/lib/mongodb";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

// GET guild settings
export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  // Verify user has permission
  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || !hasManagePermission(guild.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const settings = await GuildSettingsModel.findOne({ guildId }).lean();
    
    if (!settings) {
      return NextResponse.json({ guildId, exists: false });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching guild settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH update guild settings
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  // Verify user has permission
  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || !hasManagePermission(guild.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updates = await request.json();

    // Remove fields that shouldn't be updated via API
    delete updates._id;
    delete updates.guildId;
    delete updates.createdAt;
    delete updates.premium; // Premium should be updated via Patreon only

    await connectToDatabase();
    
    const settings = await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating guild settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
