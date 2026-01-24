import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import os from "os";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(" ") || "0s";
}

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View bot and session statistics")
    // Bot stats
    .addSubcommand(sub => sub
      .setName("bot")
      .setDescription("Show bot statistics"))
    // Uptime
    .addSubcommand(sub => sub
      .setName("uptime")
      .setDescription("Show bot uptime"))
    // Session leaderboard
    .addSubcommand(sub => sub
      .setName("leaderboard")
      .setDescription("Show queue leaderboard"))
    // History
    .addSubcommand(sub => sub
      .setName("history")
      .setDescription("Show recently played tracks"))
    // Session info
    .addSubcommand(sub => sub
      .setName("session")
      .setDescription("Show current session info")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client;
    const playerService = DiscordPlayerService.getInstance();
    const player = playerService.getPlayer();
    const queue = playerService.getQueue(interaction.guild!.id);

    switch (subcommand) {
      case "bot": {
        let activeQueues = 0;
        let totalTracksInQueues = 0;
        
        if (player) {
          const nodes = player.nodes.cache;
          nodes.forEach(q => {
            if (q && !q.deleted) {
              activeQueues++;
              totalTracksInQueues += q.tracks.size;
              if (q.currentTrack) totalTracksInQueues++;
            }
          });
        }
        
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const embed = new EmbedBuilder()
          .setTitle("📈 Bot Statistics")
          .setColor("#3498db")
          .addFields(
            { name: "🌐 Servers", value: `${client.guilds.cache.size}`, inline: true },
            { name: "👥 Users", value: `${client.users.cache.size}`, inline: true },
            { name: "📺 Channels", value: `${client.channels.cache.size}`, inline: true },
            { name: "🎵 Active Queues", value: `${activeQueues}`, inline: true },
            { name: "🎶 Tracks Playing", value: `${totalTracksInQueues}`, inline: true },
            { name: "⏱️ Uptime", value: formatUptime(uptime), inline: true },
            { name: "💾 Memory", value: formatBytes(memUsage.heapUsed), inline: true },
            { name: "🖥️ Platform", value: `${os.platform()} ${os.arch()}`, inline: true },
            { name: "📦 Node.js", value: process.version, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      case "uptime": {
        let seconds = Math.floor(bot.client.uptime! / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 24);

        seconds %= 60;
        minutes %= 60;
        hours %= 24;

        return interaction.editReply({ 
          content: i18n.__mf("uptime.result", { days, hours, minutes, seconds }) 
        }).catch(console.error);
      }

      case "leaderboard": {
        if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
          return interaction.editReply({ content: i18n.__("leaderboard.noQueue") }).catch(console.error);
        }

        const userCounts = new Map<string, { userId: string; username: string; count: number }>();
        
        if (queue.currentTrack?.requestedBy) {
          const userId = queue.currentTrack.requestedBy.id;
          userCounts.set(userId, {
            userId,
            username: queue.currentTrack.requestedBy.username,
            count: 1
          });
        }

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

        const sortedUsers = Array.from(userCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        if (sortedUsers.length === 0) {
          return interaction.editReply({ content: i18n.__("leaderboard.noData") }).catch(console.error);
        }

        const medals = ["🥇", "🥈", "🥉"];
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
          .setFooter({ text: i18n.__mf("leaderboard.footer", { total: queue.tracks.size + (queue.currentTrack ? 1 : 0) }) });

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      case "history": {
        if (!queue) {
          return interaction.editReply({ content: i18n.__("history.errorNotQueue") }).catch(console.error);
        }

        const history = queue.history;
        
        if (!history || history.tracks.size === 0) {
          return interaction.editReply({ content: i18n.__("history.errorEmpty") }).catch(console.error);
        }

        const tracks = history.tracks.toArray().slice(0, 10);
        
        const trackList = tracks.map((track, index) => 
          `**${index + 1}.** [${track.title}](${track.url}) - \`${track.duration}\``
        ).join("\n");

        const embed = new EmbedBuilder()
          .setTitle("📜 " + i18n.__("history.embedTitle"))
          .setDescription(trackList)
          .setColor("#5865F2")
          .setFooter({ text: i18n.__mf("history.footer", { count: history.tracks.size }) });

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      case "session": {
        if (!queue) {
          return interaction.editReply({ content: "❌ No active session in this server." }).catch(console.error);
        }

        const currentTrack = queue.currentTrack;
        const tracksInQueue = queue.tracks.size;
        const totalDuration = queue.tracks.toArray().reduce((acc, track) => {
          const duration = track.durationMS || 0;
          return acc + duration;
        }, currentTrack?.durationMS || 0);

        const embed = new EmbedBuilder()
          .setTitle("🎵 Session Info")
          .setColor("#9b59b6")
          .addFields(
            { name: "Now Playing", value: currentTrack ? `[${currentTrack.title}](${currentTrack.url})` : "Nothing", inline: false },
            { name: "Tracks in Queue", value: `${tracksInQueue}`, inline: true },
            { name: "Total Duration", value: formatUptime(Math.floor(totalDuration / 1000)), inline: true },
            { name: "Loop Mode", value: queue.repeatMode === 0 ? "Off" : queue.repeatMode === 1 ? "Track" : "Queue", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      default:
        return interaction.editReply({ content: "❌ Unknown subcommand." }).catch(console.error);
    }
  }
};
