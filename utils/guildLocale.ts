import { Guild, Interaction } from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import { BotLocale, resolveLocale } from "./i18n";

/**
 * Language for messages everyone in a server sees (player panel, welcome):
 * the server's chosen language, else the server's community locale.
 */
export async function localeForGuild(guild: Guild | null | undefined): Promise<BotLocale> {
  if (!guild) return resolveLocale({});
  let setting: string | null = null;
  try {
    setting = (await GuildSettingsService.getInstance().getSettings(guild.id)).language;
  } catch {
    setting = null;
  }
  return resolveLocale({ guildSetting: setting, guildLocale: guild.preferredLocale });
}

/**
 * Language for an interaction reply: the server's chosen language, else the
 * user's Discord language, else the server's community locale.
 */
export async function localeForInteraction(interaction: Interaction): Promise<BotLocale> {
  let setting: string | null = null;
  if (interaction.guildId && interaction.inCachedGuild()) {
    try {
      setting = (await GuildSettingsService.getInstance().getSettings(interaction.guildId)).language;
    } catch {
      setting = null;
    }
  }
  return resolveLocale({
    guildSetting: setting,
    userLocale: interaction.locale,
    guildLocale: interaction.guildLocale
  });
}
