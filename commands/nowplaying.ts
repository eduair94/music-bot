import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { splitBar } from "string-progressbar";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription(i18n.__("nowplaying.description")),
  cooldown: 10,
  execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: i18n.__("nowplaying.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    const track = queue.currentTrack;
    const progress = queue.node.getTimestamp();
    
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("nowplaying.embedTitle"))
      .setDescription(`**${track.title}**\n${track.url}\n\n**Artist:** ${track.author || 'Unknown'}\n**Source:** ${track.source}`)
      .setColor("#F8AA2A");

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    if (progress && track.durationMS > 0) {
      const seek = progress.current.value / 1000;
      const duration = track.durationMS / 1000;
      const left = duration - seek;

      embed.addFields({
        name: "\u200b",
        value:
          new Date(seek * 1000).toISOString().substr(11, 8) +
          "[" +
          splitBar(duration, seek, 20)[0] +
          "]" +
          new Date(duration * 1000).toISOString().substr(11, 8),
        inline: false
      });

      embed.setFooter({
        text: i18n.__mf("nowplaying.timeRemaining", {
          time: new Date(left * 1000).toISOString().substr(11, 8)
        })
      });
    }

    return interaction.reply({ embeds: [embed] });
  }
};
