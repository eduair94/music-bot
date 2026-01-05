import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("reverse")
    .setDescription("Reverse the order of the queue"),
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

    if (!queue || queue.tracks.size < 2) {
      return interaction.editReply({ 
        content: "❌ Need at least 2 tracks in queue to reverse." 
      }).catch(console.error);
    }

    // Get all tracks as array
    const tracks = queue.tracks.toArray();
    
    // Clear and re-add in reverse order
    queue.tracks.clear();
    for (let i = tracks.length - 1; i >= 0; i--) {
      queue.tracks.add(tracks[i]);
    }

    await logAction(interaction.guild!, interaction.user, "reverse", `${tracks.length} tracks`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🔃 reversed the queue (${tracks.length} tracks)`
    }).catch(console.error);
  }
};
