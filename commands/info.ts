import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  version as djsVersion
} from "discord.js";
import { useQueue } from "discord-player";
import { commands as registeredCommands } from "../structs/commandRegistry";
import { DiscordPlayerService } from "../services/discordPlayer";
import { SUPPORT_INVITE_URL } from "../shared/links";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

/** "Off" / "Track" / "Queue" for a discord-player repeat mode. */
function loopModeLabel(repeatMode: number): string {
  return repeatMode === 0 ? i18n.__("common.loop.off") : repeatMode === 1 ? i18n.__("common.loop.track") : i18n.__("common.loop.queue");
}

export default {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription(i18n.__("info.description"))
    // About
    .addSubcommand(sub => sub
      .setName("about")
      .setDescription(i18n.__("info.about.description")))
    // FAQ
    .addSubcommand(sub => sub
      .setName("faq")
      .setDescription(i18n.__("info.faq.description")))
    // Support
    .addSubcommand(sub => sub
      .setName("support")
      .setDescription(i18n.__("info.support.description")))
    // Queue info
    .addSubcommand(sub => sub
      .setName("queue")
      .setDescription(i18n.__("info.queue.description")))
    // Current song info
    .addSubcommand(sub => sub
      .setName("song")
      .setDescription(i18n.__("info.song.description")))
    // Next up
    .addSubcommand(sub => sub
      .setName("nextup")
      .setDescription(i18n.__("info.nextup.description")))
    // Changelogs
    .addSubcommand(sub => sub
      .setName("changelogs")
      .setDescription(i18n.__("info.changelogs.description"))),

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
              name: `📊 ${i18n.__("info.about.statistics")}`,
              value: [
                `**${i18n.__("info.about.servers")}:** ${client.guilds.cache.size.toLocaleString()}`,
                `**${i18n.__("info.about.commands")}:** ${registeredCommands.size}`,
                `**${i18n.__("info.about.uptime")}:** ${uptimeString}`
              ].join("\n"),
              inline: true
            },
            {
              name: `💻 ${i18n.__("info.about.system")}`,
              value: [
                `**Node.js:** ${process.version}`,
                `**Discord.js:** v${djsVersion}`,
                `**${i18n.__("info.about.memory")}:** ${memoryUsed}MB`
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
        const supportUrl = process.env.SUPPORT_SERVER || SUPPORT_INVITE_URL;
        const embed = new EmbedBuilder()
          .setTitle(`🆘 ${i18n.__("info.support.title")}`)
          .setColor("#5865F2")
          .setDescription(`${i18n.__("info.support.body")}\n\n**[${i18n.__("info.support.join")}](${supportUrl})**`)
          .addFields(
            { name: `📝 ${i18n.__("info.support.reportIssues")}`, value: i18n.__("info.support.reportIssuesValue"), inline: true },
            { name: `💡 ${i18n.__("info.support.suggestions")}`, value: i18n.__("info.support.suggestionsValue"), inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case "queue": {
        const queue = useQueue(interaction.guildId!);

        if (!queue) {
          return interaction.reply({ content: `❌ ${i18n.__("info.queue.noQueue")}`, ephemeral: true });
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
          .setTitle(`📋 ${i18n.__("info.queue.title")}`)
          .setColor("#9b59b6")
          .addFields(
            { name: i18n.__("common.field.tracks"), value: `${tracks.length + (currentTrack ? 1 : 0)}`, inline: true },
            { name: i18n.__("common.field.duration"), value: `${hours}h ${mins}m`, inline: true },
            { name: i18n.__("info.queue.contributors"), value: `${uniqueUsers.size}`, inline: true },
            { name: i18n.__("common.field.loopMode"), value: loopModeLabel(queue.repeatMode), inline: true },
            { name: i18n.__("common.field.volume"), value: `${queue.node.volume}%`, inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      case "song": {
        const playerService = DiscordPlayerService.getInstance();
        const queue = playerService.getQueue(interaction.guild!.id);

        if (!queue || !queue.currentTrack) {
          return interaction.reply({ content: `❌ ${i18n.__("info.song.noTrack")}`, ephemeral: true });
        }

        const track = queue.currentTrack;
        const embed = new EmbedBuilder()
          .setTitle(`🎵 ${i18n.__("info.song.title")}`)
          .setColor("#1DB954")
          .setThumbnail(track.thumbnail || null)
          .addFields(
            { name: i18n.__("common.field.title"), value: track.title, inline: false },
            { name: i18n.__("common.field.artist"), value: track.author || i18n.__("common.unknown"), inline: true },
            { name: i18n.__("common.field.duration"), value: track.duration, inline: true },
            { name: i18n.__("common.field.requestedBy"), value: track.requestedBy ? `<@${track.requestedBy.id}>` : i18n.__("common.unknown"), inline: true },
            { name: i18n.__("common.field.source"), value: track.source || i18n.__("common.unknown"), inline: true }
          )
          .setURL(track.url);

        return interaction.reply({ embeds: [embed] });
      }

      case "nextup": {
        const queue = useQueue(interaction.guildId!);

        if (!queue || queue.tracks.size === 0) {
          return interaction.reply({ content: `❌ ${i18n.__("info.nextup.empty")}`, ephemeral: true });
        }

        const nextTracks = queue.tracks.toArray().slice(0, 5);
        const description = nextTracks.map((t, i) =>
          `**${i + 1}.** [${t.title}](${t.url}) - \`${t.duration}\``
        ).join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`⏭️ ${i18n.__("info.nextup.title")}`)
          .setColor("#3498db")
          .setDescription(description)
          .setFooter({ text: i18n.__mf("info.nextup.footer", { count: queue.tracks.size }) });

        return interaction.reply({ embeds: [embed] });
      }

      case "changelogs": {
        const embed = new EmbedBuilder()
          .setTitle(`📝 ${i18n.__("info.changelogs.title")}`)
          .setColor("#f39c12")
          .setDescription(i18n.__("info.changelogs.intro"))
          .addFields(
            { name: `🆕 ${i18n.__("info.changelogs.newFeatures")}`, value: i18n.__("info.changelogs.newFeaturesList"), inline: false },
            { name: `🔧 ${i18n.__("info.changelogs.improvements")}`, value: i18n.__("info.changelogs.improvementsList"), inline: false },
            { name: `🐛 ${i18n.__("info.changelogs.bugFixes")}`, value: i18n.__("info.changelogs.bugFixesList"), inline: false }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      default:
        return interaction.reply({ content: `❌ ${i18n.__("common.unknownSubcommand")}`, ephemeral: true });
    }
  }
};
