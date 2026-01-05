import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription(i18n.__("clear.description")),
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
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: i18n.__("clear.errorNotQueue") }).catch(console.error);
    }

    const clearedCount = queue.tracks.size;
    queue.tracks.clear();
    
    await logAction(interaction.guild!, interaction.user, "clear", `${clearedCount} tracks`);
    
    return interaction.editReply({ 
      content: i18n.__mf("clear.result", { count: clearedCount, author: interaction.user.id })
    }).catch(console.error);
  }
};
