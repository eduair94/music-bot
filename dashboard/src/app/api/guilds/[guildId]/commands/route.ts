import { isSameOrigin } from "@/lib/admin/guards";
import { checkCommandParams, commandContext, DASHBOARD_COMMANDS, searchData } from "@/lib/dashboard-commands";
import { getGuildAccess, readPlaybackSnapshot, requireGroup } from "@/lib/guild-access";
import { BotCommand, IBotCommand } from "@/lib/models/BotCommand";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { FLEET_MAX_INSTANCES, parseInstance } from "../../../../../../../shared/fleet";
import { commandGroup } from "../../../../../../../shared/permissions";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Error body in the command response shape (`error` kept for older clients). */
function refused(message: string, status: number) {
  return NextResponse.json({ success: false, message, error: message }, { status });
}

// POST a new command to the bot
export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  let body: { command?: unknown; params?: unknown; instance?: unknown };
  try {
    body = await request.json();
  } catch {
    return refused("Invalid JSON", 400);
  }

  const command = typeof body.command === "string" ? body.command : "";
  if (!DASHBOARD_COMMANDS.has(command)) return refused("Invalid command", 400);

  let instance: number | undefined;
  if (body.instance !== undefined && body.instance !== null) {
    const parsed = typeof body.instance === "number" ? parseInstance(body.instance) : null;
    if (!parsed) return refused(`instance must be 1-${FLEET_MAX_INSTANCES}`, 400);
    instance = parsed;
  }

  const maxVolume = Math.min(100, Math.max(0, Number(access.settings?.maxVolume ?? 100)));
  const checked = checkCommandParams(command, body.params, Number.isFinite(maxVolume) ? maxVolume : 100);
  if (!checked.ok) return refused(checked.error, 400);

  // The server's rule for the command's group, with the same context the bot
  // uses (own song by its requester id, alone with the bot by the instance's
  // listener count). Positions are already 0-based here.
  const group = commandGroup(command);
  if (group) {
    const playback = await readPlaybackSnapshot(guildId, instance ?? 1);
    const denied = requireGroup(access, group, commandContext(access, command, checked.params, playback));
    if (denied) return denied;
  }

  try {
    await connectToDatabase();

    const botCommand = await BotCommand.create({
      guildId,
      command,
      params: checked.params,
      status: "pending",
      requestedBy: { id: access.userId, username: access.username },
      userId: access.userId,
      ...(instance !== undefined ? { instance } : {})
    });

    // Wait for the command to be processed. "play" runs the full bot pipeline
    // (search, playlists), so give it longer to report its result or refusal.
    const startTime = Date.now();
    const timeout = command === "play" || command === "search" ? 20000 : 5000;

    while (Date.now() - startTime < timeout) {
      const updated = (await BotCommand.findById(botCommand._id).lean()) as (IBotCommand & { data?: unknown }) | null;

      if (updated && updated.status !== "pending" && updated.status !== "processing") {
        if (updated.status === "completed") {
          const message = updated.result || "Done";
          const data = command === "search" ? searchData(updated.data) : updated.data;
          return NextResponse.json({
            success: true,
            message,
            ...(data !== undefined && data !== null ? { data } : {}),
            // v1 player reads `result`
            result: message
          });
        }
        return refused(updated.error || "Command failed", 400);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Timeout: the command is still pending. A search without results is of no use.
    if (command === "search") return refused("The bot did not answer in time, try again", 504);
    return NextResponse.json({
      success: true,
      message: "Command queued",
      result: "Command queued",
      commandId: botCommand._id
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "ValidationError") {
      return refused("The bot does not accept this command yet", 400);
    }
    console.error("Error creating command:", error);
    return refused("Internal server error", 500);
  }
}

// GET recent commands for a guild (any member)
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

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
