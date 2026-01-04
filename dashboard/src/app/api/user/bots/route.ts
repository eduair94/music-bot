import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { PatreonUserModel, IPatreonUser, getLinkedBotLimit, getUserTier, TIER_LIMITS } from "@/lib/models/PatreonUser";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/bots
 * List all linked bots for the authenticated user
 */
export async function GET() {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    // Get user's tier info
    const patreonUser = await PatreonUserModel.findOne({ 
      discordId: session.user.discordId 
    }).lean() as IPatreonUser | null;
    
    const pledgeAmount = patreonUser?.pledgeAmountCents ?? 0;
    const tier = getUserTier(pledgeAmount);
    const limit = TIER_LIMITS[tier];
    
    // Get user's linked bots (exclude sensitive fields)
    const bots = await LinkedBotModel.find({ 
      ownerId: session.user.discordId 
    }).select("-encryptedToken -tokenIv").sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      bots,
      tier,
      limit,
      count: bots.length,
      canLinkMore: bots.length < limit,
    });
  } catch (error) {
    console.error("Error fetching linked bots:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/user/bots
 * Link a new bot for the authenticated user
 */
export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.discordId || !session?.user?.name) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token } = await request.json();
    
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: "Bot token is required" }, { status: 400 });
    }

    await connectToDatabase();
    
    // Get user's tier info
    const patreonUser = await PatreonUserModel.findOne({ 
      discordId: session.user.discordId 
    }).lean() as IPatreonUser | null;
    
    const pledgeAmount = patreonUser?.pledgeAmountCents ?? 0;
    const tier = getUserTier(pledgeAmount);
    const limit = getLinkedBotLimit(pledgeAmount);
    
    // Count existing bots
    const currentCount = await LinkedBotModel.countDocuments({ 
      ownerId: session.user.discordId 
    });
    
    if (currentCount >= limit) {
      return NextResponse.json({ 
        error: limit === 0 
          ? "Your plan does not support linking bots. Please upgrade to a paid tier."
          : `You have reached your limit of ${limit} linked bot(s). Please upgrade to link more.`,
        tier,
        limit,
        count: currentCount,
      }, { status: 403 });
    }

    // Validate the token with Discord API
    const discordResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (!discordResponse.ok) {
      if (discordResponse.status === 401) {
        return NextResponse.json({ error: "Invalid bot token" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to validate token with Discord" }, { status: 400 });
    }

    const botData = await discordResponse.json();
    
    // Verify it's actually a bot account
    if (!botData.bot) {
      return NextResponse.json({ error: "Token is not a bot token" }, { status: 400 });
    }

    // Check if bot is already linked
    const existingBot = await LinkedBotModel.findOne({ botId: botData.id });
    if (existingBot) {
      if (existingBot.ownerId === session.user.discordId) {
        return NextResponse.json({ error: "You have already linked this bot" }, { status: 400 });
      }
      return NextResponse.json({ error: "This bot is already linked by another user" }, { status: 400 });
    }

    // Encrypt the token using the encryption key from environment
    const encryptionKey = process.env.BOT_ENCRYPTION_KEY;
    if (!encryptionKey || encryptionKey.length !== 64) {
      console.error("BOT_ENCRYPTION_KEY not properly configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Import crypto functions
    const crypto = await import('crypto');
    const keyBuffer = new Uint8Array(Buffer.from(encryptionKey, 'hex'));
    const ivBuffer = crypto.randomBytes(16);
    const iv = new Uint8Array(ivBuffer);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encryptedToken = cipher.update(token, 'utf8', 'hex');
    encryptedToken += cipher.final('hex');
    const tokenIv = ivBuffer.toString('hex');

    // Create the linked bot record
    const linkedBot = await LinkedBotModel.create({
      ownerId: session.user.discordId,
      ownerUsername: session.user.name,
      botId: botData.id,
      botUsername: botData.username,
      botAvatar: botData.avatar,
      encryptedToken,
      tokenIv,
      status: "offline",
    });

    // Return bot info without sensitive data
    const { encryptedToken: _, tokenIv: __, ...botInfo } = linkedBot.toObject();

    return NextResponse.json({
      success: true,
      bot: botInfo,
      tier,
      limit,
      count: currentCount + 1,
    });
  } catch (error) {
    console.error("Error linking bot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
