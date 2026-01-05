import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("nextup")
    .setDescription("Get information about the next track in queue"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue) {
      return interaction.editReply({ content: "❌ There is no active queue." }).catch(console.error);
    }

    const nextTrack = queue.tracks.at(0);
    
    if (!nextTrack) {
      return interaction.editReply({ 
        content: "📭 No upcoming tracks in the queue." 
      }).catch(console.error);
    }

    const embed = new EmbedBuilder()
      .setTitle("⏭️ Next Up")
      .setDescription(`**[${nextTrack.title}](${nextTrack.url})**`)
      .addFields(
        { name: "Artist", value: nextTrack.author || "Unknown", inline: true },
        { name: "Duration", value: nextTrack.duration || "Unknown", inline: true },
        { name: "Source", value: nextTrack.source || "Unknown", inline: true }
      )
      .setColor("#3498db");

    if (nextTrack.thumbnail) {
      embed.setThumbnail(nextTrack.thumbnail);
    }

    // Show queue position info
    const queueSize = queue.tracks.size;
    if (queueSize > 1) {
      embed.setFooter({ text: `${queueSize - 1} more tracks in queue` });
    }

    return interaction.editReply({ embeds: [embed] }).catch(console.error);
  }
};
