import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("grab")
    .setDescription(i18n.__("grab.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    
    if (!queue || !queue.currentTrack) {
      return interaction.reply({
        content: i18n.__("grab.noQueue"),
        ephemeral: true
      });
    }

    const track = queue.currentTrack;

    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setURL(track.url)
      .setDescription(i18n.__mf("grab.description", {
        guild: interaction.guild?.name || "Unknown"
      }))
      .setThumbnail(track.thumbnail)
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("grab.author"), 
          value: track.author, 
          inline: true 
        },
        { 
          name: i18n.__("grab.duration"), 
          value: track.duration, 
          inline: true 
        },
        { 
          name: i18n.__("grab.url"), 
          value: track.url 
        }
      )
      .setFooter({ 
        text: i18n.__mf("grab.requestedBy", { 
          user: track.requestedBy?.username || "Unknown" 
        }) 
      });

    try {
      await interaction.user.send({ embeds: [embed] });
      return interaction.reply({
        content: i18n.__("grab.success"),
        ephemeral: true
      });
    } catch {
      return interaction.reply({
        content: i18n.__("grab.dmFailed"),
        ephemeral: true
      });
    }
  }
};
