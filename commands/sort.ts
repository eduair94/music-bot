import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("sort")
    .setDescription(i18n.__("sort.description"))
    .addStringOption(option =>
      option
        .setName("by")
        .setDescription("Sort criteria")
        .setRequired(true)
        .addChoices(
          { name: "Title (A-Z)", value: "title_asc" },
          { name: "Title (Z-A)", value: "title_desc" },
          { name: "Author (A-Z)", value: "author_asc" },
          { name: "Author (Z-A)", value: "author_desc" },
          { name: "Duration (Shortest)", value: "duration_asc" },
          { name: "Duration (Longest)", value: "duration_desc" }
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("sort.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size < 2) {
      return interaction.reply({
        content: i18n.__("sort.noQueue"),
        ephemeral: true
      });
    }

    const sortBy = interaction.options.getString("by", true);
    const tracks = queue.tracks.toArray();

    // Sort tracks based on criteria
    tracks.sort((a, b) => {
      switch (sortBy) {
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "author_asc":
          return a.author.localeCompare(b.author);
        case "author_desc":
          return b.author.localeCompare(a.author);
        case "duration_asc":
          return (a.durationMS || 0) - (b.durationMS || 0);
        case "duration_desc":
          return (b.durationMS || 0) - (a.durationMS || 0);
        default:
          return 0;
      }
    });

    // Clear and re-add sorted tracks
    queue.tracks.clear();
    for (const track of tracks) {
      queue.tracks.add(track);
    }

    const sortLabels: Record<string, string> = {
      "title_asc": "Title (A-Z)",
      "title_desc": "Title (Z-A)",
      "author_asc": "Author (A-Z)",
      "author_desc": "Author (Z-A)",
      "duration_asc": "Duration (Shortest first)",
      "duration_desc": "Duration (Longest first)"
    };

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("sort.title"))
      .setDescription(i18n.__mf("sort.success", { 
        count: tracks.length,
        criteria: sortLabels[sortBy] || sortBy
      }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
