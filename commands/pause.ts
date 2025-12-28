import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder().setName("pause").setDescription(i18n.__("pause.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("pause.errorNotQueue") }).catch(console.error);
    }

    const trackTitle = queue.currentTrack.title;
    queue.node.pause();
    
    // Log the action
    await logAction(interaction.guild!, interaction.user, "pause", trackTitle);
    
    return interaction.editReply({ content: i18n.__mf("pause.result", { author: interaction.user.id }) }).catch(console.error);
  }
};
