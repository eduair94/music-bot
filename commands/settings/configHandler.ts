import { MessageFlags } from "discord.js";
import { logSettingChange } from "../../utils/actionLog";
import { i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

const onOff = (value: boolean) => i18n.__(value ? "settings.on" : "settings.off");
const enabledDisabled = (value: boolean) => i18n.__(value ? "settings.enabled" : "settings.disabled");
const label = (key: string) => i18n.__(`settings.view.${key}`);

export async function handleVolume({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const defaultVol = interaction.options.getInteger("default");
  const maxVol = interaction.options.getInteger("max");

  if (defaultVol === null && maxVol === null) {
    return interaction.reply({
      content: [
        `**${i18n.__("settings.volume.currentTitle")}:**`,
        `${label("default")}: ${settings.defaultVolume}%`,
        `${label("maximum")}: ${settings.maxVolume}%`
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const updates: { defaultVolume?: number; maxVolume?: number } = {};
  const messages: string[] = [];

  if (defaultVol !== null) {
    updates.defaultVolume = defaultVol;
    messages.push(i18n.__mf("settings.volume.defaultSet", { value: defaultVol }));
    // Log the change
    if (interaction.guild) {
      await logSettingChange(
        interaction.guild,
        interaction.user,
        i18n.__("settings.volume.logDefault"),
        settings.defaultVolume + "%",
        defaultVol + "%"
      );
    }
  }
  if (maxVol !== null) {
    updates.maxVolume = maxVol;
    messages.push(i18n.__mf("settings.volume.maxSet", { value: maxVol }));
    // Log the change
    if (interaction.guild) {
      await logSettingChange(
        interaction.guild,
        interaction.user,
        i18n.__("settings.volume.logMax"),
        settings.maxVolume + "%",
        maxVol + "%"
      );
    }
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleQueue({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const maxSize = interaction.options.getInteger("maxsize");
  const preventDuplicates = interaction.options.getBoolean("preventduplicates");

  if (maxSize === null && preventDuplicates === null) {
    return interaction.reply({
      content: [
        `**${i18n.__("settings.queue.currentTitle")}:**`,
        `${label("maxSize")}: ${i18n.__mf("settings.view.songs", { count: settings.maxQueueSize })}`,
        `${label("preventDuplicates")}: ${i18n.__(settings.preventDuplicates ? "settings.yes" : "settings.no")}`
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const updates: { maxQueueSize?: number; preventDuplicates?: boolean } = {};
  const messages: string[] = [];

  if (maxSize !== null) {
    updates.maxQueueSize = maxSize;
    messages.push(i18n.__mf("settings.queue.maxSet", { value: maxSize }));
  }
  if (preventDuplicates !== null) {
    updates.preventDuplicates = preventDuplicates;
    messages.push(i18n.__mf("settings.queue.duplicatesSet", { value: enabledDisabled(preventDuplicates) }));
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleBehavior({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const announcements = interaction.options.getBoolean("announcements");
  const autoLeave = interaction.options.getBoolean("autoleave");
  const leaveTimeout = interaction.options.getInteger("leavetimeout");

  if (announcements === null && autoLeave === null && leaveTimeout === null) {
    return interaction.reply({
      content: [
        `**${i18n.__("settings.behavior.currentTitle")}:**`,
        `${label("announcements")}: ${onOff(settings.announceNowPlaying)}`,
        `${label("autoLeave")}: ${onOff(settings.autoLeaveEmpty)}`,
        `${label("leaveTimeout")}: ${settings.autoLeaveTimeout}s`
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  }

  const updates: { announceNowPlaying?: boolean; autoLeaveEmpty?: boolean; autoLeaveTimeout?: number } = {};
  const messages: string[] = [];

  if (announcements !== null) {
    updates.announceNowPlaying = announcements;
    messages.push(i18n.__mf("settings.behavior.announcementsSet", { value: enabledDisabled(announcements) }));
  }
  if (autoLeave !== null) {
    updates.autoLeaveEmpty = autoLeave;
    messages.push(i18n.__mf("settings.behavior.autoLeaveSet", { value: enabledDisabled(autoLeave) }));
  }
  if (leaveTimeout !== null) {
    updates.autoLeaveTimeout = leaveTimeout;
    messages.push(i18n.__mf("settings.behavior.timeoutSet", { value: leaveTimeout }));
  }

  await settingsService.updateSettings(guildId, updates);
  return interaction.reply({
    content: messages.join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
