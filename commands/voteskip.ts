import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { logAction } from "../utils/actionLog";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

// Store active vote sessions per guild
const activeVotes: Map<string, { 
  voters: Set<string>, 
  required: number, 
  trackId: string,
  timeout: NodeJS.Timeout 
}> = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName("voteskip")
    .setDescription("Vote to skip the current track"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const guildId = interaction.guild!.id;

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(guildId);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: "❌ There is nothing playing." }).catch(console.error);
    }

    const voiceChannel = guildMember?.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    // Count listeners in voice channel (excluding bots)
    const listeners = voiceChannel.members.filter(m => !m.user.bot).size;
    
    // Get vote skip percentage from settings (default 50%)
    const settings = await GuildSettingsService.getInstance().getSettings(guildId);
    const votePercentage = settings.voteSkipPercentage || 50;
    const requiredVotes = Math.ceil(listeners * (votePercentage / 100));
    
    // At minimum, need 2 votes if more than 1 person
    const minVotes = listeners > 1 ? Math.max(2, requiredVotes) : 1;
    
    const currentTrackId = queue.currentTrack.url;
    let voteSession = activeVotes.get(guildId);

    // Check if vote is for the same track
    if (voteSession && voteSession.trackId !== currentTrackId) {
      // Clear old vote session
      clearTimeout(voteSession.timeout);
      activeVotes.delete(guildId);
      voteSession = undefined;
    }

    if (!voteSession) {
      // Create new vote session
      const timeout = setTimeout(() => {
        activeVotes.delete(guildId);
      }, 60000); // 1 minute timeout

      voteSession = {
        voters: new Set([interaction.user.id]),
        required: minVotes,
        trackId: currentTrackId,
        timeout
      };
      activeVotes.set(guildId, voteSession);
    } else {
      // Check if already voted
      if (voteSession.voters.has(interaction.user.id)) {
        return interaction.editReply({ 
          content: `❌ You already voted! (${voteSession.voters.size}/${voteSession.required} votes)`
        }).catch(console.error);
      }
      voteSession.voters.add(interaction.user.id);
    }

    const currentVotes = voteSession.voters.size;

    // Check if enough votes
    if (currentVotes >= minVotes) {
      // Clear vote session
      clearTimeout(voteSession.timeout);
      activeVotes.delete(guildId);
      
      // Skip the track
      const trackTitle = queue.currentTrack.title;
      queue.node.skip();
      
      await logAction(interaction.guild!, interaction.user, "voteskip", trackTitle);
      
      return interaction.editReply({ 
        content: `✅ Vote passed! (${currentVotes}/${minVotes} votes) Skipping **${trackTitle}**`
      }).catch(console.error);
    }

    return interaction.editReply({ 
      content: `🗳️ Vote registered! (${currentVotes}/${minVotes} votes needed to skip)`
    }).catch(console.error);
  }
};
