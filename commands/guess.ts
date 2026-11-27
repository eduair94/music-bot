import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS, startGame, stopGame } from "../services/guessGame";
import { GENRE_KEYS, isGenreKey } from "../services/previewSource";
import { descriptionLocalizations, i18n } from "../utils/i18n";

/**
 * /guess start [rounds] [genre] — guess the song from 30-second previews,
 * with four answer buttons per round (services/guessGame.ts).
 * /guess stop — end the game (host or Manage Server).
 */
export default {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription(i18n.__("guess.description"))
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription(i18n.__("guess.startDescription"))
        .setDescriptionLocalizations(descriptionLocalizations("guess.startDescription") ?? {})
        .addIntegerOption((option) =>
          option
            .setName("rounds")
            .setDescription(i18n.__("guess.optionRounds"))
            .setDescriptionLocalizations(descriptionLocalizations("guess.optionRounds") ?? {})
            .setMinValue(MIN_ROUNDS)
            .setMaxValue(MAX_ROUNDS)
        )
        .addStringOption((option) =>
          option
            .setName("genre")
            .setDescription(i18n.__("guess.optionGenre"))
            .setDescriptionLocalizations(descriptionLocalizations("guess.optionGenre") ?? {})
            .addChoices(
              ...GENRE_KEYS.map((key) => ({
                name: i18n.__(`guess.genre.${key}`),
                name_localizations: descriptionLocalizations(`guess.genre.${key}`),
                value: key
              }))
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("stop")
        .setDescription(i18n.__("guess.stopDescription"))
        .setDescriptionLocalizations(descriptionLocalizations("guess.stopDescription") ?? {})
    ),
  cooldown: 5,
  category: "other",

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    if (interaction.options.getSubcommand() === "stop") return stopGame(interaction);
    const rounds = interaction.options.getInteger("rounds") ?? DEFAULT_ROUNDS;
    const genreOption = interaction.options.getString("genre");
    const genre = isGenreKey(genreOption) ? genreOption : "top";
    return startGame(interaction, Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, rounds)), genre);
  }
};
