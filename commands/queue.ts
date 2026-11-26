import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { buildQueueView } from "../services/queueView";
import { i18n } from "../utils/i18n";

/** /queue — the queue, 10 songs per page, with page buttons that never expire. */
export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription(i18n.__("queue.description"))
    .addIntegerOption((option) => option.setName("page").setDescription(i18n.__("queue.optionPage")).setMinValue(1)),
  cooldown: 3,
  category: "queue",
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    if (!queue || queue.deleted || (!queue.currentTrack && queue.tracks.size === 0)) {
      return interaction.reply({ content: `🔇 ${i18n.__("queueView.nothingPlaying")}`, flags: MessageFlags.Ephemeral });
    }
    const page = (interaction.options.getInteger("page") ?? 1) - 1;
    return interaction.reply({
      ...(await buildQueueView(queue, page)),
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
  }
};
