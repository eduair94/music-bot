import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import os from "os";

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
    .setDescription("Get bot statistics"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const client = interaction.client;
    const playerService = DiscordPlayerService.getInstance();
    const player = playerService.getPlayer();
    
    // Count active queues
    let activeQueues = 0;
    let totalTracksInQueues = 0;
    
    if (player) {
      const nodes = player.nodes.cache;
      nodes.forEach(queue => {
        if (queue && !queue.deleted) {
          activeQueues++;
          totalTracksInQueues += queue.tracks.size;
          if (queue.currentTrack) totalTracksInQueues++;
        }
      });
    }
    
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const embed = new EmbedBuilder()
      .setTitle("📈 Bot Statistics")
      .setColor("#3498db")
      .addFields(
        { 
          name: "🌐 Servers", 
          value: `${client.guilds.cache.size}`, 
          inline: true 
        },
        { 
          name: "👥 Users", 
          value: `${client.users.cache.size}`, 
          inline: true 
        },
        { 
          name: "📺 Channels", 
          value: `${client.channels.cache.size}`, 
          inline: true 
        },
        { 
          name: "🎵 Active Queues", 
          value: `${activeQueues}`, 
          inline: true 
        },
        { 
          name: "🎶 Tracks Playing", 
          value: `${totalTracksInQueues}`, 
          inline: true 
        },
        { 
          name: "⏱️ Uptime", 
          value: formatUptime(uptime), 
          inline: true 
        },
        { 
          name: "💾 Memory", 
          value: formatBytes(memUsage.heapUsed), 
          inline: true 
        },
        { 
          name: "🖥️ Platform", 
          value: `${os.platform()} ${os.arch()}`, 
          inline: true 
        },
        { 
          name: "🟢 Node.js", 
          value: process.version, 
          inline: true 
        }
      )
      .setFooter({ text: `Ping: ${client.ws.ping}ms` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(console.error);
  }
};
