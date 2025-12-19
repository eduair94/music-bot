import { QueueRepeatMode } from "discord-player";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("loop").setDescription(i18n.__("loop.description")),
  execute(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!guildMember || !canModifyQueue(guildMember)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    // Try discord-player first (new fast system)
    const playerService = DiscordPlayerService.getInstance();
    const dpQueue = playerService.getQueue(interaction.guild!.id);
    
    if (dpQueue) {
      // Toggle between no repeat and track repeat
      const currentMode = dpQueue.repeatMode;
      const newMode = currentMode === QueueRepeatMode.TRACK ? QueueRepeatMode.OFF : QueueRepeatMode.TRACK;
      dpQueue.setRepeatMode(newMode);
      
      const isLooping = newMode === QueueRepeatMode.TRACK;
      const content = i18n.__mf("loop.result", { loop: isLooping ? i18n.__("common.on") : i18n.__("common.off") });
      return safeReply(interaction, content);
    }

    // Fall back to legacy queue system
    const queue = bot.queues.get(interaction.guild!.id);

    if (!queue) {
      return interaction.reply({ content: i18n.__("loop.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    queue.loop = !queue.loop;

    const content = i18n.__mf("loop.result", { loop: queue.loop ? i18n.__("common.on") : i18n.__("common.off") });

    safeReply(interaction, content);
  }
};
