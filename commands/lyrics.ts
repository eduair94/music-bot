import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";
import { isSameSong, lyricsQueries, parseTrackForLyrics } from "../utils/lyricsQuery";
import { DiscordPlayerService } from "../services/discordPlayer";
import { SpotifyService } from "../services/spotify";

export default {
  data: new SlashCommandBuilder().setName("lyrics").setDescription(i18n.__("lyrics.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply(i18n.__("lyrics.errorNotQueue")).catch(console.error);
    }

    await interaction.reply("⏳ Loading...").catch(console.error);

    let lyrics: string | null = null;
    const track = queue.currentTrack;
    const title = track.title;
    const lookup = parseTrackForLyrics(title, track.author || "");

    for (const query of lyricsQueries(lookup)) {
      const found = await SpotifyService.getInstance().searchLyrics(query);
      // search_lyrics answers for its top search hit; another song's lyrics are worse than none
      if (found && isSameSong(lookup.title, found.trackName)) {
        lyrics = found.lines.join("\n");
        break;
      }
    }
    if (!lyrics) lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });

    const lyricsEmbed = new EmbedBuilder()
      .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
      .setDescription(lyrics.length >= 4096 ? `${lyrics.substring(0, 4093)}...` : lyrics)
      .setColor("#F8AA2A")
      .setTimestamp();

    return interaction.editReply({ content: "", embeds: [lyricsEmbed] }).catch(console.error);
  }
};
