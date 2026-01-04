import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchUserGuilds, hasManagePermission } from "@/lib/discord";
import { connectToDatabase } from "@/lib/mongodb";
import { BotCommand, IBotCommand } from "@/lib/models/BotCommand";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

// POST a new command to the bot
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.accessToken || !session?.user) {
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
    const body = await request.json();
    const { command, params: cmdParams } = body;

    // Validate command
    const validCommands = ["play", "pause", "resume", "skip", "stop", "volume", "shuffle", "loop", "remove", "skipto", "move", "clear", "seek"];
    if (!validCommands.includes(command)) {
      return NextResponse.json({ error: "Invalid command" }, { status: 400 });
    }

    await connectToDatabase();

    // Create the command
    const botCommand = await BotCommand.create({
      guildId,
      command,
      params: cmdParams || {},
      status: "pending",
      requestedBy: {
        id: session.user.discordId || session.user.id || "unknown",
        username: session.user.name || "Dashboard User",
      },
      userId: session.user.discordId || session.user.id || "unknown",
    });

    // Wait for up to 5 seconds for the command to be processed
    const startTime = Date.now();
    const timeout = 5000;
    
    while (Date.now() - startTime < timeout) {
      const updatedCommand = await BotCommand.findById(botCommand._id).lean() as IBotCommand | null;
      
      if (updatedCommand && updatedCommand.status !== "pending" && updatedCommand.status !== "processing") {
        if (updatedCommand.status === "completed") {
          return NextResponse.json({ 
            success: true, 
            result: updatedCommand.result 
          });
        } else {
          return NextResponse.json({ 
            success: false, 
            error: updatedCommand.error || "Command failed" 
          }, { status: 400 });
        }
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Timeout - command is still pending
    return NextResponse.json({ 
      success: true, 
      message: "Command queued",
      commandId: botCommand._id 
    });

  } catch (error) {
    console.error("Error creating command:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET recent commands for a guild
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
    
    const commands = await BotCommand
      .find({ guildId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json(commands);
  } catch (error) {
    console.error("Error fetching commands:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
