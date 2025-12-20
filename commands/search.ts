import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction
} from "discord.js";
import youtube, { Video } from "youtube-sr";
import { bot } from "../index";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription(i18n.__("search.description"))
    .addStringOption((option) =>
      option.setName("query").setDescription(i18n.__("search.optionQuery")).setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString("query", true);
    const member = interaction.guild!.members.cache.get(interaction.user.id);

    if (!member?.voice.channel) {
      return interaction.reply({ content: i18n.__("search.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    await interaction.reply("⏳ Searching...").catch(console.error);

    let results: Video[] = [];

    try {
      results = await youtube.search(query, { limit: 10, type: "video" });
    } catch (error) {
      console.error(error);
      return interaction.editReply({ content: i18n.__("common.errorCommand") }).catch(console.error);
    }

    if (!results || !results[0]) {
      return interaction.editReply({ content: i18n.__("search.noResults") });
    }

    const options = results.map((video) => ({
      label: video.title?.substring(0, 100) ?? "Unknown",
      value: video.url
    }));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-select")
        .setPlaceholder("Select songs to play")
        .setMinValues(1)
        .setMaxValues(10)
        .addOptions(options)
    );

    const followUp = await interaction.followUp({
      content: "🔍 Choose songs to play:",
      components: [row]
    });

    followUp
      .awaitMessageComponent({ time: 30000 })
      .then((selectInteraction) => {
        if (!(selectInteraction instanceof StringSelectMenuInteraction)) return;

        selectInteraction.update({ content: "⏳ Loading selected songs...", components: [] });

        const playCommand = bot.slashCommandsMap.get("play");
        if (!playCommand) return;

        // Play the first song, then queue the rest
        playCommand.execute(interaction, selectInteraction.values[0]).then(() => {
          selectInteraction.values.slice(1).forEach((url) => {
            playCommand.execute(interaction, url);
          });
        });
      })
      .catch(console.error);
  }
};
