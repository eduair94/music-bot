import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  version as djsVersion
} from "discord.js";
import { useQueue } from "discord-player";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Bot information and help")
    // About
    .addSubcommand(sub => sub
      .setName("about")
      .setDescription("About this bot"))
    // FAQ
    .addSubcommand(sub => sub
      .setName("faq")
      .setDescription("Frequently asked questions"))
    // Support
    .addSubcommand(sub => sub
      .setName("support")
      .setDescription("Get support server link"))
    // Queue info
    .addSubcommand(sub => sub
      .setName("queue")
      .setDescription("Detailed queue information"))
    // Current song info
    .addSubcommand(sub => sub
      .setName("song")
      .setDescription("Current song details"))
    // Next up
    .addSubcommand(sub => sub
      .setName("nextup")
      .setDescription("Show next track in queue"))
    // Changelogs
    .addSubcommand(sub => sub
      .setName("changelogs")
      .setDescription("Recent updates and changes")),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client;

    switch (subcommand) {
      case "about": {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeString = `${days}d ${hours}h ${minutes}m`;

        const memoryUsage = process.memoryUsage();
        const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
          .setTitle(`🎵 ${client.user?.username}`)
          .setDescription(i18n.__("about.embedDescription"))
          .setColor("#F8AA2A")
          .setThumbnail(client.user?.displayAvatarURL() || null)
          .addFields(
            {
              name: "📊 Statistics",
              value: [
                `**Servers:** ${client.guilds.cache.size.toLocaleString()}`,
                `**Commands:** ${bot.slashCommandsMap.size}`,
                `**Uptime:** ${uptimeString}`
              ].join("\n"),
              inline: true
            },
            {
              name: "💻 System",
              value: [
                `**Node.js:** ${process.version}`,
                `**Discord.js:** v${djsVersion}`,
                `**Memory:** ${memoryUsed}MB`
              ].join("\n"),
              inline: true
            }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      case "faq": {
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("faq.title"))
          .setColor("#0099ff")
          .addFields(
            { name: i18n.__("faq.q1.question"), value: i18n.__("faq.q1.answer") },
            { name: i18n.__("faq.q2.question"), value: i18n.__("faq.q2.answer") },
            { name: i18n.__("faq.q3.question"), value: i18n.__("faq.q3.answer") },
            { name: i18n.__("faq.q4.question"), value: i18n.__("faq.q4.answer") }
          )
          .setFooter({ text: i18n.__("faq.footer") });

        return safeReply(interaction, { embeds: [embed] });
      }

      case "support": {
        const supportUrl = process.env.SUPPORT_SERVER || "https://discord.gg/5w6PErKpyK";
        const embed = new EmbedBuilder()
          .setTitle("🆘 Support")
          .setColor("#5865F2")
          .setDescription(`Need help? Join our support server:\n\n**[Click to Join](${supportUrl})**`)
          .addFields(
            { name: "📝 Report Issues", value: "Use `/info faq` first, then ask in support", inline: true },
            { name: "💡 Suggestions", value: "Share ideas in our suggestions channel", inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case "queue": {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue) {
          return interaction.reply({ content: "❌ No active queue.", ephemeral: true });
        }

        const tracks = queue.tracks.toArray();
        const currentTrack = queue.currentTrack;
        
        let totalDuration = currentTrack?.durationMS || 0;
        tracks.forEach(t => totalDuration += t.durationMS || 0);

        const hours = Math.floor(totalDuration / 3600000);
        const mins = Math.floor((totalDuration % 3600000) / 60000);

        const uniqueUsers = new Set<string>();
        if (currentTrack?.requestedBy) uniqueUsers.add(currentTrack.requestedBy.id);
        tracks.forEach(t => { if (t.requestedBy) uniqueUsers.add(t.requestedBy.id); });

        const embed = new EmbedBuilder()
          .setTitle("📋 Queue Information")
          .setColor("#9b59b6")
          .addFields(
            { name: "Tracks", value: `${tracks.length + (currentTrack ? 1 : 0)}`, inline: true },
            { name: "Duration", value: `${hours}h ${mins}m`, inline: true },
            { name: "Contributors", value: `${uniqueUsers.size}`, inline: true },
            { name: "Loop Mode", value: queue.repeatMode === 0 ? "Off" : queue.repeatMode === 1 ? "Track" : "Queue", inline: true },
            { name: "Volume", value: `${queue.node.volume}%`, inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case "song": {
        const playerService = DiscordPlayerService.getInstance();
        const queue = playerService.getQueue(interaction.guild!.id);
        
        if (!queue || !queue.currentTrack) {
          return interaction.reply({ content: "❌ No track playing.", ephemeral: true });
        }

        const track = queue.currentTrack;
        const embed = new EmbedBuilder()
          .setTitle("🎵 Now Playing")
          .setColor("#1DB954")
          .setThumbnail(track.thumbnail || null)
          .addFields(
            { name: "Title", value: track.title, inline: false },
            { name: "Artist", value: track.author || "Unknown", inline: true },
            { name: "Duration", value: track.duration, inline: true },
            { name: "Requested by", value: track.requestedBy ? `<@${track.requestedBy.id}>` : "Unknown", inline: true },
            { name: "Source", value: track.source || "Unknown", inline: true }
          )
          .setURL(track.url);

        return interaction.reply({ embeds: [embed] });
      }

      case "nextup": {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue || queue.tracks.size === 0) {
          return interaction.reply({ content: "❌ No tracks in queue.", ephemeral: true });
        }

        const nextTracks = queue.tracks.toArray().slice(0, 5);
        const description = nextTracks.map((t, i) => 
          `**${i + 1}.** [${t.title}](${t.url}) - \`${t.duration}\``
        ).join("\n");

        const embed = new EmbedBuilder()
          .setTitle("⏭️ Coming Up")
          .setColor("#3498db")
          .setDescription(description)
          .setFooter({ text: `${queue.tracks.size} tracks in queue` });

        return interaction.reply({ embeds: [embed] });
      }

      case "changelogs": {
        const embed = new EmbedBuilder()
          .setTitle("📝 Recent Updates")
          .setColor("#f39c12")
          .setDescription("Latest changes and improvements:")
          .addFields(
            { name: "🆕 New Features", value: "• Consolidated commands for better organization\n• Improved audio effects system\n• Enhanced queue management", inline: false },
            { name: "🔧 Improvements", value: "• Faster command response times\n• Better error handling\n• Reduced memory usage", inline: false },
            { name: "🐛 Bug Fixes", value: "• Fixed playback issues\n• Resolved queue sync problems", inline: false }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      default:
        return interaction.reply({ content: "❌ Unknown subcommand.", ephemeral: true });
    }
  }
};
