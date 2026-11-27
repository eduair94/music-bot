import { ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";
import play from "./play";

/** /playnow — play a song immediately, skipping the current one (DJ only). */
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

    if (replacing && !(await hasDJPermission(interaction.member as GuildMember))) {
      return interaction.reply({ content: `🎧 ${i18n.__("player.needDj")}`, flags: MessageFlags.Ephemeral });
    }

    const result = await runPlay({ interaction, query: interaction.options.getString("song", true), next: true, now: true });
    if (result && replacing && result.position === 1) {
      result.queue.node.skip();
    }
  }
};
