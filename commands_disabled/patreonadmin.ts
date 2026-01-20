import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { config } from "../utils/config";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("patreonadmin")
    .setDescription("Patreon administration commands (Bot owner only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("getcampaign")
        .setDescription("Get your Patreon campaign ID")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("verify")
        .setDescription("Verify Patreon API credentials are working")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync")
        .setDescription("Manually sync all patrons from Patreon")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check Patreon configuration status")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("createwebhook")
        .setDescription("Create/register a Patreon webhook via API")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("listwebhooks")
        .setDescription("List all webhooks registered for your campaign")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("deletewebhook")
        .setDescription("Delete a webhook by ID")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The webhook ID to delete")
            .setRequired(true)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // Check if user is bot owner
    const botOwnerId = config.OWNER_ID;
    if (botOwnerId && interaction.user.id !== botOwnerId) {
      await interaction.reply({
        content: "❌ This command is only available to the bot owner.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "getcampaign":
        await handleGetCampaign(interaction);
        break;
      case "verify":
        await handleVerify(interaction);
        break;
      case "sync":
        await handleSync(interaction);
        break;
      case "status":
        await handleStatus(interaction);
        break;
      case "createwebhook":
        await handleCreateWebhook(interaction);
        break;
      case "listwebhooks":
        await handleListWebhooks(interaction);
        break;
      case "deletewebhook":
        await handleDeleteWebhook(interaction);
        break;
    }
  },
};

async function handleGetCampaign(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!config.PATREON_CREATOR_ACCESS_TOKEN) {
    await interaction.editReply({
      content: "❌ **PATREON_CREATOR_ACCESS_TOKEN** is not configured in config.json",
    });
    return;
  }

  try {
    // Make direct API call to get campaigns
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/campaigns", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      await interaction.editReply({
        content: `❌ **API Error** (${response.status}): ${errorText}\n\nMake sure your Creator Access Token is valid and has the correct scopes.`,
      });
      return;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      await interaction.editReply({
        content: "❌ No campaigns found for this account. Make sure you have a Patreon creator account.",
      });
      return;
    }

    const campaigns = data.data;
    
    const embed = new EmbedBuilder()
      .setTitle(" Your Patreon Campaigns")
      .setColor(0xF96854)
      .setDescription("Here are the campaigns found on your Patreon account:")
      .setTimestamp();

    for (const campaign of campaigns) {
      embed.addFields({
        name: `Campaign ID: \`${campaign.id}\``,
        value: `Add this to your config.json:\n\`\`\`json\n"PATREON_CAMPAIGN_ID": "${campaign.id}"\n\`\`\``,
        inline: false,
      });
    }

    embed.addFields({
      name: " Next Steps",
      value: "1. Copy the Campaign ID above\n2. Add it to your `config.json`\n3. Run `/patreonadmin verify` to test",
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ **Error fetching campaigns:** ${error.message}`,
    });
  }
}

async function handleVerify(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const checks: { name: string; status: boolean; message: string }[] = [];

  // Check 1: Creator Access Token configured
  const hasToken = !!config.PATREON_CREATOR_ACCESS_TOKEN;
  checks.push({
    name: "Creator Access Token",
    status: hasToken,
    message: hasToken ? "Token is configured" : "Missing in config.json",
  });

  // Check 2: Campaign ID configured
  const hasCampaignId = !!config.PATREON_CAMPAIGN_ID;
  checks.push({
    name: "Campaign ID",
    status: hasCampaignId,
    message: hasCampaignId ? `ID: ${config.PATREON_CAMPAIGN_ID}` : "Missing - use /patreonadmin getcampaign",
  });

  // Check 3: Test API connection
  if (hasToken) {
    try {
      const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity", {
        headers: {
          Authorization: `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        checks.push({
          name: "API Connection",
          status: true,
          message: `Connected as user ID: ${data.data?.id || "unknown"}`,
        });
      } else {
        checks.push({
          name: "API Connection",
          status: false,
          message: `API returned ${response.status}: Token may be expired`,
        });
      }
    } catch (error: any) {
      checks.push({
        name: "API Connection",
        status: false,
        message: `Connection failed: ${error.message}`,
      });
    }
  }

  // Check 4: Campaign access (if both token and ID are set)
  if (hasToken && hasCampaignId) {
    try {
      const response = await fetch(
        `https://www.patreon.com/api/oauth2/v2/campaigns/${config.PATREON_CAMPAIGN_ID}?include=tiers`,
        {
          headers: {
            Authorization: `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tierCount = data.included?.filter((i: any) => i.type === "tier")?.length || 0;
        checks.push({
          name: "Campaign Access",
          status: true,
          message: `Campaign accessible with ${tierCount} tier(s)`,
        });
      } else {
        checks.push({
          name: "Campaign Access",
          status: false,
          message: `Cannot access campaign (${response.status})`,
        });
      }
    } catch (error: any) {
      checks.push({
        name: "Campaign Access",
        status: false,
        message: `Error: ${error.message}`,
      });
    }
  }

  // Check 5: Webhook secret
  const hasWebhookSecret = !!config.PATREON_WEBHOOK_SECRET;
  checks.push({
    name: "Webhook Secret",
    status: hasWebhookSecret,
    message: hasWebhookSecret ? "Secret is configured" : "Optional - needed for webhooks",
  });

  // Check 6: Dashboard webhook endpoint
  checks.push({
    name: "Webhook Endpoint",
    status: true,
    message: "Dashboard handles webhooks at /api/webhooks/patreon",
  });

  // Build embed
  const allPassed = checks.every((c) => c.status);
  const embed = new EmbedBuilder()
    .setTitle(" Patreon Credential Verification")
    .setColor(allPassed ? 0x00FF00 : 0xFFAA00)
    .setTimestamp();

  for (const check of checks) {
    embed.addFields({
      name: `${check.status ? "✅" : "❌"} ${check.name}`,
      value: check.message,
      inline: true,
    });
  }

  if (allPassed) {
    embed.setDescription(" All checks passed! Patreon integration is fully configured.");
  } else {
    embed.setDescription("⚠️ Some checks failed. Review the items above.");
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSync(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const patreonService = PatreonService.getInstance();
  
  if (!patreonService.isConfigured()) {
    await interaction.editReply({
      content: "❌ Patreon is not fully configured. Run `/patreonadmin verify` to check configuration.",
    });
    return;
  }

  try {
    const syncedCount = await patreonService.syncAllPatrons();
    
    const embed = new EmbedBuilder()
      .setTitle("Patron Sync Complete")
      .setColor(0x00FF00)
      .setDescription(`Successfully synced patron data from Patreon.`)
      .addFields(
        { name: "Patrons Synced", value: syncedCount.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ **Sync failed:** ${error.message}`,
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("⚙️ Patreon Configuration Status")
    .setColor(0xF96854)
    .setTimestamp();

  const configItems = [
    { name: "Client ID", value: config.PATREON_CLIENT_ID, sensitive: true },
    { name: "Client Secret", value: config.PATREON_CLIENT_SECRET, sensitive: true },
    { name: "Creator Access Token", value: config.PATREON_CREATOR_ACCESS_TOKEN, sensitive: true },
    { name: "Campaign ID", value: config.PATREON_CAMPAIGN_ID, sensitive: false },
    { name: "Webhook Secret", value: config.PATREON_WEBHOOK_SECRET, sensitive: true },
    { name: "Founder Tier ID", value: config.PATREON_FOUNDER_TIER_ID, sensitive: false },
  ];

  for (const item of configItems) {
    const isSet = !!item.value;
    let displayValue = "❌ Not set";
    
    if (isSet) {
      if (item.sensitive) {
        displayValue = `✅ Set (${item.value!.substring(0, 8)}...)`;
      } else {
        displayValue = `✅ ${item.value}`;
      }
    }
    
    embed.addFields({ name: item.name, value: displayValue, inline: true });
  }

  // Webhook endpoint info
  embed.addFields({
    name: "Webhook Endpoint",
    value: "✅ Dashboard handles webhooks at /api/webhooks/patreon",
    inline: true,
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateWebhook(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  // Check prerequisites
  if (!config.PATREON_CREATOR_ACCESS_TOKEN) {
    await interaction.editReply({
      content: "❌ **PATREON_CREATOR_ACCESS_TOKEN** is not configured. Add it to config.json first.",
    });
    return;
  }

  if (!config.PATREON_CAMPAIGN_ID) {
    await interaction.editReply({
      content: "❌ **PATREON_CAMPAIGN_ID** is not configured. Use `/patreonadmin getcampaign` first.",
    });
    return;
  }

  // Use the dashboard URL for webhooks (configure DASHBOARD_URL in config.json)
  const dashboardUrl = config.DASHBOARD_URL || "https://your-dashboard-url.com";
  const webhookUrl = `${dashboardUrl}/api/webhooks/patreon`;
  
  try {
    // Create webhook via Patreon API
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/webhooks", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "webhook",
          attributes: {
            triggers: [
              "members:create",
              "members:update",
              "members:delete",
              "members:pledge:create",
              "members:pledge:update",
              "members:pledge:delete"
            ],
            uri: webhookUrl,
          },
          relationships: {
            campaign: {
              data: { type: "campaign", id: config.PATREON_CAMPAIGN_ID },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await interaction.editReply({
        content: `❌ **API Error** (${response.status}): ${errorText}\n\nMake sure your token has the \`w:campaigns.webhook\` scope.`,
      });
      return;
    }

    const data = await response.json();
    const webhookId = data.data?.id;
    const webhookSecret = data.data?.attributes?.secret;
    const triggers = data.data?.attributes?.triggers || [];

    const embed = new EmbedBuilder()
      .setTitle("✅ Webhook Created Successfully!")
      .setColor(0x00FF00)
      .setDescription("Your Patreon webhook has been registered.")
      .addFields(
        { name: "Webhook ID", value: `\`${webhookId}\``, inline: true },
        { name: "URL", value: `\`${webhookUrl}\``, inline: false },
        { name: "Triggers", value: triggers.map((t: string) => `• ${t}`).join("\n") || "None", inline: false }
      )
      .setTimestamp();

    if (webhookSecret) {
      embed.addFields({
        name: "🔐 Webhook Secret",
        value: `\`\`\`${webhookSecret}\`\`\`\n⚠️ **Copy this secret and add it to your config.json as PATREON_WEBHOOK_SECRET**\nThis secret is only shown once!`,
        inline: false,
      });
    }

    embed.addFields({
      name: "📝 Next Steps",
      value: "1. Copy the webhook secret above\n2. Add it to your `config.json` as `PATREON_WEBHOOK_SECRET`\n3. Restart the bot\n4. Start the webhook server with `/patreonadmin webhook action:start`",
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ **Error creating webhook:** ${error.message}`,
    });
  }
}

async function handleListWebhooks(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!config.PATREON_CREATOR_ACCESS_TOKEN) {
    await interaction.editReply({
      content: "❌ **PATREON_CREATOR_ACCESS_TOKEN** is not configured.",
    });
    return;
  }

  try {
    const response = await fetch(
      "https://www.patreon.com/api/oauth2/v2/webhooks?fields[webhook]=last_attempted_at,num_consecutive_times_failed,paused,secret,triggers,uri",
      {
        headers: {
          "Authorization": `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      await interaction.editReply({
        content: `❌ **API Error** (${response.status}): ${errorText}`,
      });
      return;
    }

    const data = await response.json();
    const webhooks = data.data || [];

    if (webhooks.length === 0) {
      await interaction.editReply({
        content: "📭 No webhooks found. Use `/patreonadmin createwebhook` to create one.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🔗 Your Patreon Webhooks")
      .setColor(0xF96854)
      .setDescription(`Found ${webhooks.length} webhook(s)`)
      .setTimestamp();

    for (const webhook of webhooks) {
      const attrs = webhook.attributes || {};
      const status = attrs.paused ? "⏸️ Paused" : "🟢 Active";
      const failures = attrs.num_consecutive_times_failed || 0;
      const triggers = (attrs.triggers || []).join(", ");
      
      embed.addFields({
        name: `Webhook ID: ${webhook.id}`,
        value: [
          `**Status:** ${status}${failures > 0 ? ` (${failures} failures)` : ""}`,
          `**URL:** \`${attrs.uri || "N/A"}\``,
          `**Triggers:** ${triggers || "None"}`,
          `**Last Attempt:** ${attrs.last_attempted_at || "Never"}`,
        ].join("\n"),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ **Error fetching webhooks:** ${error.message}`,
    });
  }
}

async function handleDeleteWebhook(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const webhookId = interaction.options.getString("id", true);

  if (!config.PATREON_CREATOR_ACCESS_TOKEN) {
    await interaction.editReply({
      content: "❌ **PATREON_CREATOR_ACCESS_TOKEN** is not configured.",
    });
    return;
  }

  try {
    const response = await fetch(
      `https://www.patreon.com/api/oauth2/v2/webhooks/${webhookId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        },
      }
    );

    if (response.status === 204 || response.ok) {
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Webhook Deleted")
        .setColor(0xFFAA00)
        .setDescription(`Successfully deleted webhook \`${webhookId}\``)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const errorText = await response.text();
      await interaction.editReply({
        content: `❌ **API Error** (${response.status}): ${errorText}`,
      });
    }
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ **Error deleting webhook:** ${error.message}`,
    });
  }
}

export default command;
