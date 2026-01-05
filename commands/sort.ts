import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { Track } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("sort")
    .setDescription("Sort the queue by title, author, or length")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Sort type")
        .setRequired(true)
        .addChoices(
          { name: "Title (A-Z)", value: "title" },
          { name: "Author (A-Z)", value: "author" },
          { name: "Length (Shortest first)", value: "length" },
          { name: "Length (Longest first)", value: "length_desc" }
        )
    ),
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
        content: "❌ Need at least 2 tracks in queue to sort." 
      }).catch(console.error);
    }

    const sortType = interaction.options.getString("type", true);
    
    // Get all tracks as array
    const tracks = queue.tracks.toArray();
    
    // Sort based on type
    let sortedTracks: Track[];
    let sortDescription: string;
    
    switch (sortType) {
      case "title":
        sortedTracks = tracks.sort((a, b) => 
          a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        );
        sortDescription = "title (A-Z)";
        break;
      case "author":
        sortedTracks = tracks.sort((a, b) => 
          (a.author || "").toLowerCase().localeCompare((b.author || "").toLowerCase())
        );
        sortDescription = "author (A-Z)";
        break;
      case "length":
        sortedTracks = tracks.sort((a, b) => a.durationMS - b.durationMS);
        sortDescription = "length (shortest first)";
        break;
      case "length_desc":
        sortedTracks = tracks.sort((a, b) => b.durationMS - a.durationMS);
        sortDescription = "length (longest first)";
        break;
      default:
        return interaction.editReply({ content: "❌ Invalid sort type." }).catch(console.error);
    }
    
    // Clear and re-add in sorted order
    queue.tracks.clear();
    for (const track of sortedTracks) {
      queue.tracks.add(track);
    }

    await logAction(interaction.guild!, interaction.user, "sort", sortDescription);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 📊 sorted the queue by ${sortDescription} (${tracks.length} tracks)`
    }).catch(console.error);
  }
};
