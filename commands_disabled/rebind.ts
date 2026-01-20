import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  TextChannel,
  PermissionFlagsBits
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { QueueMetadata } from "../services/discordPlayer";

export default {
  data: new SlashCommandBuilder()
    .setName("rebind")
    .setDescription(i18n.__("rebind.description"))
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to rebind to (defaults to current)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    
    if (!queue) {
      return interaction.reply({
        content: i18n.__("rebind.noQueue"),
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel") || interaction.channel;
    
    if (!channel || !(channel instanceof TextChannel)) {
      return interaction.reply({
        content: i18n.__("rebind.invalidChannel"),
        ephemeral: true
      });
    }

    // Update queue metadata
    const metadata = queue.metadata as QueueMetadata;
    metadata.channel = channel;

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("rebind.title"))
      .setDescription(i18n.__mf("rebind.success", { channel: channel.toString() }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
