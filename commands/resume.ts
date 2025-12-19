import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("resume").setDescription(i18n.__("resume.description")),
  execute(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    // Try discord-player first (new fast system)
    const playerService = DiscordPlayerService.getInstance();
    const dpQueue = playerService.getQueue(interaction.guild!.id);
    
    if (dpQueue) {
      dpQueue.node.resume();
      const content = i18n.__mf("resume.resultNotPlaying", { author: interaction.user.id });
      return safeReply(interaction, content);
    }

    // Fall back to legacy queue system
    const queue = bot.queues.get(interaction.guild!.id);

    if (!queue) {
      return interaction.reply({ content: i18n.__("resume.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    if (queue.player.unpause()) {
      const content = i18n.__mf("resume.resultNotPlaying", { author: interaction.user.id });
      safeReply(interaction, content);
      return true;
    }

    const content = i18n.__("resume.errorPlaying");
    safeReply(interaction, content);
    return false;
  }
};
