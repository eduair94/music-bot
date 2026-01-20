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
    .setName("removeabsent")
    .setDescription(i18n.__("removeabsent.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: i18n.__("removeabsent.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.reply({
        content: i18n.__("removeabsent.noQueue"),
        ephemeral: true
      });
    }

    // Get IDs of users currently in the voice channel
    const presentUserIds = new Set(voiceChannel.members.map(m => m.id));

    // Find tracks to remove (from users not in voice channel)
    const tracksToRemove: number[] = [];
    const tracks = queue.tracks.toArray();
    
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      const requestedById = track.requestedBy?.id;
      
      if (requestedById && !presentUserIds.has(requestedById)) {
        tracksToRemove.push(i);
      }
    }

    if (tracksToRemove.length === 0) {
      return interaction.reply({
        content: i18n.__("removeabsent.noTracks"),
        ephemeral: true
      });
    }

    // Remove tracks (in reverse order to maintain correct indices)
    for (const index of tracksToRemove) {
      queue.removeTrack(index);
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("removeabsent.title"))
      .setDescription(i18n.__mf("removeabsent.success", { count: tracksToRemove.length }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
