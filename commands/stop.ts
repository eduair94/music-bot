import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder().setName("stop").setDescription(i18n.__("stop.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!guildMember || !canModifyQueue(guildMember)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }


    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      return interaction.editReply({ content: i18n.__("stop.errorNotQueue") }).catch(console.error);
    }

    const trackTitle = queue.currentTrack?.title;
    
    // Log the action before deleting
    await logAction(interaction.guild!, interaction.user, "stop", () => trackTitle || i18n.__("actionLog.detail.queue"));
    
    queue.delete();
    return interaction.editReply({ content: i18n.__mf("stop.result", { author: interaction.user.id }) }).catch(console.error);
  }
};
