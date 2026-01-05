import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

function parseTimeToMs(timeStr: string): number | null {
  // Parse formats like "1:30", "90", "1m30s", "1m", "90s"
  const colonMatch = timeStr.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1]);
    const seconds = parseInt(colonMatch[2]);
    return (minutes * 60 + seconds) * 1000;
  }
  
  const msMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(ms|milliseconds?)$/i);
  if (msMatch) return parseFloat(msMatch[1]);
  
  const secMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?)?$/i);
  if (secMatch) return parseFloat(secMatch[1]) * 1000;
  
  const minSecMatch = timeStr.match(/^(\d+)m\s*(\d+)s$/i);
  if (minSecMatch) {
    return (parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2])) * 1000;
  }
  
  const minMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(m|min|minutes?)$/i);
  if (minMatch) return parseFloat(minMatch[1]) * 60 * 1000;
  
  // Plain number = seconds
  const plainNum = parseFloat(timeStr);
  if (!isNaN(plainNum)) return plainNum * 1000;
  
  return null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription(i18n.__("seek.description"))
    .addStringOption((option) =>
      option.setName("time").setDescription("Time to seek to (e.g., 1:30, 90, 1m30s)").setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("seek.errorNotQueue") }).catch(console.error);
    }

    const timeStr = interaction.options.getString("time", true);
    const seekMs = parseTimeToMs(timeStr);
    
    if (seekMs === null) {
      return interaction.editReply({ content: i18n.__("seek.errorInvalidTime") }).catch(console.error);
    }

    const duration = queue.currentTrack.durationMS;
    if (seekMs < 0 || seekMs >= duration) {
      return interaction.editReply({ 
        content: i18n.__mf("seek.errorOutOfRange", { duration: formatTime(duration) })
      }).catch(console.error);
    }

    await queue.node.seek(seekMs);
    await logAction(interaction.guild!, interaction.user, "seek", formatTime(seekMs));
    
    return interaction.editReply({ 
      content: i18n.__mf("seek.result", { time: formatTime(seekMs), author: interaction.user.id })
    }).catch(console.error);
  }
};
