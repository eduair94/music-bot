import { CommandInteraction, EmbedBuilder, SlashCommandBuilder, version as djsVersion } from "discord.js";
import { bot } from "../index";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription(i18n.__("about.description")),
  cooldown: 5,
  async execute(interaction: CommandInteraction) {
    const client = interaction.client;
    
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const memoryUsage = process.memoryUsage();
    const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    const memoryTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);

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
            `**Users:** ${client.users.cache.size.toLocaleString()}`,
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
            `**Memory:** ${memoryUsed}MB / ${memoryTotal}MB`,
            `**Platform:** ${process.platform}`
          ].join("\n"),
          inline: true
        },
        {
          name: "🔗 Links",
          value: [
            `[Dashboard](${process.env.DASHBOARD_URL || 'https://your-dashboard.com'})`,
            `[Support Server](${process.env.SUPPORT_SERVER || 'https://discord.gg/5w6PErKpyK'})`,
            `[Invite Bot](https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands)`
          ].join(" • "),
          inline: false
        }
      )
      .setFooter({ text: i18n.__("about.footer") })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
