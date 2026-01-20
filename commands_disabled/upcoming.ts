import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

const TRACKS_PER_PAGE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName("upcoming")
    .setDescription(i18n.__("upcoming.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("upcoming.noQueue"),
        ephemeral: true
      });
    }

    const tracks = queue.tracks.toArray();
    
    if (tracks.length === 0) {
      const currentTrack = queue.currentTrack;
      const embed = new EmbedBuilder()
        .setTitle("Ì≥ã Upcoming Tracks")
        .setDescription(i18n.__("upcoming.noUpcoming"))
        .setColor("#F8AA2A");
      
      if (currentTrack) {
        embed.addFields({
          name: "Ìæµ Now Playing",
          value: `[${currentTrack.title}](${currentTrack.url}) - ${currentTrack.duration}`,
          inline: false
        });
      }
      
      return interaction.reply({ embeds: [embed] });
    }

    const totalPages = Math.ceil(tracks.length / TRACKS_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number): EmbedBuilder => {
      const start = page * TRACKS_PER_PAGE;
      const end = start + TRACKS_PER_PAGE;
      const pageTracks = tracks.slice(start, end);

      const currentTrack = queue.currentTrack;
      const totalDuration = tracks.reduce((acc, track) => acc + track.durationMS, 0);
      const hours = Math.floor(totalDuration / 3600000);
      const minutes = Math.floor((totalDuration % 3600000) / 60000);

      const trackList = pageTracks
        .map((track, index) => {
          const position = start + index + 1;
          return `**${position}.** [${track.title}](${track.url}) - \`${track.duration}\``;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("Ì≥ã Upcoming Tracks")
        .setColor("#F8AA2A")
        .setDescription(trackList)
        .setFooter({ 
          text: `Page ${page + 1}/${totalPages} ‚Ä¢ ${tracks.length} tracks ‚Ä¢ Total: ${hours}h ${minutes}m`
        });

      if (currentTrack && page === 0) {
        embed.addFields({
          name: "Ìæµ Now Playing",
          value: `[${currentTrack.title}](${currentTrack.url}) - ${currentTrack.duration}`,
          inline: false
        });
      }

      return embed;
    };

    // If only one page, no need for pagination
    if (totalPages === 1) {
      return interaction.reply({ embeds: [generateEmbed(0)] });
    }

    // Create pagination buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("upcoming_prev")
        .setLabel("‚¨ÖÔ∏è Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("upcoming_next")
        .setLabel("Next ‚û°Ô∏è")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1)
    );

    await interaction.reply({ 
      embeds: [generateEmbed(0)], 
      components: [row]
    });

    const response = await interaction.fetchReply();
    const collector = response.createMessageComponentCollector({ 
      time: 120000
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({ 
          content: "‚ùå Only the command user can navigate pages.", 
          ephemeral: true 
        });
      }

      if (buttonInteraction.customId === "upcoming_next") {
        currentPage = Math.min(currentPage + 1, totalPages - 1);
      } else if (buttonInteraction.customId === "upcoming_prev") {
        currentPage = Math.max(currentPage - 1, 0);
      }

      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("upcoming_prev")
          .setLabel("‚¨ÖÔ∏è Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("upcoming_next")
          .setLabel("Next ‚û°Ô∏è")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages - 1)
      );

      await buttonInteraction.update({ 
        embeds: [generateEmbed(currentPage)], 
        components: [newRow]
      });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("upcoming_prev")
          .setLabel("‚¨ÖÔ∏è Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("upcoming_next")
          .setLabel("Next ‚û°Ô∏è")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      try {
        await interaction.editReply({ components: [disabledRow] });
      } catch (error) {
        // Interaction may have expired
      }
    });
  }
};
