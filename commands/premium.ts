import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { PatreonService } from "../services/patreon";
import { PremiumGuildService } from "../services/premiumGuild";

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
    .setDescription("Manage premium features and server links")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("link")
        .setDescription("Link this server to your Patreon account")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unlink")
        .setDescription("Unlink this server from your Patreon account")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all servers linked to your Patreon account")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Show premium status for this server")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("config")
        .setDescription("Configure premium settings for this server")
        .addIntegerOption((option) =>
          option
            .setName("bitrate")
            .setDescription("Audio bitrate in kbps")
            .setRequired(false)
            .addChoices(
              { name: "128 kbps", value: 128 },
              { name: "192 kbps", value: 192 },
              { name: "256 kbps", value: 256 },
              { name: "320 kbps (HQ)", value: 320 }
            )
        )
        .addStringOption((option) =>
          option
            .setName("identity")
            .setDescription("Custom bot identity for this server")
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
            .setTitle(result.success ? "✅ Server Linked" : "❌ Link Failed")
            .setDescription(result.message)
            .setTimestamp();

          if (result.success && result.guild) {
            const patron = await patreonService.getPatronByDiscordId(userId);
            const maxServers = await premiumService.getMaxServersForUser(userId);
            const currentServers = await premiumService.getUserServers(userId);

            embed.addFields(
              { name: "🎵 Audio Quality", value: `${result.guild.audioBitrate}kbps`, inline: true },
              { name: "🎸 Bot Identity", value: result.guild.customBotName === "indie" ? "Indie Music Bot" : result.guild.customBotName || "Premium", inline: true },
              { name: "📊 Server Slots", value: `${currentServers.length}/${maxServers}`, inline: true }
            );

            if (patron) {
              embed.addFields({ 
                name: "💎 Patreon Tier", 
                value: patron.tierTitle || "Supporter", 
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
            .setTitle(result.success ? "✅ Server Unlinked" : "❌ Unlink Failed")
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
            .setTitle("🗂️ Your Linked Servers")
            .setDescription(
              servers.length === 0
                ? "You haven't linked any servers yet.\n\nUse `/premium link` to link this server!"
                : servers
                    .map((s, i) => 
                      `**${i + 1}.** ${s.guildName || s.guildId}\n` +
                      `   🎵 ${s.audioBitrate}kbps • 🎸 ${s.customBotName === "indie" ? "Indie Music Bot" : s.customBotName || "Premium"}\n` +
                      `   📅 Linked: <t:${Math.floor(s.linkedAt.getTime() / 1000)}:R>`
                    )
                    .join("\n\n")
            )
            .addFields({ 
              name: "📊 Server Slots", 
              value: `${servers.length}/${maxServers} used`, 
              inline: true 
            })
            .setTimestamp();

          if (patron) {
            embed.addFields({ 
              name: "💎 Patreon Tier", 
              value: patron.tierTitle || "Supporter", 
              inline: true 
            });
          }

          if (!patron || !patron.isPremium) {
            embed.setDescription(
              "❌ You don't have an active Patreon membership.\n\n" +
              "Support us on Patreon to unlock premium features!"
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
            .setTitle(isPremium ? "✨ Premium Server" : "📭 Free Server")
            .setDescription(
              isPremium
                ? `This server has premium features enabled!`
                : `This server is using free tier.\n\nUse \`/premium link\` to enable premium features.`
            )
            .setTimestamp();

          if (isPremium && guild) {
            const qualityBadge = 
              guild.audioBitrate >= 320 ? "🎵 HQ 320kbps" :
              guild.audioBitrate >= 256 ? "🎵 256kbps" :
              guild.audioBitrate >= 192 ? "🎵 192kbps" :
              "🎵 128kbps";

            const identityLabel = 
              guild.customBotName === "indie" ? "🎸 Indie Music Bot" :
              guild.customBotName || "Bypass";

            embed.addFields(
              { name: "🎵 Audio Quality", value: qualityBadge, inline: true },
              { name: "🎸 Bot Identity", value: identityLabel, inline: true },
              { name: "📅 Linked", value: `<t:${Math.floor(guild.linkedAt.getTime() / 1000)}:R>`, inline: true }
            );

            if (guild.lastUsed) {
              embed.addFields({ 
                name: "⏰ Last Used", 
                value: `<t:${Math.floor(guild.lastUsed.getTime() / 1000)}:R>`, 
                inline: true 
              });
            }

            // Show who owns this premium link
            if (guild.discordId === userId) {
              embed.setFooter({ text: "You own this premium link" });
            } else {
              embed.setFooter({ text: "Premium provided by another user" });
            }
          } else {
            embed.addFields(
              { name: "🎵 Audio Quality", value: "🎵 128kbps (Free)", inline: true },
              { name: "🎸 Bot Identity", value: "Bypass", inline: true }
            );
          }

          return interaction.editReply({ embeds: [embed] });
        }

        case "config": {
          const bitrate = interaction.options.getInteger("bitrate");
          const identity = interaction.options.getString("identity");

          if (!bitrate && !identity) {
            return interaction.editReply({
              content: "❌ Please specify at least one setting to configure.\n\n" +
                       "Example: `/premium config bitrate:320 identity:indie`"
            });
          }

          const result = await premiumService.updateGuildSettings(guildId, userId, {
            audioBitrate: bitrate || undefined,
            customBotName: identity || undefined,
          });

          const embed = new EmbedBuilder()
            .setColor(result.success ? "#1DB954" : "#FF0000")
            .setTitle(result.success ? "⚙️ Settings Updated" : "❌ Update Failed")
            .setDescription(result.message)
            .setTimestamp();

          if (result.success) {
            const guild = await premiumService.getGuildSettings(guildId);
            if (guild) {
              embed.addFields(
                { name: "🎵 Audio Quality", value: `${guild.audioBitrate}kbps`, inline: true },
                { name: "🎸 Bot Identity", value: guild.customBotName === "indie" ? "Indie Music Bot" : guild.customBotName || "Premium", inline: true }
              );
            }
          }

          return interaction.editReply({ embeds: [embed] });
        }

        default:
          return interaction.editReply({ content: "❌ Unknown subcommand." });
      }
    } catch (error: any) {
      console.error("[premium] Error:", error);
      
      // Check for database connection errors and provide user-friendly message
      const errorMessage = error.message || "Unknown error";
      const isDbError = errorMessage.includes("buffering timed out") || 
                        errorMessage.includes("Database connection") ||
                        errorMessage.includes("ECONNREFUSED") ||
                        errorMessage.includes("MongoServerSelectionError") ||
                        errorMessage.includes("not available");
      
      if (isDbError) {
        return interaction.editReply({
          content: "❌ **Database Temporarily Unavailable**\n\n" +
                   "The bot is having trouble connecting to the database. " +
                   "Please try again in a few moments.\n\n" +
                   "If this issue persists, the bot administrator has been notified."
        });
      }
      
      return interaction.editReply({
        content: `❌ An error occurred: ${errorMessage}`
      });
    }
  }
};
