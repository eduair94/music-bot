import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder
} from "discord.js";
import { i18n } from "../utils/i18n";
// @ts-ignore
import lyricsFinder from "lyrics-finder";

export default {
  data: new SlashCommandBuilder()
    .setName("searchlyrics")
    .setDescription(i18n.__("searchlyrics.description"))
    .addStringOption(option =>
      option
        .setName("song")
        .setDescription("Song name to search for")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("artist")
        .setDescription("Artist name (optional)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const song = interaction.options.getString("song", true);
    const artist = interaction.options.getString("artist") || "";

    await interaction.deferReply();

    try {
      const lyrics = await lyricsFinder(song, artist);

      if (!lyrics) {
        return interaction.editReply({
          content: i18n.__mf("searchlyrics.noResults", { query: song })
        });
      }

      const chunkSize = 4000;
      const chunks: string[] = [];

      // Split lyrics into chunks if too long
      for (let i = 0; i < lyrics.length; i += chunkSize) {
        chunks.push(lyrics.substring(i, i + chunkSize));
      }

      const totalPages = chunks.length;
      let currentPage = 0;

      const generateEmbed = (page: number): EmbedBuilder => {
        const embed = new EmbedBuilder()
          .setTitle(`🎤 ${song}${artist ? ` - ${artist}` : ""}`)
          .setDescription(chunks[page])
          .setColor("#F8AA2A")
          .setFooter({
            text: totalPages > 1 
              ? `Page ${page + 1}/${totalPages}`
              : `Found lyrics for: "${song}"`
          });

        return embed;
      };

      // If only one page, no need for pagination
      if (totalPages === 1) {
        return interaction.editReply({ embeds: [generateEmbed(0)] });
      }

      // Create pagination buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("searchlyrics_prev")
          .setLabel("⬅️ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("searchlyrics_next")
          .setLabel("Next ➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1)
      );

      await interaction.editReply({ 
        embeds: [generateEmbed(0)], 
        components: [row]
      });

      const response = await interaction.fetchReply();
      const collector = response.createMessageComponentCollector({ 
        time: 300000 // 5 minutes for lyrics reading
      });

      collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return buttonInteraction.reply({ 
            content: "❌ Only the command user can navigate pages.", 
            ephemeral: true 
          });
        }

        if (buttonInteraction.customId === "searchlyrics_next") {
          currentPage = Math.min(currentPage + 1, totalPages - 1);
        } else if (buttonInteraction.customId === "searchlyrics_prev") {
          currentPage = Math.max(currentPage - 1, 0);
        }

        const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("searchlyrics_prev")
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("searchlyrics_next")
            .setLabel("Next ➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
        );

        await buttonInteraction.update({ 
          embeds: [generateEmbed(currentPage)], 
          components: [newRow]
        });
      });

      collector.on("end", async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          // Interaction may have expired
        }
      });

    } catch (error) {
      console.error("[searchlyrics] Error:", error);
      return interaction.editReply({
        content: i18n.__("searchlyrics.error")
      });
    }
  }
};
