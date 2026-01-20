import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription(i18n.__("history.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      return interaction.editReply({ content: i18n.__("history.errorNotQueue") }).catch(console.error);
    }

    const history = queue.history;
    
    if (!history || history.tracks.size === 0) {
      return interaction.editReply({ content: i18n.__("history.errorEmpty") }).catch(console.error);
    }

    const tracks = history.tracks.toArray().slice(0, 10);
    
    const trackList = tracks.map((track, index) => 
      `**${index + 1}.** [${track.title}](${track.url}) - \`${track.duration}\``
    ).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("í³œ " + i18n.__("history.embedTitle"))
      .setDescription(trackList)
      .setColor("#5865F2")
      .setFooter({ text: i18n.__mf("history.footer", { count: history.tracks.size }) });

    return interaction.editReply({ embeds: [embed] }).catch(console.error);
  }
};
