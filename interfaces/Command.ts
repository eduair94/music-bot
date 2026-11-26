import {
  AutocompleteInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction
} from "discord.js";

/** Help-menu grouping. Commands without one land in "other". */
export type CommandCategory =
  | "music"
  | "queue"
  | "effects"
  | "playlists"
  | "info"
  | "settings"
  | "premium"
  | "other";

export interface Command {
  permissions?: string[];
  cooldown?: number;
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(...args: any): any;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
  /** Help-menu category. */
  category?: CommandCategory;
  /**
   * Also install the command for users (works in DMs and other servers).
   * Such a command must not assume `interaction.guild`.
   */
  userInstallable?: boolean;
  /** Hide the command when its backing service isn't configured (checked at registration). */
  isAvailable?(): boolean;
}

export interface ContextMenuCommand {
  data: ContextMenuCommandBuilder;
  cooldown?: number;
  userInstallable?: boolean;
  execute(interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction): Promise<unknown>;
}
