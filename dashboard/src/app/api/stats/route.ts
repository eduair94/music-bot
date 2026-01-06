import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Collection } from "@/lib/models/Collection";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { PatreonUserModel, IPatreonUser } from "@/lib/models/PatreonUser";

export const dynamic = 'force-dynamic';

interface PatreonUserData {
  isPremium?: boolean;
  isFounder?: boolean;
  tierTitle?: string;
  audioBitrate?: number;
}

export async function GET() {
  const session = await auth();
  
  if (!session?.accessToken || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Connect to database
    await connectToDatabase();

    // Fetch stats in parallel for better performance
    const [
      collectionsCount,
      totalTracksResult,
      premiumGuildsCount,
      patreonUserResult,
    ] = await Promise.all([
      // Count user's collections (playlists)
      Collection.countDocuments({ userId }),
      
      // Get total tracks across all user's collections
      Collection.aggregate([
        { $match: { userId } },
        { $project: { trackCount: { $size: "$tracks" } } },
        { $group: { _id: null, total: { $sum: "$trackCount" } } },
      ]),
      
      // Count premium guilds linked by this user
      PremiumGuild.countDocuments({ discordId: userId, isActive: true }),
      
      // Get user's Patreon status
      PatreonUserModel.findOne({ discordId: userId }).lean<PatreonUserData>(),
    ]);

    // Extract total tracks from aggregation result
    const totalTracks = totalTracksResult.length > 0 ? totalTracksResult[0].total : 0;
    
    // Cast patreon user result
    const patreonUser = patreonUserResult as PatreonUserData | null;

    // Determine premium status
    const isPremium = patreonUser?.isPremium || false;
    const isFounder = patreonUser?.isFounder || false;
    const tierTitle = patreonUser?.tierTitle || null;

    return NextResponse.json({
      // Collection stats
      collectionsCount,
      totalTracks,
      
      // Premium stats
      premiumGuildsCount,
      isPremium,
      isFounder,
      tierTitle,
      
      // Audio quality
      audioBitrate: patreonUser?.audioBitrate || 128,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
