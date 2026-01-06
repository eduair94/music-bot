import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder()
    .setName("endtime")
    .setDescription(i18n.__("endtime.description"))
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription(i18n.__("endtime.timeOption"))
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return safeReply(interaction, {
        content: i18n.__("endtime.notInVoice"),
        ephemeral: true,
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue) {
      return safeReply(interaction, {
        content: i18n.__("endtime.noQueue"),
        ephemeral: true,
      });
    }

    const currentTrack = queue.currentTrack;
    if (!currentTrack) {
      return safeReply(interaction, {
        content: i18n.__("endtime.noTrack"),
        ephemeral: true,
      });
    }

    const timeString = interaction.options.getString("time");

    if (!timeString) {
      return safeReply(interaction, {
        content: i18n.__mf("endtime.info", {
          duration: formatDuration(currentTrack.durationMS),
        }),
      });
    }

    const targetMs = parseTimeString(timeString);
    if (targetMs === null) {
      return safeReply(interaction, {
        content: i18n.__("endtime.invalidTime"),
        ephemeral: true,
      });
    }

    if (targetMs > currentTrack.durationMS) {
      return safeReply(interaction, {
        content: i18n.__mf("endtime.tooLong", {
          duration: formatDuration(currentTrack.durationMS),
        }),
        ephemeral: true,
      });
    }

    const currentTime = queue.node.streamTime;
    if (targetMs <= currentTime) {
      return safeReply(interaction, {
        content: i18n.__mf("endtime.tooEarly", {
          position: formatDuration(currentTime),
        }),
        ephemeral: true,
      });
    }

    return safeReply(interaction, {
      content: i18n.__mf("endtime.success", {
        time: formatDuration(targetMs),
        remaining: formatDuration(targetMs - currentTime),
      }),
    });
  },
};

function parseTimeString(timeStr: string): number | null {
  timeStr = timeStr.trim().toLowerCase();
  const colonMatch = timeStr.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    if (seconds < 60) {
      return (minutes * 60 + seconds) * 1000;
    }
  }
  const justSeconds = timeStr.match(/^(\d+)s?$/);
  if (justSeconds) {
    return parseInt(justSeconds[1], 10) * 1000;
  }
  const minSecMatch = timeStr.match(/^(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/);
  if (minSecMatch && (minSecMatch[1] || minSecMatch[2])) {
    const minutes = parseInt(minSecMatch[1] || "0", 10);
    const seconds = parseInt(minSecMatch[2] || "0", 10);
    return (minutes * 60 + seconds) * 1000;
  }
  return null;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return hours + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
  }
  return minutes + ":" + seconds.toString().padStart(2, "0");
}
