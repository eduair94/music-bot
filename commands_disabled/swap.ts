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
    .setName("swap")
    .setDescription(i18n.__("swap.description"))
    .addIntegerOption(option =>
      option
        .setName("position1")
        .setDescription("First track position")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName("position2")
        .setDescription("Second track position")
        .setRequired(true)
        .setMinValue(1)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("swap.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size < 2) {
      return interaction.reply({
        content: i18n.__("swap.noQueue"),
        ephemeral: true
      });
    }

    const pos1 = interaction.options.getInteger("position1", true);
    const pos2 = interaction.options.getInteger("position2", true);
    
    if (pos1 === pos2) {
      return interaction.reply({
        content: i18n.__("swap.samePosition"),
        ephemeral: true
      });
    }

    const tracks = queue.tracks.toArray();
    const maxPos = tracks.length;

    if (pos1 > maxPos || pos2 > maxPos) {
      return interaction.reply({
        content: i18n.__mf("swap.outOfRange", { max: maxPos }),
        ephemeral: true
      });
    }

    const idx1 = pos1 - 1;
    const idx2 = pos2 - 1;
    
    const track1 = tracks[idx1];
    const track2 = tracks[idx2];

    // Swap tracks
    queue.swapTracks(idx1, idx2);

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("swap.title"))
      .setDescription(i18n.__mf("swap.success", { 
        pos1,
        title1: track1.title,
        pos2,
        title2: track2.title
      }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
