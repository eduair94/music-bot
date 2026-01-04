import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchUserGuilds, hasManagePermission } from "@/lib/discord";
import { connectToDatabase } from "@/lib/mongodb";
import { PlaybackState, IPlaybackState } from "@/lib/models/PlaybackState";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

// GET playback state for a guild
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
    const state = await PlaybackState.findOne({ guildId }).lean();
    
    if (!state) {
      // Return default empty state
      const defaultState: Partial<IPlaybackState> = {
        guildId,
        isConnected: false,
        voiceChannelId: null,
        voiceChannelName: null,
        textChannelId: null,
        isPlaying: false,
        isPaused: false,
        volume: 80,
        currentTrack: null,
        currentPosition: 0,
        queue: [],
        queueSize: 0,
        loopMode: "off",
        audioBitrate: 128,
        lastUpdated: new Date(),
        playbackStartedAt: null,
      };
      return NextResponse.json(defaultState);
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error("Error fetching playback state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
