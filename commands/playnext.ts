import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";
import play from "./play";

/** /playnext — /play with next:true, kept because people type it. */
export default {
  data: new SlashCommandBuilder()
    .setName("playnext")
    .setDescription(i18n.__("playnext.description"))
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription(i18n.__("play.optionSong"))
        .setDescriptionLocalizations(descriptionLocalizations("play.optionSong") ?? {})
        .setRequired(true)
        .setAutocomplete(true)
    ),
  cooldown: 2,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  autocomplete: play.autocomplete,

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    return runPlay({ interaction, query: interaction.options.getString("song", true), next: true });
  }
};
