import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("removeduplicates")
    .setDescription("Remove all duplicate tracks from the queue"),
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

    const tracks = queue.tracks.toArray();
    const originalCount = tracks.length;
    
    // Use URL as unique identifier
    const seen = new Set<string>();
    const uniqueTracks = tracks.filter(track => {
      const identifier = track.url || track.title;
      if (seen.has(identifier)) {
        return false;
      }
      seen.add(identifier);
      return true;
    });
    
    const removedCount = originalCount - uniqueTracks.length;
    
    if (removedCount === 0) {
      return interaction.editReply({ 
        content: "✅ No duplicate tracks found in the queue."
      }).catch(console.error);
    }
    
    // Clear queue and re-add unique tracks
    queue.tracks.clear();
    for (const track of uniqueTracks) {
      queue.tracks.add(track);
    }

    await logAction(interaction.guild!, interaction.user, "removeduplicates", `${removedCount} duplicates`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🗑️ removed **${removedCount}** duplicate track(s)`
    }).catch(console.error);
  }
};
