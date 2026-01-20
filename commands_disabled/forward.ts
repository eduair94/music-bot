import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("forward")
    .setDescription(i18n.__("forward.description"))
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("Number of seconds to skip forward")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(300)
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
      return interaction.editReply({ content: i18n.__("forward.errorNotQueue") }).catch(console.error);
    }

    const seconds = interaction.options.getInteger("seconds") || 10;
    const currentPosition = queue.node.streamTime;
    const duration = queue.currentTrack.durationMS;
    const newPosition = Math.min(currentPosition + (seconds * 1000), duration - 1000);
    
    if (newPosition >= duration - 1000) {
      return interaction.editReply({ content: i18n.__("forward.errorNearEnd") }).catch(console.error);
    }

    await queue.node.seek(newPosition);
    await logAction(interaction.guild!, interaction.user, "forward", `${seconds}s`);
    
    return interaction.editReply({ 
      content: i18n.__mf("forward.result", { 
        seconds: seconds, 
        position: formatTime(newPosition),
        author: interaction.user.id 
      })
    }).catch(console.error);
  }
};
