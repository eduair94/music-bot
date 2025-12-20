import { ColorResolvable, EmbedBuilder } from "discord.js";
import { SettingsHandlerContext } from "./types";

export async function handleView({ interaction, settings }: SettingsHandlerContext) {
  // Get log channel display value
  let logChannelDisplay = "Default (#bot-commands)";
  if (settings.logChannelId === "disabled") {
    logChannelDisplay = "Disabled";
  } else if (settings.logChannelId) {
    logChannelDisplay = "<#" + settings.logChannelId + ">";
  }

  const embed = new EmbedBuilder()
    .setTitle("Bot Settings")
    .setColor(settings.embedColor as ColorResolvable)
    .addFields(
      {
        name: "Roles",
        value: [
          "**DJ Role:** " + (settings.djRoleId ? "<@&" + settings.djRoleId + ">" : "Not set (everyone can DJ)"),
          "**Admin Role:** " + (settings.adminRoleId ? "<@&" + settings.adminRoleId + ">" : "Server admins only"),
        ].join("\n"),
        inline: false,
      },
      {
        name: "Volume",
        value: [
          "**Default:** " + settings.defaultVolume + "%",
          "**Maximum:** " + settings.maxVolume + "%",
        ].join("\n"),
        inline: true,
      },
      {
        name: "Queue",
        value: [
          "**Max Size:** " + settings.maxQueueSize + " songs",
          "**Prevent Duplicates:** " + (settings.preventDuplicates ? "Yes" : "No"),
        ].join("\n"),
        inline: true,
      },
      {
        name: "Behavior",
        value: [
          "**Announcements:** " + (settings.announceNowPlaying ? "On" : "Off"),
          "**Auto Leave:** " + (settings.autoLeaveEmpty ? "On" : "Off"),
          "**Leave Timeout:** " + settings.autoLeaveTimeout + "s",
        ].join("\n"),
        inline: true,
      },
      {
        name: "Channels",
        value: [
          "**Voice Channels:** " + (settings.allowedVoiceChannels.length > 0 
            ? settings.allowedVoiceChannels.map((c) => "<#" + c + ">").join(", ") 
            : "All allowed"),
          "**Text Channels:** " + (settings.allowedTextChannels.length > 0 
            ? settings.allowedTextChannels.map((c) => "<#" + c + ">").join(", ") 
            : "All allowed"),
          "**Log Channel:** " + logChannelDisplay,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Blacklist",
        value: settings.blacklistedUsers.length > 0
          ? settings.blacklistedUsers.map((u) => "<@" + u + ">").join(", ")
          : "No users blacklisted",
        inline: false,
      },
      {
        name: "Premium",
        value: settings.premium.enabled
          ? "**Tier:** " + settings.premium.tier.toUpperCase() + "\n**Expires:** " + (settings.premium.expiresAt ? settings.premium.expiresAt.toLocaleDateString() : "Never")
          : "Not active",
        inline: true,
      },
      {
        name: "Customization",
        value: [
          "**Language:** " + settings.language,
          "**Embed Color:** " + settings.embedColor,
        ].join("\n"),
        inline: true,
      }
    )
    .setFooter({ text: "Use /settings <option> to change settings" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
