import { auth } from "@/auth";
import { botInviteUrl } from "../../../../../../shared/links";
import { BotCommand } from "@/lib/models/BotCommand";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { getUserTier, IPatreonUser, PatreonUserModel } from "@/lib/models/PatreonUser";
import { inspectBotToken, linkedBotAllowanceFor } from "@/lib/linked-bots";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/bots
 * The signed-in user's private bots and how many they may have.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const discordId = session.user.discordId;
    const [patron, limit, bots] = await Promise.all([
      PatreonUserModel.findOne({ discordId }).lean() as Promise<IPatreonUser | null>,
      linkedBotAllowanceFor(discordId),
      LinkedBotModel.find({ ownerId: discordId }).select("-encryptedToken -tokenIv").sort({ createdAt: 1 }).lean()
    ]);
    const tier = patron?.isPremium ? getUserTier(patron.pledgeAmountCents ?? 0) : "free";

    return NextResponse.json({
      bots: bots.map((bot) => ({ ...bot, inviteUrl: botInviteUrl(bot.botId) })),
      tier,
      limit,
      count: bots.length,
      canLinkMore: bots.length < limit
    });
  } catch (error) {
    console.error("[bots] list failed:", (error as Error)?.message ?? error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/user/bots
 * Link a private bot: check the token with Discord, store it encrypted and
 * ask the bot process to start it.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token } = (await request.json().catch(() => ({}))) as { token?: unknown };
    const value = typeof token === "string" ? token.trim() : "";
    if (!value) return NextResponse.json({ error: "Bot token is required" }, { status: 400 });
    // A bot token is three dot-separated base64url parts; anything else is a paste mistake.
    if (!/^[\w-]{20,}\.[\w-]{4,}\.[\w-]{20,}$/.test(value)) {
      return NextResponse.json({ error: "That doesn't look like a bot token. Copy it from the Bot page of your application" }, { status: 400 });
    }

    await connectToDatabase();
    const discordId = session.user.discordId;
    const limit = await linkedBotAllowanceFor(discordId);
    const count = await LinkedBotModel.countDocuments({ ownerId: discordId });
    if (count >= limit) {
      return NextResponse.json(
        {
          error:
            limit === 0
              ? "Private bots come with Premium. Become a Founder on Patreon to run one"
              : `You already have ${limit} private bot${limit === 1 ? "" : "s"}, the most your plan allows`,
          limit,
          count
        },
        { status: 403 }
      );
    }

    const check = await inspectBotToken(value);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const existing = await LinkedBotModel.findOne({ botId: check.botId }, { ownerId: 1 }).lean<{ ownerId: string }>();
    if (existing) {
      return NextResponse.json(
        { error: existing.ownerId === discordId ? "You already linked this bot" : "Another account already linked this bot" },
        { status: 409 }
      );
    }

    const key = process.env.BOT_ENCRYPTION_KEY ?? "";
    if (!/^[0-9a-f]{64}$/i.test(key)) {
      console.error("[bots] BOT_ENCRYPTION_KEY is missing or not 64 hex characters");
      return NextResponse.json({ error: "Private bots aren't available right now" }, { status: 503 });
    }
    // AES-256-CBC, the scheme services/botManager.ts decrypts.
    const crypto = await import("crypto");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", new Uint8Array(Buffer.from(key, "hex")), new Uint8Array(iv));
    const encryptedToken = cipher.update(value, "utf8", "hex") + cipher.final("hex");

    const linked = await LinkedBotModel.create({
      ownerId: discordId,
      ownerUsername: session.user.name || "Dashboard user",
      botId: check.botId,
      botUsername: check.username,
      botAvatar: check.avatar,
      encryptedToken,
      tokenIv: iv.toString("hex"),
      status: "starting",
      lastStatusChange: new Date()
    });
    // Start it right away: the bot process picks this up within seconds.
    await BotCommand.create({
      type: "linked_bot_start",
      botId: check.botId,
      status: "pending",
      createdAt: new Date(),
      requestedBy: { id: discordId, username: session.user.name || "Dashboard user" }
    });

    const { encryptedToken: _secret, tokenIv: _iv, ...bot } = linked.toObject();
    return NextResponse.json({
      success: true,
      bot: { ...bot, inviteUrl: botInviteUrl(check.botId) },
      isPublic: check.isPublic,
      limit,
      count: count + 1
    });
  } catch (error) {
    console.error("[bots] link failed:", (error as Error)?.message ?? error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
