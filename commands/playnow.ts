import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import { gate, isRequesterOf } from "../utils/permissions";
import { runPlay } from "../utils/playFlow";
import play from "./play";

/** /playnow — play a song immediately, skipping the current one (needs the "skip" permission). */
export default {
  data: new SlashCommandBuilder()
    .setName("playnow")
    .setDescription(i18n.__("playnow.description"))
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription(i18n.__("play.optionSong"))
        .setDescriptionLocalizations(descriptionLocalizations("play.optionSong") ?? {})
        .setRequired(true)
        .setAutocomplete(true)
    ),
  cooldown: 3,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  autocomplete: play.autocomplete,

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    const replacing = Boolean(queue && !queue.deleted && queue.currentTrack);

    // Cutting off the current song is a skip ("play" itself is checked by the router).
    if (replacing && !(await gate(interaction, "skip", { isRequester: isRequesterOf(queue!.currentTrack, interaction.user.id) }))) {
      return;
    }

    const result = await runPlay({ interaction, query: interaction.options.getString("song", true), next: true, now: true });
    if (result && replacing && result.position === 1) {
      result.queue.node.skip();
    }
  }
};
