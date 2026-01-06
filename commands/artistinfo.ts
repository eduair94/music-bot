import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("artistinfo")
    .setDescription(i18n.__("artistinfo.description"))
    .addStringOption(option =>
      option
        .setName("artist")
        .setDescription("Artist name (leave empty for current track's artist)")
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    const artistName = interaction.options.getString("artist");
    
    let artist = artistName;
    
    if (!artist) {
      if (!queue || !queue.currentTrack) {
        return interaction.reply({
          content: i18n.__("artistinfo.noArtist"),
          ephemeral: true
        });
      }
      artist = queue.currentTrack.author;
    }

    await interaction.deferReply();

    // Count tracks by this artist in queue
    const tracksInQueue = queue 
      ? [queue.currentTrack, ...queue.tracks.toArray()]
          .filter(t => t && t.author?.toLowerCase() === artist?.toLowerCase()).length
      : 0;

    const embed = new EmbedBuilder()
      .setTitle(i18n.__mf("artistinfo.title", { artist }))
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("artistinfo.tracksInQueue"), 
          value: tracksInQueue.toString(), 
          inline: true 
        }
      )
      .setFooter({ 
        text: i18n.__("artistinfo.footer") 
      });

    // Add search links
    embed.setDescription([
      `[YouTube](https://www.youtube.com/results?search_query=${encodeURIComponent(artist!)})`,
      `[Spotify](https://open.spotify.com/search/${encodeURIComponent(artist!)})`,
      `[Apple Music](https://music.apple.com/search?term=${encodeURIComponent(artist!)})`
    ].join(" • "));

    return interaction.editReply({ embeds: [embed] });
  }
};
