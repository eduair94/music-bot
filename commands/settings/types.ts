import { ChatInputCommandInteraction } from "discord.js";
import { IGuildSettings } from "../../models/GuildSettings";
import { GuildSettingsService } from "../../services/guildSettings";

export interface SettingsHandlerContext {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  settings: IGuildSettings;
  settingsService: GuildSettingsService;
}

export type SettingsHandler = (ctx: SettingsHandlerContext) => Promise<unknown>;
