import { logSettingChange } from "../../utils/actionLog";
import { SettingsHandlerContext } from "./types";

export async function handleVolume({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const defaultVol = interaction.options.getInteger("default");
  const maxVol = interaction.options.getInteger("max");

  if (defaultVol === null && maxVol === null) {
    return interaction.reply({
      content: "**Current Volume Settings:**\nDefault: " + settings.defaultVolume + "%\nMaximum: " + settings.maxVolume + "%",
      ephemeral: true,
    });
  }

  const updates: { defaultVolume?: number; maxVolume?: number } = {};
  const messages: string[] = [];

  if (defaultVol !== null) {
    updates.defaultVolume = defaultVol;
    messages.push("Default volume set to " + defaultVol + "%");
    // Log the change
    if (interaction.guild) {
      await logSettingChange(
        interaction.guild,
        interaction.user,
        "Default Volume",
        settings.defaultVolume + "%",
        defaultVol + "%"
      );
    }
  }
  if (maxVol !== null) {
    updates.maxVolume = maxVol;
    messages.push("Maximum volume set to " + maxVol + "%");
    // Log the change
    if (interaction.guild) {
      await logSettingChange(
        interaction.guild,
        interaction.user,
        "Maximum Volume",
        settings.maxVolume + "%",
        maxVol + "%"
      );
    }
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    ephemeral: true,
  });
}

export async function handleQueue({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const maxSize = interaction.options.getInteger("maxsize");
  const preventDuplicates = interaction.options.getBoolean("preventduplicates");

  if (maxSize === null && preventDuplicates === null) {
    return interaction.reply({
      content: "**Current Queue Settings:**\nMax Size: " + settings.maxQueueSize + " songs\nPrevent Duplicates: " + (settings.preventDuplicates ? "Yes" : "No"),
      ephemeral: true,
    });
  }

  const updates: { maxQueueSize?: number; preventDuplicates?: boolean } = {};
  const messages: string[] = [];

  if (maxSize !== null) {
    updates.maxQueueSize = maxSize;
    messages.push("Max queue size set to " + maxSize + " songs");
  }
  if (preventDuplicates !== null) {
    updates.preventDuplicates = preventDuplicates;
    messages.push("Prevent duplicates: " + (preventDuplicates ? "Enabled" : "Disabled"));
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    ephemeral: true,
  });
}

export async function handleBehavior({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const announcements = interaction.options.getBoolean("announcements");
  const autoLeave = interaction.options.getBoolean("autoleave");
  const leaveTimeout = interaction.options.getInteger("leavetimeout");

  if (announcements === null && autoLeave === null && leaveTimeout === null) {
    return interaction.reply({
      content: "**Current Behavior Settings:**\nAnnouncements: " + (settings.announceNowPlaying ? "On" : "Off") + "\nAuto Leave: " + (settings.autoLeaveEmpty ? "On" : "Off") + "\nLeave Timeout: " + settings.autoLeaveTimeout + "s",
      ephemeral: true,
    });
  }

  const updates: { announceNowPlaying?: boolean; autoLeaveEmpty?: boolean; autoLeaveTimeout?: number } = {};
  const messages: string[] = [];

  if (announcements !== null) {
    updates.announceNowPlaying = announcements;
    messages.push("Now playing announcements: " + (announcements ? "Enabled" : "Disabled"));
  }
  if (autoLeave !== null) {
    updates.autoLeaveEmpty = autoLeave;
    messages.push("Auto leave when empty: " + (autoLeave ? "Enabled" : "Disabled"));
  }
  if (leaveTimeout !== null) {
    updates.autoLeaveTimeout = leaveTimeout;
    messages.push("Leave timeout set to " + leaveTimeout + " seconds");
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    ephemeral: true,
  });
}
