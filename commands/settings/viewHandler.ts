import { ColorResolvable, EmbedBuilder, MessageFlags } from "discord.js";
import { BotLocale, LOCALE_NAMES, i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

const label = (key: string) => i18n.__(`settings.view.${key}`);
const line = (key: string, value: string | number) => `**${label(key)}:** ${value}`;
const onOff = (value: boolean) => i18n.__(value ? "settings.on" : "settings.off");
const channelList = (ids: string[]) => ids.map((c) => "<#" + c + ">").join(", ");

function languageName(value: string): string {
  if (value === "auto") return i18n.__("language.auto");
  return LOCALE_NAMES[value as BotLocale] ?? value;
}

export async function handleView({ interaction, settings }: SettingsHandlerContext) {
  // Get log channel display value
  let logChannelDisplay = label("logDefault");
  if (settings.logChannelId === "disabled") {
    logChannelDisplay = i18n.__("settings.disabled");
  } else if (settings.logChannelId) {
    logChannelDisplay = "<#" + settings.logChannelId + ">";
  }

  const embed = new EmbedBuilder()
    .setTitle(label("title"))
    .setColor(settings.embedColor as ColorResolvable)
    .addFields(
      {
        name: label("roles"),
        value: [
          line("djRole", settings.djRoleId ? "<@&" + settings.djRoleId + ">" : label("djNotSet")),
          line("adminRole", settings.adminRoleId ? "<@&" + settings.adminRoleId + ">" : label("adminNotSet")),
        ].join("\n"),
        inline: false,
      },
      {
        name: label("volume"),
        value: [line("default", settings.defaultVolume + "%"), line("maximum", settings.maxVolume + "%")].join("\n"),
        inline: true,
      },
      {
        name: label("queue"),
        value: [
          line("maxSize", i18n.__mf("settings.view.songs", { count: settings.maxQueueSize })),
          line("preventDuplicates", i18n.__(settings.preventDuplicates ? "settings.yes" : "settings.no")),
        ].join("\n"),
        inline: true,
      },
      {
        name: label("behavior"),
        value: [
          line("announcements", onOff(settings.announceNowPlaying)),
          line("autoLeave", onOff(settings.autoLeaveEmpty)),
          line("leaveTimeout", settings.autoLeaveTimeout + "s"),
        ].join("\n"),
        inline: true,
      },
      {
        name: label("channels"),
        value: [
          line("voiceChannels", settings.allowedVoiceChannels.length > 0 ? channelList(settings.allowedVoiceChannels) : i18n.__("settings.allAllowed")),
          line("textChannels", settings.allowedTextChannels.length > 0 ? channelList(settings.allowedTextChannels) : i18n.__("settings.allAllowed")),
          line("logChannel", logChannelDisplay),
        ].join("\n"),
        inline: false,
      },
      {
        name: label("blacklist"),
        value: settings.blacklistedUsers.length > 0
          ? settings.blacklistedUsers.map((u) => "<@" + u + ">").join(", ")
          : label("noBlacklist"),
        inline: false,
      },
      {
        name: label("premium"),
        value: settings.premium.enabled
          ? line("tier", settings.premium.tier.toUpperCase()) +
            "\n" +
            line("expires", settings.premium.expiresAt ? new Date(settings.premium.expiresAt).toLocaleDateString() : label("never"))
          : label("notActive"),
        inline: true,
      },
      {
        name: label("customization"),
        value: [line("language", languageName(settings.language)), line("embedColor", settings.embedColor)].join("\n"),
        inline: true,
      }
    )
    .setFooter({ text: label("footer") })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}
