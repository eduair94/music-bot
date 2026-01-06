import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { i18n } from "../utils/i18n";

const changelogs = [
  {
    version: "2.0.0",
    date: "2024-01",
    changes: [
      "âœ¨ Added collections system for saving playlists",
      "âœ¨ New commands: playnow, playnext, radio, voteskip",
      "âœ¨ Added leaderboard for session tracking",
      "í´§ Improved audio quality options",
      "í°› Fixed various playback issues"
    ]
  },
  {
    version: "1.5.0",
    date: "2023-12",
    changes: [
      "âœ¨ Added Spotify support",
      "âœ¨ Added SoundCloud support",
      "í´§ Improved queue management",
      "í°› Fixed lyrics search"
    ]
  },
  {
    version: "1.0.0",
    date: "2023-11",
    changes: [
      "í¾‰ Initial release",
      "âœ¨ YouTube playback support",
      "âœ¨ Basic queue management",
      "âœ¨ Audio filters (bassboost, nightcore)"
    ]
  }
];

export default {
  data: new SlashCommandBuilder()
    .setName("changelogs")
    .setDescription(i18n.__("changelogs.description"))
    .addIntegerOption(option =>
      option
        .setName("count")
        .setDescription("Number of versions to show")
        .setMinValue(1)
        .setMaxValue(10)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const count = interaction.options.getInteger("count") || 3;
    const versionsToShow = changelogs.slice(0, count);

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("changelogs.title"))
      .setColor("#F8AA2A");

    for (const version of versionsToShow) {
      embed.addFields({
        name: `v${version.version} (${version.date})`,
        value: version.changes.join("\n")
      });
    }

    embed.setFooter({ text: i18n.__("changelogs.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};
