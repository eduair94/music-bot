import { adminJson, requireOwner } from "@/lib/admin-auth";
import { BotEventModel } from "@/lib/models/BotEvent";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { IPlaybackState, PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getAllBotGuildsData } from "@/lib/redis";
import type { AdminGuild, AdminGuildsResponse } from "@/types/admin";
import { IGuildSettings } from "../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface PremiumRow {
  guildId: string;
  isActive: boolean;
  audioBitrate: number;
}
interface ActivityRow {
  _id: string;
  commands: number;
  tracks: number;
  last: Date;
}

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;

  try {
    const guilds = await getAllBotGuildsData();
    const guildIds = guilds.map((g) => g.id);
    const d7 = new Date(Date.now() - 7 * 86400_000);

    let settingsData: IGuildSettings[] = [];
    let playbackData: IPlaybackState[] = [];
    let premiumData: PremiumRow[] = [];
    let activityData: ActivityRow[] = [];
    try {
      await connectToDatabase();
      [settingsData, playbackData, premiumData, activityData] = await Promise.all([
        GuildSettingsModel.find({ guildId: { $in: guildIds } }).lean<IGuildSettings[]>(),
        PlaybackState.find({ guildId: { $in: guildIds } }).lean<IPlaybackState[]>(),
        PremiumGuild.find({ guildId: { $in: guildIds }, isActive: true })
          .select("guildId isActive audioBitrate")
          .lean<PremiumRow[]>(),
        BotEventModel.aggregate<ActivityRow>([
          { $match: { guildId: { $in: guildIds }, kind: { $in: ["command", "track"] }, ts: { $gte: d7 } } },
          {
            $group: {
              _id: "$guildId",
              commands: { $sum: { $cond: [{ $eq: ["$kind", "command"] }, 1, 0] } },
              tracks: {
                $sum: { $cond: [{ $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "start"] }] }, 1, 0] }
              },
              last: { $max: "$ts" }
            }
          }
        ])
      ]);
    } catch (dbError) {
      console.error("[admin/guilds] MongoDB unavailable, serving Redis-only data:", dbError);
    }

    const settingsMap = new Map(settingsData.map((s) => [s.guildId, s]));
    const playbackMap = new Map(playbackData.map((p) => [p.guildId, p]));
    const premiumMap = new Map(premiumData.map((p) => [p.guildId, p]));
    const activityMap = new Map(activityData.map((a) => [a._id, a]));

    const rows: AdminGuild[] = guilds.map((guild) => {
      const settings = settingsMap.get(guild.id);
      const playback = playbackMap.get(guild.id);
      const premium = premiumMap.get(guild.id);
      const activity = activityMap.get(guild.id);
      const lastCandidates = [playback?.lastUpdated, activity?.last]
        .filter((d): d is Date => !!d)
        .map((d) => new Date(d).getTime());
      const lastActive = lastCandidates.length ? new Date(Math.max(...lastCandidates)).toISOString() : undefined;

      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        hasSettings: !!settings,
        isCurrentlyPlaying: playback?.isPlaying || false,
        lastActive,
        premium: premium ? { active: premium.isActive, bitrate: premium.audioBitrate } : null,
        settingsSummary: settings
          ? {
              djRoleId: settings.djRoleId ?? null,
              language: settings.language,
              maxQueueSize: settings.maxQueueSize,
              logChannelId: settings.logChannelId ?? null,
              totalSongsPlayed: settings.totalSongsPlayed || 0,
              totalPlaytime: settings.totalPlaytime || 0
            }
          : null,
        activity7d: { commands: activity?.commands || 0, tracks: activity?.tracks || 0 },
        playback: playback
          ? {
              isPlaying: playback.isPlaying,
              isPaused: playback.isPaused,
              currentTrack: playback.currentTrack?.title ?? null,
              queueSize: playback.queueSize || 0,
              voiceChannelName: playback.voiceChannelName ?? null
            }
          : null
      };
    });

    rows.sort((a, b) => b.memberCount - a.memberCount);

    const body: AdminGuildsResponse = {
      guilds: rows,
      stats: {
        totalGuilds: guilds.length,
        totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
        activeGuilds: playbackData.filter((p) => p.isPlaying).length,
        guildsWithSettings: settingsData.length,
        premiumGuilds: premiumData.length
      }
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/guilds] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
