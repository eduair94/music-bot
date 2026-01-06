import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { useQueue, Track } from "discord-player";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder()
    .setName("massmove")
    .setDescription(i18n.__("massmove.description"))
    .addStringOption((option) =>
      option
        .setName("indexes")
        .setDescription(i18n.__("massmove.indexesOption"))
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription(i18n.__("massmove.positionOption"))
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
      return safeReply(interaction, {
        content: i18n.__("massmove.notInVoice"),
        ephemeral: true,
      });
    }

    const queue = useQueue(interaction.guildId!);

    if (!queue || queue.tracks.size === 0) {
      return safeReply(interaction, {
        content: i18n.__("massmove.noQueue"),
        ephemeral: true,
      });
    }

    const indexesString = interaction.options.getString("indexes", true);
    const targetPosition = interaction.options.getInteger("position", true);

    const indexes = parseIndexes(indexesString, queue.tracks.size);

    if (indexes.length === 0) {
      return safeReply(interaction, {
        content: i18n.__("massmove.invalidIndexes"),
        ephemeral: true,
      });
    }

    if (targetPosition > queue.tracks.size) {
      return safeReply(interaction, {
        content: i18n.__mf("massmove.invalidPosition", { max: queue.tracks.size }),
        ephemeral: true,
      });
    }

    const sortedIndexes = [...indexes].sort((a, b) => b - a);
    const tracksToMove: Track[] = [];
    const trackTitles: string[] = [];

    const queueArray = queue.tracks.toArray();
    for (const idx of sortedIndexes) {
      if (idx >= 0 && idx < queueArray.length) {
        tracksToMove.unshift(queueArray[idx]);
        trackTitles.unshift(queueArray[idx].title);
      }
    }

    for (const idx of sortedIndexes) {
      if (idx >= 0 && idx < queue.tracks.size) {
        queue.removeTrack(idx);
      }
    }

    const adjustedPosition = Math.min(targetPosition - 1, queue.tracks.size);
    for (let i = tracksToMove.length - 1; i >= 0; i--) {
      queue.insertTrack(tracksToMove[i], adjustedPosition);
    }

    return safeReply(interaction, {
      content: i18n.__mf("massmove.success", {
        count: tracksToMove.length,
        position: targetPosition,
        tracks: trackTitles.slice(0, 5).join(", ") + (trackTitles.length > 5 ? "..." : ""),
      }),
    });
  },
};

function parseIndexes(input: string, maxIndex: number): number[] {
  const indexes = new Set<number>();
  const parts = input.split(/[\s,]+/);

  for (const part of parts) {
    if (part.includes("-")) {
      const rangeParts = part.split("-");
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end && i <= maxIndex; i++) {
            if (i >= 1) indexes.add(i - 1);
          }
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxIndex) {
        indexes.add(num - 1);
      }
    }
  }

  return Array.from(indexes);
}
