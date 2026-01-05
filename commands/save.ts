import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("save")
    .setDescription(i18n.__("save.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true }).catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("save.errorNotQueue") }).catch(console.error);
    }

    const track = queue.currentTrack;
    
    const embed = new EmbedBuilder()
      .setTitle("💾 Saved Song")
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: "Duration", value: track.duration, inline: true },
        { name: "Author", value: track.author || "Unknown", inline: true },
        { name: "Requested in", value: interaction.guild!.name, inline: true }
      )
      .setThumbnail(track.thumbnail)
      .setColor("#5865F2")
      .setFooter({ text: `Saved from ${interaction.guild!.name}` })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [embed] });
      return interaction.editReply({ 
        content: i18n.__mf("save.result", { title: track.title })
      }).catch(console.error);
    } catch (error) {
      return interaction.editReply({ 
        content: i18n.__("save.errorDMClosed")
      }).catch(console.error);
    }
  }
};
