import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("grab")
    .setDescription("Save the current song to your DMs"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true }).catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("save.errorNotQueue") }).catch(console.error);
    }

    const track = queue.currentTrack;

    const embed = new EmbedBuilder()
      .setTitle("💾 Saved Track")
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: "Artist", value: track.author || "Unknown", inline: true },
        { name: "Duration", value: track.duration || "Unknown", inline: true },
        { name: "Source", value: track.source || "Unknown", inline: true }
      )
      .setColor("#2ecc71")
      .setFooter({ text: `Saved from ${interaction.guild!.name}` })
      .setTimestamp();

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    try {
      await interaction.user.send({ embeds: [embed] });
      await logAction(interaction.guild!, interaction.user, "grab", track.title);
      return interaction.editReply({ 
        content: i18n.__mf("save.result", { title: track.title })
      }).catch(console.error);
    } catch {
      return interaction.editReply({ 
        content: i18n.__("save.errorDMClosed") 
      }).catch(console.error);
    }
  }
};
