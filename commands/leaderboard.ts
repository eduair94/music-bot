import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

interface UserTrackCount {
  userId: string;
  username: string;
  count: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription(i18n.__("leaderboard.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    
    if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
      return interaction.reply({
        content: i18n.__("leaderboard.noQueue"),
        ephemeral: true
      });
    }

    // Count tracks per user
    const userCounts = new Map<string, UserTrackCount>();
    
    // Count current track
    if (queue.currentTrack?.requestedBy) {
      const userId = queue.currentTrack.requestedBy.id;
      userCounts.set(userId, {
        userId,
        username: queue.currentTrack.requestedBy.username,
        count: 1
      });
    }

    // Count queued tracks
    for (const track of queue.tracks.toArray()) {
      if (track.requestedBy) {
        const userId = track.requestedBy.id;
        const existing = userCounts.get(userId);
        if (existing) {
          existing.count++;
        } else {
          userCounts.set(userId, {
            userId,
            username: track.requestedBy.username,
            count: 1
          });
        }
      }
    }

    // Sort by count
    const sortedUsers = Array.from(userCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    if (sortedUsers.length === 0) {
      return interaction.reply({
        content: i18n.__("leaderboard.noData"),
        ephemeral: true
      });
    }

    // Create leaderboard text
    const medals = ["íµ‡", "íµˆ", "íµ‰"];
    const leaderboardText = sortedUsers
      .map((user, index) => {
        const prefix = index < 3 ? medals[index] : `**${index + 1}.**`;
        return `${prefix} <@${user.userId}> - ${user.count} tracks`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("leaderboard.title"))
      .setDescription(leaderboardText)
      .setColor("#F8AA2A")
      .setFooter({ 
        text: i18n.__mf("leaderboard.footer", { 
          total: queue.tracks.size + (queue.currentTrack ? 1 : 0) 
        }) 
      });

    return interaction.reply({ embeds: [embed] });
  }
};
