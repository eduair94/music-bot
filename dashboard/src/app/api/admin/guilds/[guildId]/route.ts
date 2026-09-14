import { adminJson, requireOwner } from "@/lib/admin-auth";
import { isSnowflake } from "@/lib/admin/guards";
import { BotEventModel, IBotEventRecord } from "@/lib/models/BotEvent";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { IPlaybackState, PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getBotGuildData } from "@/lib/redis";
import type { AdminGuildDetail, GuildEventRow } from "@/types/admin";
import { IGuildSettings } from "../../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

interface PremiumDoc {
  isActive: boolean;
  audioBitrate: number;
  discordId: string;
  linkedAt: Date;
}

function summarize(e: IBotEventRecord): GuildEventRow {
  const ts = new Date(e.ts).toISOString();
  switch (e.kind) {
    case "command":
      return {
        ts,
        kind: "command",
        ok: e.ok,
        summary: `/${e.command}${e.subcommand ? " " + e.subcommand : ""}${e.ok ? "" : " — " + (e.error || "failed")}`
      };
    case "track":
      return {
        ts,
        kind: `track:${e.event}`,
        ok: e.event !== "error",
        summary: `${e.title || "?"} · ${e.source || "?"}${e.error ? " — " + e.error : ""}`
      };
    case "guild":
      return {
        ts,
        kind: `guild:${e.event}`,
        summary: `${e.event === "join" ? "Bot joined" : "Bot left"} (${e.memberCount ?? "?"} members)`
      };
    default:
      return { ts, kind: `error:${e.scope}`, ok: false, summary: e.message || "Error" };
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { guildId } = await params;
  if (!isSnowflake(guildId)) return adminJson({ error: "Invalid guild id" }, 400);

  try {
    const guild = await getBotGuildData(guildId);
    await connectToDatabase();
    const d7 = new Date(Date.now() - 7 * 86400_000);
    const [settings, premium, playback, events, commands7d, tracks7d, topCommands, topRequesters] = await Promise.all([
      GuildSettingsModel.findOne({ guildId }).lean<IGuildSettings | null>(),
      PremiumGuild.findOne({ guildId, isActive: true }).lean<PremiumDoc | null>(),
      PlaybackState.findOne({ guildId }).lean<IPlaybackState | null>(),
      BotEventModel.find({ guildId }).sort({ ts: -1 }).limit(30).lean<IBotEventRecord[]>(),
      BotEventModel.countDocuments({ guildId, kind: "command", ts: { $gte: d7 } }),
      BotEventModel.countDocuments({ guildId, kind: "track", event: "start", ts: { $gte: d7 } }),
      BotEventModel.aggregate<{ _id: string; count: number }>([
        { $match: { guildId, kind: "command", ts: { $gte: d7 } } },
        { $group: { _id: "$command", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      BotEventModel.aggregate<{ _id: string; count: number }>([
        { $match: { guildId, kind: "track", event: "start", ts: { $gte: d7 }, requestedById: { $exists: true } } },
        { $group: { _id: "$requestedById", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    if (!guild && !settings && events.length === 0) return adminJson({ error: "Guild not found" }, 404);

    const body: AdminGuildDetail = {
      guild: guild
        ? {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: guild.memberCount,
            ownerId: guild.ownerId,
            joinedAt: guild.joinedAt,
            hasSettings: !!settings,
            isCurrentlyPlaying: playback?.isPlaying || false,
            premium: premium ? { active: premium.isActive, bitrate: premium.audioBitrate } : null,
            settingsSummary: null,
            activity7d: { commands: commands7d, tracks: tracks7d },
            playback: null
          }
        : null,
      settings: settings
        ? {
            djRoleId: settings.djRoleId,
            adminRoleId: settings.adminRoleId,
            language: settings.language,
            defaultVolume: settings.defaultVolume,
            maxVolume: settings.maxVolume,
            maxQueueSize: settings.maxQueueSize,
            maxSongDuration: settings.maxSongDuration,
            autoLeaveEmpty: settings.autoLeaveEmpty,
            announceNowPlaying: settings.announceNowPlaying,
            logChannelId: settings.logChannelId,
            allowedTextChannels: settings.allowedTextChannels,
            allowedVoiceChannels: settings.allowedVoiceChannels,
            blacklistedUsers: settings.blacklistedUsers,
            disabledCommands: settings.disabledCommands,
            totalSongsPlayed: settings.totalSongsPlayed,
            totalPlaytime: settings.totalPlaytime,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt
          }
        : null,
      premium: premium
        ? {
            active: premium.isActive,
            bitrate: premium.audioBitrate,
            discordId: premium.discordId,
            linkedAt: new Date(premium.linkedAt).toISOString()
          }
        : null,
      playback: playback
        ? {
            isPlaying: playback.isPlaying,
            isPaused: playback.isPaused,
            volume: playback.volume,
            queueSize: playback.queueSize,
            voiceChannelName: playback.voiceChannelName,
            currentTrack: playback.currentTrack,
            loopMode: playback.loopMode,
            audioBitrate: playback.audioBitrate,
            lastUpdated: new Date(playback.lastUpdated).toISOString()
          }
        : null,
      events: events.map(summarize),
      activity: {
        commands7d,
        tracks7d,
        topCommands: topCommands.map((r) => ({ command: r._id, count: r.count })),
        topRequesters: topRequesters.map((r) => ({ userId: r._id, count: r.count }))
      }
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/guilds/:id] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
