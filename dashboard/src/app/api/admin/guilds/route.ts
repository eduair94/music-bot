import { auth } from "@/auth";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { PlaybackState, IPlaybackState } from "@/lib/models/PlaybackState";
import { connectToDatabase } from "@/lib/mongodb";
import { getAllBotGuildsData, getBotStatus, GuildData } from "@/lib/redis";
import { IGuildSettings } from "../../../../../../shared/types";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Owner ID from environment
const OWNER_ID = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;

interface GuildAnalytics extends GuildData {
  hasSettings: boolean;
  isCurrentlyPlaying: boolean;
  totalTracksPlayed?: number;
  lastActive?: string;
  settings?: {
    djRoleId?: string;
    prefix?: string;
    defaultVolume?: number;
  };
}

interface AdminStats {
  totalGuilds: number;
  totalMembers: number;
  activeGuilds: number;
  guildsWithSettings: number;
  botStatus: Record<string, unknown> | null;
}

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is the owner
  if (session.user.discordId !== OWNER_ID) {
    return NextResponse.json({ error: "Forbidden - Owner access required" }, { status: 403 });
  }

  try {
    // Get all guilds from Redis
    const guilds = await getAllBotGuildsData();
    const botStatus = await getBotStatus();
    
    // Connect to MongoDB for additional data
    await connectToDatabase();
    
    // Get guild settings and playback states
    const guildIds = guilds.map(g => g.id);
    
    const [settingsData, playbackData] = await Promise.all([
      GuildSettingsModel.find({ guildId: { $in: guildIds } }).lean<IGuildSettings[]>(),
      PlaybackState.find({ guildId: { $in: guildIds } }).lean<IPlaybackState[]>(),
    ]);
    
    // Create lookup maps
    const settingsMap = new Map(settingsData.map((s: IGuildSettings) => [s.guildId, s]));
    const playbackMap = new Map(playbackData.map((p: IPlaybackState) => [p.guildId, p]));
    
    // Enhance guild data with analytics
    const guildsWithAnalytics: GuildAnalytics[] = guilds.map(guild => {
      const settings = settingsMap.get(guild.id);
      const playback = playbackMap.get(guild.id);
      
      return {
        ...guild,
        hasSettings: !!settings,
        isCurrentlyPlaying: playback?.isPlaying || false,
        lastActive: playback?.lastUpdated ? new Date(playback.lastUpdated).toISOString() : undefined,
        settings: settings ? {
          djRoleId: settings.djRoleId ?? undefined,
          defaultVolume: settings.defaultVolume,
        } : undefined,
      };
    });
    
    // Sort by member count (largest first)
    guildsWithAnalytics.sort((a, b) => b.memberCount - a.memberCount);
    
    // Calculate stats
    const stats: AdminStats = {
      totalGuilds: guilds.length,
      totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
      activeGuilds: playbackData.filter((p: IPlaybackState) => p.isPlaying).length,
      guildsWithSettings: settingsData.length,
      botStatus,
    };
    
    return NextResponse.json({
      guilds: guildsWithAnalytics,
      stats,
    });
  } catch (error) {
    console.error("Error fetching admin data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
