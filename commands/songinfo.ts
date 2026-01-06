import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("songinfo")
    .setDescription(i18n.__("songinfo.description"))
    .addIntegerOption(option =>
      option
        .setName("position")
        .setDescription("Position in queue (leave empty for current)")
        .setMinValue(1)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    
    if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
      return interaction.reply({
        content: i18n.__("songinfo.noQueue"),
        ephemeral: true
      });
    }

    const position = interaction.options.getInteger("position");
    let track;

    if (position) {
      const tracks = queue.tracks.toArray();
      if (position > tracks.length) {
        return interaction.reply({
          content: i18n.__mf("songinfo.invalidPosition", { max: tracks.length }),
          ephemeral: true
        });
      }
      track = tracks[position - 1];
    } else {
      track = queue.currentTrack;
    }

    if (!track) {
      return interaction.reply({
        content: i18n.__("songinfo.noTrack"),
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setURL(track.url)
      .setThumbnail(track.thumbnail)
      .setColor("#F8AA2A")
      .addFields(
        { name: i18n.__("songinfo.author"), value: track.author || "Unknown", inline: true },
        { name: i18n.__("songinfo.duration"), value: track.duration || "Unknown", inline: true },
        { name: i18n.__("songinfo.source"), value: track.source || "Unknown", inline: true },
        { name: i18n.__("songinfo.views"), value: track.views?.toLocaleString() || "Unknown", inline: true },
        { name: i18n.__("songinfo.live"), value: track.live ? "Yes" : "No", inline: true },
        { name: i18n.__("songinfo.requestedBy"), value: track.requestedBy?.username || "Unknown", inline: true }
      );

    if (track.description && track.description.length > 0) {
      const desc = track.description.length > 200 
        ? track.description.substring(0, 200) + "..." 
        : track.description;
      embed.setDescription(desc);
    }

    return interaction.reply({ embeds: [embed] });
  }
};
