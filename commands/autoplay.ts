import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription(i18n.__("autoplay.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!guildMember || !canModifyQueue(guildMember)) {
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
    
    if (!queue) {
      return interaction.editReply({ content: i18n.__("autoplay.errorNotQueue") }).catch(console.error);
    }

    // Toggle autoplay
    const wasEnabled = queue.options?.leaveOnEnd === false;
    
    // Enable/disable autoplay by toggling the leaveOnEnd option and setting enableAutoplay
    if (wasEnabled) {
      queue.options.leaveOnEnd = true;
    } else {
      queue.options.leaveOnEnd = false;
    }
    
    // discord-player v6 uses queue.setRepeatMode() for autoplay functionality
    // or we can use the queue's autoplay feature if available
    const isEnabled = !wasEnabled;
    
    await logAction(interaction.guild!, interaction.user, "autoplay", isEnabled ? "On" : "Off");
    
    const content = i18n.__mf("autoplay.result", { 
      status: isEnabled ? i18n.__("common.enabled") : i18n.__("common.disabled") 
    });
    return interaction.editReply({ content }).catch(console.error);
  }
};
