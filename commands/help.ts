import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  CommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { i18n } from "../utils/i18n";
import { bot } from "../index";

const COMMANDS_PER_PAGE = 24; // Max 25 fields per embed, leave room for header

export default {
  data: new SlashCommandBuilder().setName("help").setDescription(i18n.__("help.description")),
  async execute(interaction: CommandInteraction) {
    const commands = Array.from(bot.slashCommandsMap.values());
    const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number): EmbedBuilder => {
      const start = page * COMMANDS_PER_PAGE;
      const end = start + COMMANDS_PER_PAGE;
      const pageCommands = commands.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(i18n.__mf("help.embedTitle", { botname: interaction.client.user!.username }))
        .setDescription(i18n.__("help.embedDescription"))
        .setColor("#F8AA2A")
        .setTimestamp();

      pageCommands.forEach((cmd) => {
        embed.addFields({
          name: `**/${cmd.data.name}**`,
          value: `${cmd.data.description}`,
          inline: true
        });
      });

      embed.setFooter({ 
        text: `Page ${page + 1}/${totalPages} • ${commands.length} commands total` 
      });

      return embed;
    };

    // If only one page, no need for pagination
    if (totalPages === 1) {
      return interaction.reply({ embeds: [generateEmbed(0)] }).catch(console.error);
    }

    // Create pagination buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("help_prev")
        .setLabel("⬅️ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("help_next")
        .setLabel("Next ➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1)
    );

    const response = await interaction.reply({ 
      embeds: [generateEmbed(0)], 
      components: [row],
      fetchReply: true 
    });

    const collector = response.createMessageComponentCollector({ 
      time: 120000 // 2 minutes
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({ 
          content: "❌ Only the command user can navigate pages.", 
          ephemeral: true 
        });
      }

      if (buttonInteraction.customId === "help_next") {
        currentPage = Math.min(currentPage + 1, totalPages - 1);
      } else if (buttonInteraction.customId === "help_prev") {
        currentPage = Math.max(currentPage - 1, 0);
      }

      // Update button states
      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("help_prev")
          .setLabel("⬅️ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("help_next")
          .setLabel("Next ➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages - 1)
      );

      await buttonInteraction.update({ 
        embeds: [generateEmbed(currentPage)], 
        components: [newRow] 
      });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(console.error);
    });
  }
};
