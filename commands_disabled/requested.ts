import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { useQueue, Track } from "discord-player";
import { i18n } from "../utils/i18n";

const TRACKS_PER_PAGE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName("requested")
    .setDescription(i18n.__("requested.description"))
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to show requested tracks for (defaults to you)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("requested.noQueue"),
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("user") || interaction.user;
    const allTracks = queue.tracks.toArray();
    const currentTrack = queue.currentTrack;

    // Filter tracks by requester
    const userTracks = allTracks.filter((track: Track) => 
      track.requestedBy?.id === targetUser.id
    );

    // Check if current track is also from this user
    const currentTrackByUser = currentTrack?.requestedBy?.id === targetUser.id;

    if (userTracks.length === 0 && !currentTrackByUser) {
      return interaction.reply({
        content: i18n.__mf("requested.noTracks", { user: targetUser.username }),
        ephemeral: true
      });
    }

    const totalTracks = userTracks.length + (currentTrackByUser ? 1 : 0);
    const totalDuration = userTracks.reduce((acc, track) => acc + track.durationMS, 0) + 
      (currentTrackByUser && currentTrack ? currentTrack.durationMS : 0);
    const hours = Math.floor(totalDuration / 3600000);
    const minutes = Math.floor((totalDuration % 3600000) / 60000);

    const totalPages = Math.ceil(userTracks.length / TRACKS_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number): EmbedBuilder => {
      const start = page * TRACKS_PER_PAGE;
      const end = start + TRACKS_PER_PAGE;
      const pageTracks = userTracks.slice(start, end);

      let description = "";

      // Show current track on first page
      if (page === 0 && currentTrackByUser && currentTrack) {
        description += `**Ìæµ Now Playing:**\n[${currentTrack.title}](${currentTrack.url}) - \`${currentTrack.duration}\`\n\n`;
      }

      if (pageTracks.length > 0) {
        description += `**Ì≥ã In Queue:**\n`;
        description += pageTracks
          .map((track, index) => {
            const position = start + index + 1;
            return `**${position}.** [${track.title}](${track.url}) - \`${track.duration}\``;
          })
          .join("\n");
      }

      const embed = new EmbedBuilder()
        .setTitle(`Ìæ∂ Tracks Requested by ${targetUser.username}`)
        .setDescription(description || i18n.__("requested.empty"))
        .setColor("#F8AA2A")
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ 
          text: `${totalTracks} tracks ‚Ä¢ Total: ${hours}h ${minutes}m` + 
            (totalPages > 1 ? ` ‚Ä¢ Page ${page + 1}/${totalPages}` : "")
        });

      return embed;
    };

    // If only one page, no need for pagination
    if (totalPages <= 1) {
      return interaction.reply({ embeds: [generateEmbed(0)] });
    }

    // Create pagination buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("requested_prev")
        .setLabel("‚¨ÖÔ∏è Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("requested_next")
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

      if (buttonInteraction.customId === "requested_next") {
        currentPage = Math.min(currentPage + 1, totalPages - 1);
      } else if (buttonInteraction.customId === "requested_prev") {
        currentPage = Math.max(currentPage - 1, 0);
      }

      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("requested_prev")
          .setLabel("‚¨ÖÔ∏è Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("requested_next")
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
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        // Interaction may have expired
      }
    });
  }
};
