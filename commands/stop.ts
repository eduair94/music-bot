import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("stop").setDescription(i18n.__("stop.description")),
  execute(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!guildMember || !canModifyQueue(guildMember)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    // Try discord-player first (new fast system)
    const playerService = DiscordPlayerService.getInstance();
    const dpQueue = playerService.getQueue(interaction.guild!.id);
    
    if (dpQueue) {
      dpQueue.delete();
      return safeReply(interaction, i18n.__mf("stop.result", { author: interaction.user.id }));
    }

    // Fall back to legacy queue system
    const queue = bot.queues.get(interaction.guild!.id);

    if (!queue) {
      return interaction.reply(i18n.__("stop.errorNotQueue")).catch(console.error);
    }

    queue.stop();

    safeReply(interaction, i18n.__mf("stop.result", { author: interaction.user.id }));
  }
};
