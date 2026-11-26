import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("patreon")
    .setDescription(i18n.__("patreon.description"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription(i18n.__("patreon.status.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync")
        .setDescription(i18n.__("patreon.sync.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription(i18n.__("patreon.info.description"))
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
      content: `⚠️ ${i18n.__("patreon.notConfigured")}`,
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
        .setTitle(`📊 ${i18n.__("patreon.status.title")}`)
        .setColor(0x808080)
        .setDescription(i18n.__("patreon.status.notLinked"))
        .addFields(
          {
            name: i18n.__("patreon.howToLink"),
            value: i18n.__mf("patreon.status.howToLinkSteps", { patreon: "https://www.patreon.com/" }),
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
      .setTitle(`📊 ${i18n.__("patreon.status.yourTitle")}`)
      .setColor(isPremium ? 0xF96854 : 0x808080)
      .addFields(
        { name: i18n.__("common.field.status"), value: `${statusEmoji} ${statusText}`, inline: true },
        { name: i18n.__("patreon.premiumActive"), value: isPremium ? `✅ ${i18n.__("common.yes")}` : `❌ ${i18n.__("common.no")}`, inline: true }
      )
      .setTimestamp();

    if (patronData.tierTitle) {
      embed.addFields({ name: i18n.__("common.field.tier"), value: patronData.tierTitle, inline: true });
    }

    if (patronData.pledgeAmountCents && patronData.pledgeAmountCents > 0) {
      const amount = (patronData.pledgeAmountCents / 100).toFixed(2);
      embed.addFields({ name: i18n.__("patreon.status.pledgeAmount"), value: i18n.__mf("patreon.status.perMonth", { amount: `$${amount}` }), inline: true });
    }

    if (patronData.lifetimeSupportCents && patronData.lifetimeSupportCents > 0) {
      const lifetime = (patronData.lifetimeSupportCents / 100).toFixed(2);
      embed.addFields({ name: i18n.__("patreon.status.lifetimeSupport"), value: `$${lifetime}`, inline: true });
    }

    if (patronData.lastChargeDate) {
      embed.addFields({
        name: i18n.__("patreon.status.lastCharge"),
        value: new Date(patronData.lastChargeDate).toLocaleDateString(),
        inline: true
      });
    }

    if (isPremium) {
      embed.setDescription(`🎉 ${i18n.__("patreon.status.thanks")}`);
    } else if (patronData.patronStatus === "declined_patron") {
      embed.setDescription(`⚠️ ${i18n.__("patreon.status.declined")}`);
    } else if (patronData.patronStatus === "former_patron") {
      embed.setDescription(i18n.__("patreon.status.former"));
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error("[Patreon] Error checking status:", error);
    await interaction.editReply({
      content: `❌ ${i18n.__("patreon.status.error")}`,
    });
  }
}

async function handleSync(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const patreonService = PatreonService.getInstance();

  if (!patreonService.isConfigured()) {
    await interaction.editReply({
      content: `⚠️ ${i18n.__("patreon.notConfigured")}`,
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
        .setTitle(`✅ ${i18n.__("patreon.sync.completeTitle")}`)
        .setColor(0x00FF00)
        .setDescription(i18n.__("patreon.sync.success"))
        .addFields(
          { name: i18n.__("common.field.status"), value: `${getStatusEmoji(result.status)} ${getStatusText(result.status)}`, inline: true },
          { name: i18n.__("patreon.premiumActive"), value: isPremium ? `✅ ${i18n.__("common.yes")}` : `❌ ${i18n.__("common.no")}`, inline: true }
        )
        .setTimestamp();

      if (result.tierTitle) {
        embed.addFields({ name: i18n.__("common.field.tier"), value: result.tierTitle, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle(`🔍 ${i18n.__("patreon.sync.title")}`)
        .setColor(0xFFAA00)
        .setDescription(i18n.__("patreon.sync.notFound"))
        .addFields(
          {
            name: i18n.__("patreon.howToLink"),
            value: i18n.__mf("patreon.sync.howToLinkSteps", { settings: "https://www.patreon.com/settings/profile" }),
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error("[Patreon] Error syncing:", error);
    await interaction.editReply({
      content: `❌ ${i18n.__("patreon.sync.error")}`,
    });
  }
}

async function handleInfo(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle(`🎁 ${i18n.__("patreon.info.title")}`)
    .setColor(0xF96854)
    .setDescription(i18n.__("patreon.info.intro"))
    .addFields(
      {
        name: `⭐ ${i18n.__("patreon.info.benefits")}`,
        value: i18n.__("patreon.info.benefitsList"),
        inline: false,
      },
      {
        name: `🔗 ${i18n.__("patreon.info.howToGet")}`,
        value: i18n.__mf("patreon.info.howToGetSteps", { patreon: "https://www.patreon.com/" }),
        inline: false,
      },
      {
        name: `❓ ${i18n.__("patreon.info.troubleshooting")}`,
        value: i18n.__("patreon.info.troubleshootingList"),
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
      return i18n.__("patreon.patronStatus.active");
    case "declined_patron":
      return i18n.__("patreon.patronStatus.declined");
    case "former_patron":
      return i18n.__("patreon.patronStatus.former");
    default:
      return i18n.__("patreon.patronStatus.none");
  }
}

export default command;
