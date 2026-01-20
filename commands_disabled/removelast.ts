import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("removelast")
    .setDescription("Remove the last track from the queue (undo)"),
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
      return interaction.editReply({ content: "❌ There is no queue." }).catch(console.error);
    }

    // Get the last track
    const lastTrack = queue.tracks.at(queue.tracks.size - 1);
    
    if (!lastTrack) {
      return interaction.editReply({ content: "❌ No tracks to remove." }).catch(console.error);
    }

    // Remove the last track
    queue.tracks.removeOne(track => track === lastTrack);

    await logAction(interaction.guild!, interaction.user, "removelast", lastTrack.title);

    return interaction.editReply({
      content: `<@${interaction.user.id}> ↩️ removed **${lastTrack.title}** from the queue (undo)`
    }).catch(console.error);
  }
};
