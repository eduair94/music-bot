import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("removerange")
    .setDescription("Remove a range of tracks from the queue")
    .addIntegerOption((option) =>
      option
        .setName("start")
        .setDescription("Start position")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName("end")
        .setDescription("End position")
        .setRequired(true)
        .setMinValue(1)
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

    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: "❌ There is no queue." }).catch(console.error);
    }

    let start = interaction.options.getInteger("start", true);
    let end = interaction.options.getInteger("end", true);

    // Ensure start <= end
    if (start > end) {
      [start, end] = [end, start];
    }

    const queueSize = queue.tracks.size;
    if (start > queueSize || end > queueSize) {
      return interaction.editReply({ 
        content: `❌ Invalid range. Queue only has ${queueSize} tracks.`
      }).catch(console.error);
    }

    // Convert to 0-indexed
    const startIndex = start - 1;
    const endIndex = end - 1;
    const count = endIndex - startIndex + 1;

    // Get tracks array
    const tracks = queue.tracks.toArray();
    const removedTracks = tracks.slice(startIndex, endIndex + 1);
    
    // Clear queue and re-add without removed tracks
    queue.tracks.clear();
    for (let i = 0; i < tracks.length; i++) {
      if (i < startIndex || i > endIndex) {
        queue.tracks.add(tracks[i]);
      }
    }

    await logAction(interaction.guild!, interaction.user, "removerange", `${count} tracks (${start}-${end})`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> ❌ removed **${count}** tracks from positions ${start}-${end}`
    }).catch(console.error);
  }
};
