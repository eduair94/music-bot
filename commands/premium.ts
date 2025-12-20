import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";

export default {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("View or manage premium status")
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current premium status")
    )
    .addSubcommand((sub) =>
      sub.setName("features").setDescription("View premium features comparison")
    )
    .addSubcommand((sub) =>
      sub
        .setName("activate")
        .setDescription("Activate premium (Bot Owner Only)")
        .addStringOption((opt) =>
          opt
            .setName("tier")
            .setDescription("Premium tier to activate")
            .setRequired(true)
            .addChoices(
              { name: "Basic", value: "basic" },
              { name: "Pro", value: "pro" },
              { name: "Enterprise", value: "enterprise" }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Duration in days (0 = lifetime)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(365)
        )
        .addStringOption((opt) =>
          opt
            .setName("guild")
            .setDescription("Guild ID to activate (leave empty for current)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("deactivate")
        .setDescription("Deactivate premium (Bot Owner Only)")
        .addStringOption((opt) =>
          opt
            .setName("guild")
            .setDescription("Guild ID to deactivate (leave empty for current)")
        )
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const settingsService = GuildSettingsService.getInstance();
    const subcommand = interaction.options.getSubcommand();
    
    // Bot owner ID - you should set this in your config
    const BOT_OWNER_ID = process.env.BOT_OWNER_ID || "";

    switch (subcommand) {
      case "status": {
        const guildId = interaction.guild!.id;
        const settings = await settingsService.getSettings(guildId);

        const embed = new EmbedBuilder()
          .setTitle("⭐ Premium Status")
          .setColor(settings.premium.enabled ? 0xFFD700 : 0x808080);

        if (settings.premium.enabled) {
          const features = [];
          if (settings.premium.customBranding) features.push("✅ Custom Branding");
          if (settings.premium.prioritySupport) features.push("✅ Priority Support");
          if (settings.premium.analytics) features.push("✅ Analytics Access");
          if (settings.premium.maxConcurrentListeners > 0) {
            features.push(`✅ Max Listeners: ${settings.premium.maxConcurrentListeners}`);
          }

          embed.addFields(
            {
              name: "Status",
              value: `**Active** - ${settings.premium.tier.toUpperCase()} Tier`,
              inline: true,
            },
            {
              name: "Expires",
              value: settings.premium.expiresAt
                ? `<t:${Math.floor(settings.premium.expiresAt.getTime() / 1000)}:R>`
                : "Never (Lifetime)",
              inline: true,
            },
            {
              name: "Features",
              value: features.length > 0 ? features.join("\n") : "Standard features",
              inline: false,
            }
          );
        } else {
          embed.setDescription(
            "This server does not have premium active.\n\n" +
            "Use `/premium features` to see what you're missing!"
          );
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case "features": {
        const embed = new EmbedBuilder()
          .setTitle("⭐ Premium Features")
          .setColor(0xFFD700)
          .setDescription("Unlock the full potential of your music bot!")
          .addFields(
            {
              name: "��� Free Tier",
              value: [
                "• Basic music playback",
                "• Queue up to 100 songs",
                "• DJ role configuration",
                "• Channel restrictions",
                "• User blacklist",
              ].join("\n"),
              inline: true,
            },
            {
              name: "��� Basic Tier",
              value: [
                "• Everything in Free",
                "• Queue up to 500 songs",
                "• Custom embed colors",
                "• Server analytics",
                "• Priority queue loading",
              ].join("\n"),
              inline: true,
            },
            {
              name: "�� Pro Tier",
              value: [
                "• Everything in Basic",
                "• Queue up to 1000 songs",
                "• Priority support",
                "• Audio filters",
                "• 24/7 mode option",
              ].join("\n"),
              inline: true,
            },
            {
              name: "��� Enterprise",
              value: [
                "• Everything in Pro",
                "• Unlimited queue",
                "• Custom branding",
                "• API access",
                "• Dedicated support",
                "• Multi-server management",
              ].join("\n"),
              inline: false,
            },
            {
              name: "��� Get Premium",
              value: "Contact the bot developer to purchase premium for your server!",
              inline: false,
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case "activate": {
        // Only bot owner can activate premium
        if (interaction.user.id !== BOT_OWNER_ID) {
          return interaction.reply({
            content: "❌ Only the bot owner can activate premium.",
            ephemeral: true,
          });
        }

        const tier = interaction.options.getString("tier", true) as "basic" | "pro" | "enterprise";
        const days = interaction.options.getInteger("days", true);
        const targetGuildId = interaction.options.getString("guild") || interaction.guild!.id;

        const expiresAt = days > 0 
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) 
          : null;

        // Set premium features based on tier
        const premiumConfig = {
          enabled: true,
          tier,
          expiresAt,
          maxConcurrentListeners: tier === "enterprise" ? 0 : tier === "pro" ? 50 : 25,
          customBranding: tier === "enterprise",
          prioritySupport: tier === "pro" || tier === "enterprise",
          analytics: true,
        };

        // Update queue limits based on tier
        const queueLimit = tier === "enterprise" ? 1000 : tier === "pro" ? 1000 : 500;

        await settingsService.updateSettings(targetGuildId, {
          premium: premiumConfig,
          maxQueueSize: queueLimit,
        });

        return interaction.reply({
          content: `✅ Premium **${tier.toUpperCase()}** activated for guild \`${targetGuildId}\`!\n` +
            `Expires: ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : "Never"}`,
          ephemeral: true,
        });
      }

      case "deactivate": {
        // Only bot owner can deactivate premium
        if (interaction.user.id !== BOT_OWNER_ID) {
          return interaction.reply({
            content: "❌ Only the bot owner can deactivate premium.",
            ephemeral: true,
          });
        }

        const targetGuildId = interaction.options.getString("guild") || interaction.guild!.id;

        await settingsService.updateSettings(targetGuildId, {
          premium: {
            enabled: false,
            tier: "free",
            expiresAt: null,
            maxConcurrentListeners: 0,
            customBranding: false,
            prioritySupport: false,
            analytics: false,
          },
          maxQueueSize: 100, // Reset to free tier limit
        });

        return interaction.reply({
          content: `✅ Premium deactivated for guild \`${targetGuildId}\`.`,
          ephemeral: true,
        });
      }

      default:
        return interaction.reply({
          content: "❌ Unknown subcommand.",
          ephemeral: true,
        });
    }
  },
};
