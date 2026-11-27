import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { PatreonService } from "../services/patreon";
import { PremiumGuildService } from "../services/premiumGuild";
import { i18n } from "../utils/i18n";
import { targetKbps } from "../services/audioEncoder";
import { getQualityBadge } from "../utils/audioSettings";

/**
 * /premium command - Manage premium server links
 * 
 * Subcommands:
 * - link: Link current server to your Patreon account
 * - unlink: Unlink current server
 * - list: Show all your linked servers
 * - status: Show premium status for current server
 * - config: Configure premium settings for current server
 */
export default {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription(i18n.__("premium.description"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("link")
        .setDescription(i18n.__("premium.link.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unlink")
        .setDescription(i18n.__("premium.unlink.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription(i18n.__("premium.list.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription(i18n.__("premium.status.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("config")
        .setDescription(i18n.__("premium.config.description"))
        .addIntegerOption((option) =>
          option
            .setName("bitrate")
            .setDescription(i18n.__("premium.config.optionBitrate"))
            .setRequired(false)
            .addChoices(
              { name: "128 kbps", value: 128 },
              { name: "192 kbps", value: 192 },
              { name: "256 kbps", value: 256 },
              { name: "320 kbps (plays at 256, Discord's lossless maximum)", value: 320 }
            )
        )
        .addStringOption((option) =>
          option
            .setName("identity")
            .setDescription(i18n.__("premium.config.optionIdentity"))
            .setRequired(false)
        )
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;
    const guildName = interaction.guild!.name;
    const userId = interaction.user.id;

    const premiumService = PremiumGuildService.getInstance();
    const patreonService = PatreonService.getInstance();

    await interaction.deferReply({ ephemeral: true });

    try {
      switch (subcommand) {
        case "link": {
          const result = await premiumService.linkServer(userId, guildId, guildName);
          
          const embed = new EmbedBuilder()
            .setColor(result.success ? "#1DB954" : "#FF0000")
            .setTitle(result.success ? `✅ ${i18n.__("premium.link.successTitle")}` : `❌ ${i18n.__("premium.link.failTitle")}`)
            .setDescription(result.message)
            .setTimestamp();

          if (result.success && result.guild) {
            const patron = await patreonService.getPatronByDiscordId(userId);
            const maxServers = await premiumService.getMaxServersForUser(userId);
            const currentServers = await premiumService.getUserServers(userId);

            embed.addFields(
              { name: `🎵 ${i18n.__("premium.audioQuality")}`, value: getQualityBadge(targetKbps(result.guild.audioBitrate, null)), inline: true },
              { name: `🎸 ${i18n.__("premium.botIdentity")}`, value: result.guild.customBotName === "indie" ? "Indie Music Bot" : result.guild.customBotName || "Premium", inline: true },
              { name: `📊 ${i18n.__("premium.serverSlots")}`, value: `${currentServers.length}/${maxServers}`, inline: true }
            );

            if (patron) {
              embed.addFields({ 
                name: `💎 ${i18n.__("premium.patreonTier")}`, 
                value: patron.tierTitle || i18n.__("premium.supporter"), 
                inline: true 
              });
            }
          }

          return interaction.editReply({ embeds: [embed] });
        }

        case "unlink": {
          const result = await premiumService.unlinkServer(userId, guildId);
          
          const embed = new EmbedBuilder()
            .setColor(result.success ? "#1DB954" : "#FF0000")
            .setTitle(result.success ? `✅ ${i18n.__("premium.unlink.successTitle")}` : `❌ ${i18n.__("premium.unlink.failTitle")}`)
            .setDescription(result.message)
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        case "list": {
          const servers = await premiumService.getUserServers(userId);
          const maxServers = await premiumService.getMaxServersForUser(userId);
          const patron = await patreonService.getPatronByDiscordId(userId);

          const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setTitle(`🗂️ ${i18n.__("premium.list.title")}`)
            .setDescription(
              servers.length === 0
                ? i18n.__("premium.list.empty")
                : servers
                    .map((s, i) => 
                      `**${i + 1}.** ${s.guildName || s.guildId}\n` +
                      `   🎵 ${targetKbps(s.audioBitrate, null)}kbps • 🎸 ${s.customBotName === "indie" ? "Indie Music Bot" : s.customBotName || "Premium"}\n` +
                      `   📅 ${i18n.__mf("premium.list.linkedAt", { time: `<t:${Math.floor(s.linkedAt.getTime() / 1000)}:R>` })}`
                    )
                    .join("\n\n")
            )
            .addFields({ 
              name: `📊 ${i18n.__("premium.serverSlots")}`, 
              value: i18n.__mf("premium.list.slotsUsed", { used: servers.length, max: maxServers }), 
              inline: true 
            })
            .setTimestamp();

          if (patron) {
            embed.addFields({ 
              name: `💎 ${i18n.__("premium.patreonTier")}`, 
              value: patron.tierTitle || i18n.__("premium.supporter"), 
              inline: true 
            });
          }

          if (!patron || !patron.isPremium) {
            embed.setDescription(
              `❌ ${i18n.__("premium.list.noMembership")}`
            );
            embed.setColor("#FF0000");
          }

          return interaction.editReply({ embeds: [embed] });
        }

        case "status": {
          const guild = await premiumService.getGuildSettings(guildId);
          const isPremium = guild !== null && guild.isActive;

          const embed = new EmbedBuilder()
            .setColor(isPremium ? "#1DB954" : "#808080")
            .setTitle(isPremium ? `✨ ${i18n.__("premium.status.premiumTitle")}` : `📭 ${i18n.__("premium.status.freeTitle")}`)
            .setDescription(
              isPremium
                ? i18n.__("premium.status.premiumBody")
                : i18n.__("premium.status.freeBody")
            )
            .setTimestamp();

          if (isPremium && guild) {
            const qualityBadge = getQualityBadge(targetKbps(guild.audioBitrate, null));

            const identityLabel = 
              guild.customBotName === "indie" ? "🎸 Indie Music Bot" :
              guild.customBotName || "Bypass";

            embed.addFields(
              { name: `🎵 ${i18n.__("premium.audioQuality")}`, value: qualityBadge, inline: true },
              { name: `🎸 ${i18n.__("premium.botIdentity")}`, value: identityLabel, inline: true },
              { name: `📅 ${i18n.__("premium.status.linked")}`, value: `<t:${Math.floor(guild.linkedAt.getTime() / 1000)}:R>`, inline: true }
            );

            if (guild.lastUsed) {
              embed.addFields({ 
                name: `⏰ ${i18n.__("premium.status.lastUsed")}`, 
                value: `<t:${Math.floor(guild.lastUsed.getTime() / 1000)}:R>`, 
                inline: true 
              });
            }

            // Show who owns this premium link
            if (guild.discordId === userId) {
              embed.setFooter({ text: i18n.__("premium.status.ownFooter") });
            } else {
              embed.setFooter({ text: i18n.__("premium.status.otherFooter") });
            }
          } else {
            embed.addFields(
              { name: `🎵 ${i18n.__("premium.audioQuality")}`, value: `🎵 ${i18n.__("premium.status.freeQuality")}`, inline: true },
              { name: `🎸 ${i18n.__("premium.botIdentity")}`, value: "Bypass", inline: true }
            );
          }

          return interaction.editReply({ embeds: [embed] });
        }

        case "config": {
          const bitrate = interaction.options.getInteger("bitrate");
          const identity = interaction.options.getString("identity");

          if (!bitrate && !identity) {
            return interaction.editReply({
              content: `❌ ${i18n.__("premium.config.nothing")}`
            });
          }

          const result = await premiumService.updateGuildSettings(guildId, userId, {
            audioBitrate: bitrate || undefined,
            customBotName: identity || undefined,
          });

          const embed = new EmbedBuilder()
            .setColor(result.success ? "#1DB954" : "#FF0000")
            .setTitle(result.success ? `⚙️ ${i18n.__("premium.config.successTitle")}` : `❌ ${i18n.__("premium.config.failTitle")}`)
            .setDescription(result.message)
            .setTimestamp();

          if (result.success) {
            const guild = await premiumService.getGuildSettings(guildId);
            if (guild) {
              embed.addFields(
                { name: `🎵 ${i18n.__("premium.audioQuality")}`, value: getQualityBadge(targetKbps(guild.audioBitrate, null)), inline: true },
                { name: `🎸 ${i18n.__("premium.botIdentity")}`, value: guild.customBotName === "indie" ? "Indie Music Bot" : guild.customBotName || "Premium", inline: true }
              );
            }
          }

          return interaction.editReply({ embeds: [embed] });
        }

        default:
          return interaction.editReply({ content: `❌ ${i18n.__("common.unknownSubcommand")}` });
      }
    } catch (error: any) {
      console.error("[premium] Error:", error);
      
      // Check for database connection errors and provide user-friendly message
      const errorMessage = error.message || i18n.__("common.unknownError");
      const isDbError = errorMessage.includes("buffering timed out") || 
                        errorMessage.includes("Database connection") ||
                        errorMessage.includes("ECONNREFUSED") ||
                        errorMessage.includes("MongoServerSelectionError") ||
                        errorMessage.includes("not available");
      
      if (isDbError) {
        return interaction.editReply({
          content: `❌ ${i18n.__("premium.dbUnavailable")}`
        });
      }
      
      return interaction.editReply({
        content: `❌ ${i18n.__mf("premium.error", { error: errorMessage })}`
      });
    }
  }
};
