import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("queueinfo")
    .setDescription("Get detailed information about the queue"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue) {
      return interaction.editReply({ content: "❌ There is no active queue." }).catch(console.error);
    }

    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray();
    const historyTracks = queue.history.tracks.toArray();
    
    // Calculate total duration
    let totalDurationMs = 0;
    if (currentTrack) {
      totalDurationMs += currentTrack.durationMS - queue.node.streamTime;
    }
    for (const track of tracks) {
      totalDurationMs += track.durationMS;
    }
    
    // Calculate already played duration
    let playedDurationMs = queue.node.streamTime;
    for (const track of historyTracks) {
      playedDurationMs += track.durationMS;
    }
    
    // Get unique requesters
    const requesters = new Set<string>();
    if (currentTrack?.requestedBy) requesters.add(currentTrack.requestedBy.id);
    for (const track of tracks) {
      if (track.requestedBy) requesters.add(track.requestedBy.id);
    }
    
    // Get active filters
    const activeFilters = queue.filters.ffmpeg.getFiltersEnabled();
    
    const embed = new EmbedBuilder()
      .setTitle("📋 Queue Information")
      .setColor("#3498db")
      .addFields(
        { 
          name: "🎵 Queue Size", 
          value: `${tracks.length} tracks`, 
          inline: true 
        },
        { 
          name: "⏱️ Total Duration", 
          value: formatDuration(totalDurationMs), 
          inline: true 
        },
        { 
          name: "👥 Contributors", 
          value: `${requesters.size} users`, 
          inline: true 
        },
        { 
          name: "📜 History", 
          value: `${historyTracks.length} tracks played`, 
          inline: true 
        },
        { 
          name: "🔊 Volume", 
          value: `${queue.node.volume}%`, 
          inline: true 
        },
        { 
          name: "🎛️ Filters", 
          value: activeFilters.length > 0 ? activeFilters.join(", ") : "None", 
          inline: true 
        }
      );

    // Loop status
    const loopStatus = [];
    if (queue.repeatMode === 1) loopStatus.push("🔂 Track Loop");
    if (queue.repeatMode === 2) loopStatus.push("🔁 Queue Loop");
    if (queue.repeatMode === 3) loopStatus.push("📻 Autoplay");
    
    if (loopStatus.length > 0) {
      embed.addFields({ name: "🔄 Loop Mode", value: loopStatus.join(", "), inline: false });
    }

    if (currentTrack) {
      embed.setThumbnail(currentTrack.thumbnail || null);
      embed.setFooter({ text: `Currently playing: ${currentTrack.title}` });
    }

    return interaction.editReply({ embeds: [embed] }).catch(console.error);
  }
};
