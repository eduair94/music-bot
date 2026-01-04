import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchUserGuilds, isBotInGuild } from "@/lib/discord";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user's guilds
    const guilds = await fetchUserGuilds(session.accessToken);
    
    // Check which guilds have the bot
    const guildBotStatus = await Promise.all(
      guilds.map(async (guild) => {
        const hasBot = await isBotInGuild(guild.id);
        return { ...guild, hasBot };
      })
    );

    const serversWithBot = guildBotStatus.filter((g) => g.hasBot).length;

    // For now, we'll return placeholder data for premium and playlists
    // These would need to be fetched from the database in a full implementation
    return NextResponse.json({
      totalServers: guilds.length,
      serversWithBot,
      premiumServers: 0, // Would fetch from PremiumGuild collection
      playlistsCreated: 0, // Would fetch from a playlists collection
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
