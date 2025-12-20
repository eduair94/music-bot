import { QueueRepeatMode } from "discord-player";
import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("loop").setDescription(i18n.__("loop.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!guildMember || !canModifyQueue(guildMember)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.reply({ 
        content: "❌ You need the DJ role to use this command.", 
        ephemeral: true 
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      return interaction.reply({ content: i18n.__("loop.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    // Toggle between no repeat and track repeat
    const currentMode = queue.repeatMode;
    const newMode = currentMode === QueueRepeatMode.TRACK ? QueueRepeatMode.OFF : QueueRepeatMode.TRACK;
    queue.setRepeatMode(newMode);
    
    const isLooping = newMode === QueueRepeatMode.TRACK;
    const content = i18n.__mf("loop.result", { loop: isLooping ? i18n.__("common.on") : i18n.__("common.off") });
    return safeReply(interaction, content);
  }
};
