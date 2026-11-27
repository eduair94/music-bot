import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { canUse, denialMessage, permissionConfigFor } from "../utils/permissions";

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

    // Votes count among the people listening in the bot's channel, at the
    // server's configured share (default 50%).
    const voiceChannel = queue.channel;
    if (!voiceChannel || member.voice.channelId !== voiceChannel.id) {
      return interaction.reply({ content: i18n.__("player.notInVoice"), ephemeral: true });
    }
    // Vote-skip is the server's escape hatch for members who may not skip
    // (permission rules, options.voteSkip); members denied "skip" by name or
    // role cannot vote either.
    const { voteSkip } = (await permissionConfigFor(interaction.guildId!)).options;
    if (!voteSkip.enabled) {
      return interaction.reply({ content: `🔒 ${i18n.__("permissions.voteSkipOff")}`, flags: MessageFlags.Ephemeral });
    }
    const verdict = await canUse(member, "skip");
    if (!verdict.ok && (verdict.reason === "denied_user" || verdict.reason === "denied_role")) {
      return interaction.reply({ content: denialMessage(verdict), flags: MessageFlags.Ephemeral });
    }

    const listeners = voiceChannel.members.filter(m => !m.user.bot).size;
    const share = Math.min(100, Math.max(1, voteSkip.percentage)) / 100;
    const requiredVotes = Math.max(1, Math.ceil(listeners * share));

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
