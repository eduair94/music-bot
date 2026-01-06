import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("pulsator")
    .setDescription(i18n.__("pulsator.description"))
    .addStringOption(option =>
      option
        .setName("toggle")
        .setDescription("Turn pulsator on or off")
        .setRequired(false)
        .addChoices(
          { name: "On", value: "on" },
          { name: "Off", value: "off" }
        )
    )
    .addNumberOption(option =>
      option
        .setName("frequency")
        .setDescription("Frequency of the pulsator (0.1-10)")
        .setMinValue(0.1)
        .setMaxValue(10)
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("pulsator.noQueue"),
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("pulsator.notInVoice"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const toggle = interaction.options.getString("toggle");
    const frequency = interaction.options.getNumber("frequency") || 2;

    try {
      if (toggle === "off") {
        // Disable pulsator
        queue.filters.ffmpeg.setInputArgs([]);
        
        const embed = new EmbedBuilder()
          .setDescription(i18n.__("pulsator.disabled"))
          .setColor("#F8AA2A");
        
        return interaction.editReply({ embeds: [embed] });
      }

      // Enable pulsator effect (alternates audio between left and right channels)
      // Using apulsator filter from FFmpeg
      const pulsatorFilter = `apulsator=mode=sine:hz=${frequency}:width=1`;
      
      await queue.filters.ffmpeg.setInputArgs(["-af", pulsatorFilter]);

      const embed = new EmbedBuilder()
        .setTitle("Ì¥ä Pulsator Effect")
        .setDescription(i18n.__mf("pulsator.enabled", { frequency }))
        .setColor("#F8AA2A")
        .addFields({
          name: "‚öôÔ∏è Settings",
          value: `**Frequency:** ${frequency} Hz`,
          inline: false
        })
        .setFooter({ text: "‚≠ê Premium Feature" });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("[pulsator] Error:", error);
      return interaction.editReply({
        content: i18n.__("pulsator.error")
      });
    }
  }
};
