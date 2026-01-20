import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("patreon")
    .setDescription("Check your Patreon status and sync benefits")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check your current Patreon status and benefits")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync")
        .setDescription("Sync your Patreon data to update your benefits")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Learn about Patreon benefits and how to link your account")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "status":
        await handleStatus(interaction);
        break;
      case "sync":
        await handleSync(interaction);
        break;
      case "info":
        await handleInfo(interaction);
        break;
    }
  },
};

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const patreonService = PatreonService.getInstance();
  
  if (!patreonService.isConfigured()) {
    await interaction.editReply({
      content: "⚠️ Patreon integration is not configured for this bot.",
    });
    return;
  }

  const discordId = interaction.user.id;

  try {
    // Check if user has premium
    const isPremium = await patreonService.isPremiumUser(discordId);
    const patronData = await patreonService.getPatronByDiscordId(discordId);

    if (!patronData) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Patreon Status")
        .setColor(0x808080)
        .setDescription("You are not currently linked to a Patreon account.")
        .addFields(
          {
            name: "How to Link",
            value: [
              "1. Go to [Patreon](https://www.patreon.com/)",
              "2. Connect your Discord account in Settings → Connections",
              "3. Subscribe to our Patreon page",
              "4. Use `/patreon sync` to update your benefits",
            ].join("\n"),
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // User has patron data
    const statusEmoji = getStatusEmoji(patronData.patronStatus);
    const statusText = getStatusText(patronData.patronStatus);

    const embed = new EmbedBuilder()
      .setTitle("📊 Your Patreon Status")
      .setColor(isPremium ? 0xF96854 : 0x808080)
      .addFields(
        { name: "Status", value: `${statusEmoji} ${statusText}`, inline: true },
        { name: "Premium Active", value: isPremium ? "✅ Yes" : "❌ No", inline: true }
      )
      .setTimestamp();

    if (patronData.tierTitle) {
      embed.addFields({ name: "Tier", value: patronData.tierTitle, inline: true });
    }

    if (patronData.pledgeAmountCents && patronData.pledgeAmountCents > 0) {
      const amount = (patronData.pledgeAmountCents / 100).toFixed(2);
      embed.addFields({ name: "Pledge Amount", value: `$${amount}/month`, inline: true });
    }

    if (patronData.lifetimeSupportCents && patronData.lifetimeSupportCents > 0) {
      const lifetime = (patronData.lifetimeSupportCents / 100).toFixed(2);
      embed.addFields({ name: "Lifetime Support", value: `$${lifetime}`, inline: true });
    }

    if (patronData.lastChargeDate) {
      embed.addFields({ 
        name: "Last Charge", 
        value: new Date(patronData.lastChargeDate).toLocaleDateString(), 
        inline: true 
      });
    }

    if (isPremium) {
      embed.setDescription("🎉 Thank you for your support! You have access to premium features.");
    } else if (patronData.patronStatus === "declined_patron") {
      embed.setDescription("⚠️ Your last payment was declined. Please update your payment method on Patreon to restore benefits.");
    } else if (patronData.patronStatus === "former_patron") {
      embed.setDescription("Your pledge has ended. Renew on Patreon to restore your benefits!");
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error("[Patreon] Error checking status:", error);
    await interaction.editReply({
      content: "❌ An error occurred while checking your Patreon status. Please try again later.",
    });
  }
}

async function handleSync(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const patreonService = PatreonService.getInstance();
  
  if (!patreonService.isConfigured()) {
    await interaction.editReply({
      content: "⚠️ Patreon integration is not configured for this bot.",
    });
    return;
  }

  const discordId = interaction.user.id;

  try {
    // Trigger a sync of the user's patron data
    const result = await patreonService.syncSinglePatron(discordId);

    if (result.found) {
      const isPremium = await patreonService.isPremiumUser(discordId);
      
      const embed = new EmbedBuilder()
        .setTitle("✅ Patreon Sync Complete")
        .setColor(0x00FF00)
        .setDescription(result.message)
        .addFields(
          { name: "Status", value: `${getStatusEmoji(result.status)} ${getStatusText(result.status)}`, inline: true },
          { name: "Premium Active", value: isPremium ? "✅ Yes" : "❌ No", inline: true }
        )
        .setTimestamp();

      if (result.tierTitle) {
        embed.addFields({ name: "Tier", value: result.tierTitle, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle("🔍 Patreon Sync")
        .setColor(0xFFAA00)
        .setDescription("No Patreon account found linked to your Discord.")
        .addFields(
          {
            name: "How to Link",
            value: [
              "1. Go to [Patreon Settings](https://www.patreon.com/settings/profile)",
              "2. Click on **Connections**",
              "3. Connect your **Discord** account",
              "4. Make sure you're pledging to our campaign",
              "5. Run `/patreon sync` again",
            ].join("\n"),
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error("[Patreon] Error syncing:", error);
    await interaction.editReply({
      content: "❌ An error occurred while syncing your Patreon data. Please try again later.",
    });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("🎁 Patreon Benefits")
    .setColor(0xF96854)
    .setDescription("Support us on Patreon to unlock exclusive benefits!")
    .addFields(
      {
        name: "⭐ Premium Benefits",
        value: [
          "• Higher quality audio",
          "• Longer playlists",
          "• Priority queue",
          "• Exclusive commands",
          "• Early access to new features",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔗 How to Get Premium",
        value: [
          "1. Visit our [Patreon page](https://www.patreon.com/)",
          "2. Choose a tier that suits you",
          "3. Link your Discord in Patreon Settings → Connections",
          "4. Use `/patreon sync` to activate benefits",
        ].join("\n"),
        inline: false,
      },
      {
        name: "❓ Troubleshooting",
        value: [
          "• Make sure Discord is linked in your Patreon settings",
          "• Your payment must be successful (not declined)",
          "• Try `/patreon sync` after linking",
          "• Benefits update automatically every 30 minutes",
        ].join("\n"),
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getStatusEmoji(status: string | undefined): string {
  switch (status) {
    case "active_patron":
      return "🟢";
    case "declined_patron":
      return "🔴";
    case "former_patron":
      return "🟠";
    default:
      return "⚫";
  }
}

function getStatusText(status: string | undefined): string {
  switch (status) {
    case "active_patron":
      return "Active Patron";
    case "declined_patron":
      return "Payment Declined";
    case "former_patron":
      return "Former Patron";
    default:
      return "Not a Patron";
  }
}

export default command;
