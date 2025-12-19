import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { splitBar } from "string-progressbar";
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription(i18n.__("nowplaying.description")),
  cooldown: 10,
  execute(interaction: ChatInputCommandInteraction) {
    // Try discord-player first (new fast system)
    const playerService = DiscordPlayerService.getInstance();
    const dpQueue = playerService.getQueue(interaction.guild!.id);
    
    if (dpQueue && dpQueue.currentTrack) {
      const track = dpQueue.currentTrack;
      const progress = dpQueue.node.getTimestamp();
      
      let nowPlaying = new EmbedBuilder()
        .setTitle(i18n.__("nowplaying.embedTitle"))
        .setDescription(`**${track.title}**\n${track.url}\n\n**Artist:** ${track.author || 'Unknown'}\n**Source:** ${track.source}`)
        .setColor("#F8AA2A");

      if (track.thumbnail) {
        nowPlaying.setThumbnail(track.thumbnail);
      }

      if (progress && track.durationMS > 0) {
        const seek = progress.current.value / 1000;
        const duration = track.durationMS / 1000;
        const left = duration - seek;

        nowPlaying.addFields({
          name: "\u200b",
          value:
            new Date(seek * 1000).toISOString().substr(11, 8) +
            "[" +
            splitBar(duration, seek, 20)[0] +
            "]" +
            new Date(duration * 1000).toISOString().substr(11, 8),
          inline: false
        });

        nowPlaying.setFooter({
          text: i18n.__mf("nowplaying.timeRemaining", {
            time: new Date(left * 1000).toISOString().substr(11, 8)
          })
        });
      }

      return interaction.reply({ embeds: [nowPlaying] });
    }

    // Fall back to legacy queue system
    const queue = bot.queues.get(interaction.guild!.id);

    if (!queue || !queue.songs.length)
      return interaction.reply({ content: i18n.__("nowplaying.errorNotQueue"), ephemeral: true }).catch(console.error);

    const song = queue.songs[0];
    const seek = queue.resource.playbackDuration / 1000;
    const left = song.duration - seek;

    // Get platform emoji
    const platformDisplay = song.platform ? `**Platform:** ${song.platform}` : '';
    const artistDisplay = song.artist ? `**Artist:** ${song.artist}\n` : '';
    
    let nowPlaying = new EmbedBuilder()
      .setTitle(i18n.__("nowplaying.embedTitle"))
      .setDescription(`${song.title}\n${song.url}\n\n${artistDisplay}${platformDisplay}`)
      .setColor("#F8AA2A");

    // Add thumbnail if available
    if (song.thumbnail) {
      nowPlaying.setThumbnail(song.thumbnail);
    }

    if (song.duration > 0) {
      nowPlaying.addFields({
        name: "\u200b",
        value:
          new Date(seek * 1000).toISOString().substr(11, 8) +
          "[" +
          splitBar(song.duration == 0 ? seek : song.duration, seek, 20)[0] +
          "]" +
          (song.duration == 0 ? " ◉ LIVE" : new Date(song.duration * 1000).toISOString().substr(11, 8)),
        inline: false
      });

      nowPlaying.setFooter({
        text: i18n.__mf("nowplaying.timeRemaining", {
          time: new Date(left * 1000).toISOString().substr(11, 8)
        })
      });
    }

    return interaction.reply({ embeds: [nowPlaying] });
  }
};
