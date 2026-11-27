import { isSameOrigin } from "@/lib/admin/guards";
import { commandContext, getGuildAccess, readPlaybackSnapshot, requireGroup } from "@/lib/guild-access";
import { BotCommand, IBotCommand } from "@/lib/models/BotCommand";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { commandGroup, isSnowflake } from "../../../../../../../shared/permissions";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Commands the dashboard may send (docs/plans/2026-11-27-dashboard-api.md). */
const DASHBOARD_COMMANDS = new Set([
  "play", "pause", "resume", "skip", "previous", "stop", "volume", "seek", "shuffle", "loop",
  "autoplay", "filter", "remove", "move", "skipto", "clear", "join", "leave", "search"
]);

const MAX_INSTANCE = 32;

type Params = Record<string, string | number | boolean>;
type Checked = { ok: true; params: Params } | { ok: false; error: string };

const isIndex = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * Keep primitive params only, then check the ones each command needs.
 * Volume is clamped to the server's maximum (the bot caps at 100 too).
 */
function checkParams(command: string, raw: unknown, maxVolume: number): Checked {
  const params: Params = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" ? value.length <= 500 : typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean") {
        params[key] = value as string | number | boolean;
      }
    }
  }
  const fail = (error: string): Checked => ({ ok: false, error });
  if ("voiceChannelId" in params && !isSnowflake(params.voiceChannelId)) return fail("voiceChannelId must be a channel id");

  switch (command) {
    case "play":
    case "search":
      if (typeof params.query !== "string" || !params.query.trim()) return fail("query is required");
      params.query = params.query.trim();
      break;
    case "join":
      if (!isSnowflake(params.voiceChannelId)) return fail("voiceChannelId is required");
      break;
    case "volume":
      if (typeof params.volume !== "number") return fail("volume must be a number");
      params.volume = Math.round(Math.min(maxVolume, Math.max(0, params.volume)));
      break;
    case "seek": {
      // Contract: `position`; the v1 player sends `seconds`.
      const at = params.position ?? params.seconds;
      if (typeof at !== "number" || at < 0) return fail("position must be a non-negative number");
      break;
    }
    case "loop":
      if (params.loopMode !== "off" && params.loopMode !== "track" && params.loopMode !== "queue") return fail("loopMode must be off, track or queue");
      break;
    case "autoplay":
      if (typeof params.enabled !== "boolean") return fail("enabled must be true or false");
      break;
    case "filter":
      if (typeof params.name !== "string" || !/^[a-z0-9_]{1,32}$/i.test(params.name)) return fail("name must be an effect name");
      if (typeof params.enabled !== "boolean") return fail("enabled must be true or false");
      break;
    case "remove":
    case "skipto":
      if (!isIndex(params.position)) return fail("position must be a queue index");
      break;
    case "move":
      if (!isIndex(params.from) || !isIndex(params.to)) return fail("from and to must be queue indexes");
      break;
  }
  return { ok: true, params };
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const command = typeof body.command === "string" ? body.command : "";
  if (!DASHBOARD_COMMANDS.has(command)) {
    return NextResponse.json({ error: "Invalid command" }, { status: 400 });
  }

  let instance: number | undefined;
  if (body.instance !== undefined && body.instance !== null) {
    if (typeof body.instance !== "number" || !Number.isInteger(body.instance) || body.instance < 1 || body.instance > MAX_INSTANCE) {
      return NextResponse.json({ error: `instance must be 1-${MAX_INSTANCE}` }, { status: 400 });
    }
    instance = body.instance;
  }

  const maxVolume = Math.min(100, Math.max(0, Number(access.settings?.maxVolume ?? 100)));
  const checked = checkParams(command, body.params, Number.isFinite(maxVolume) ? maxVolume : 100);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  // The server's rule for the command's group, with the same context the bot
  // uses (own song, alone with the bot).
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
          return NextResponse.json({
            success: true,
            message: updated.result,
            ...(updated.data !== undefined ? { data: updated.data } : {}),
            // v1 player reads `result`
            result: updated.result
          });
        }
        const message = updated.error || "Command failed";
        return NextResponse.json({ success: false, message, error: message }, { status: 400 });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Timeout - command is still pending
    return NextResponse.json({
      success: true,
      message: "Command queued",
      commandId: botCommand._id
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "ValidationError") {
      return NextResponse.json({ error: "The bot does not accept this command yet" }, { status: 400 });
    }
    console.error("Error creating command:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
