import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("length")
    .setDescription(i18n.__("length.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("length.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
      return interaction.reply({
        content: i18n.__("length.noQueue"),
        ephemeral: true
      });
    }

    const tracks = queue.tracks.toArray();
    const currentTrack = queue.currentTrack;
    
    let totalMs = 0;
    
    // Add current track remaining time
    if (currentTrack) {
      const currentProgress = queue.node.streamTime || 0;
      const currentDuration = currentTrack.durationMS || 0;
      totalMs += Math.max(0, currentDuration - currentProgress);
    }
    
    // Add all queued tracks
    for (const track of tracks) {
      totalMs += track.durationMS || 0;
    }

    const totalTracks = tracks.length + (currentTrack ? 1 : 0);
    
    // Format duration
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
    let durationStr = "";
    if (hours > 0) {
      durationStr = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      durationStr = `${minutes}m ${seconds}s`;
    } else {
      durationStr = `${seconds}s`;
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("length.title"))
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("length.totalTracks"), 
          value: totalTracks.toString(), 
          inline: true 
        },
        { 
          name: i18n.__("length.totalDuration"), 
          value: durationStr, 
          inline: true 
        }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
