import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { BotCommand } from "@/lib/models/BotCommand";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ botId: string }>;
}

/**
 * GET /api/user/bots/[botId]
 * Get details of a specific linked bot
 */
export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;

  try {
    await connectToDatabase();
    
    const bot = await LinkedBotModel.findOne({ 
      botId,
      ownerId: session.user.discordId 
    }).select("-encryptedToken -tokenIv").lean();

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    return NextResponse.json(bot);
  } catch (error) {
    console.error("Error fetching bot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/user/bots/[botId]
 * Unlink a bot (sends stop command first if running)
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;

  try {
    await connectToDatabase();
    
    const bot = await LinkedBotModel.findOne({ 
      botId,
      ownerId: session.user.discordId 
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // If bot is running, send stop command to the main bot process
    if (bot.status === "online" || bot.status === "starting") {
      await BotCommand.create({
        type: "linked_bot_stop",
        botId,
        status: "pending",
        createdAt: new Date(),
      });
      
      // Wait a moment for the stop command to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Delete the bot record
    await LinkedBotModel.deleteOne({ botId, ownerId: session.user.discordId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking bot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/user/bots/[botId]
 * Control a linked bot (start, stop, restart)
 */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;

  try {
    const { action } = await request.json();
    
    if (!action || !["start", "stop", "restart"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await connectToDatabase();
    
    const bot = await LinkedBotModel.findOne({ 
      botId,
      ownerId: session.user.discordId 
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // Validate action based on current status
    if (action === "start" && (bot.status === "online" || bot.status === "starting")) {
      return NextResponse.json({ error: "Bot is already running" }, { status: 400 });
    }
    if (action === "stop" && bot.status !== "online" && bot.status !== "starting") {
      return NextResponse.json({ error: "Bot is not running" }, { status: 400 });
    }

    // Create a command for the main bot process to handle
    await BotCommand.create({
      type: `linked_bot_${action}`,
      botId,
      status: "pending",
      createdAt: new Date(),
    });

    // Update bot status immediately for UI feedback
    if (action === "start") {
      await LinkedBotModel.updateOne({ botId }, { 
        status: "starting",
        lastStatusChange: new Date(),
      });
    } else if (action === "stop") {
      await LinkedBotModel.updateOne({ botId }, { 
        status: "stopped",
        lastStatusChange: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      action,
      message: `Bot ${action} command sent`,
    });
  } catch (error) {
    console.error("Error controlling bot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
