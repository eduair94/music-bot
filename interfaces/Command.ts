import {
    AutocompleteInteraction,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from "discord.js";

export interface Command {
  permissions?: string[];
  cooldown?: number;
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(...args: any): any;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}
