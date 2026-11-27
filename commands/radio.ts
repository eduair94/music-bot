import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { ensureAutoplayNext } from "../services/autoplay";
import { QueueMetadata } from "../services/discordPlayer";
import { PlayerPanelService } from "../services/playerPanel";
import { i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";
import play from "./play";

/**
 * /radio <song> — start an endless station from one song: plays it, then
 * keeps going with related songs (autoplay on).
 */
export default {
  data: new SlashCommandBuilder()
    .setName("radio")
    .setDescription(i18n.__("radio.description"))
    .addStringOption((option) =>
      option.setName("song").setDescription(i18n.__("play.optionSong")).setRequired(true).setAutocomplete(true)
    ),
  cooldown: 5,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  autocomplete: play.autocomplete,

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const result = await runPlay({ interaction, query: interaction.options.getString("song", true), radio: true });
    if (!result) return;
    const metadata = (result.queue.metadata || {}) as QueueMetadata;
    metadata.autoplay = true;
    result.queue.metadata = metadata;
    void ensureAutoplayNext(result.queue).then((added) => added && PlayerPanelService.getInstance().refresh(result.queue));
    await interaction.followUp({ content: `📻 ${i18n.__("player.autoplayEnabled")}` }).catch(() => undefined);
  }
};
