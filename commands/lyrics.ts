import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";
// @ts-ignore
import lyricsFinder from "lyrics-finder";
import { DiscordPlayerService } from "../services/discordPlayer";

export default {
  data: new SlashCommandBuilder().setName("lyrics").setDescription(i18n.__("lyrics.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.reply(i18n.__("lyrics.errorNotQueue")).catch(console.error);
    }

    await interaction.reply("⏳ Loading...").catch(console.error);

    let lyrics = null;
    const track = queue.currentTrack;
    const title = track.title;

    try {
      lyrics = await lyricsFinder(title, track.author || "");
      if (!lyrics) lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    } catch (error) {
      lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    }

    const lyricsEmbed = new EmbedBuilder()
      .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
      .setDescription(lyrics.length >= 4096 ? `${lyrics.substring(0, 4093)}...` : lyrics)
      .setColor("#F8AA2A")
      .setTimestamp();

    return interaction.editReply({ content: "", embeds: [lyricsEmbed] }).catch(console.error);
  }
};
