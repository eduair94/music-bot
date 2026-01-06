import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

// Track voteskip votes per guild
const voteSkips = new Map<string, Set<string>>();

export default {
  data: new SlashCommandBuilder()
    .setName("voteskip")
    .setDescription(i18n.__("voteskip.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("voteskip.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || !queue.currentTrack) {
      return interaction.reply({
        content: i18n.__("voteskip.noQueue"),
        ephemeral: true
      });
    }

    const voiceChannel = member.voice.channel;
    const listeners = voiceChannel.members.filter(m => !m.user.bot).size;
    const requiredVotes = Math.ceil(listeners / 2);

    // Get or create vote set for this guild
    const guildId = interaction.guildId!;
    const trackId = queue.currentTrack.url;
    const voteKey = `${guildId}-${trackId}`;
    
    if (!voteSkips.has(voteKey)) {
      voteSkips.set(voteKey, new Set());
    }

    const votes = voteSkips.get(voteKey)!;
    
    // Check if user already voted
    if (votes.has(interaction.user.id)) {
      return interaction.reply({
        content: i18n.__("voteskip.alreadyVoted"),
        ephemeral: true
      });
    }

    // Add vote
    votes.add(interaction.user.id);
    const currentVotes = votes.size;

    // Check if we have enough votes
    if (currentVotes >= requiredVotes) {
      const skippedTrack = queue.currentTrack;
      queue.node.skip();
      voteSkips.delete(voteKey);

      const embed = new EmbedBuilder()
        .setTitle(i18n.__("voteskip.skippedTitle"))
        .setDescription(i18n.__mf("voteskip.skipped", { 
          title: skippedTrack.title 
        }))
        .setColor("#F8AA2A");

      return interaction.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("voteskip.title"))
      .setDescription(i18n.__mf("voteskip.voted", { 
        user: interaction.user.username,
        current: currentVotes,
        required: requiredVotes
      }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
