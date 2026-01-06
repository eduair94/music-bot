import { useQueue } from "discord-player";
import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("rate")
    .setDescription(i18n.__("rate.description"))
    .addNumberOption(option =>
      option
        .setName("percentage")
        .setDescription("Rate percentage (50-200) or 'off' to disable")
        .setMinValue(50)
        .setMaxValue(200)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName("off")
        .setDescription("Turn rate filter off")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("rate.noQueue"),
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("rate.notInVoice"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const percentage = interaction.options.getNumber("percentage");
    const off = interaction.options.getBoolean("off");

    try {
      if (off || (!percentage && !off)) {
        // Disable rate (if off is true or no args provided and we want to show current/toggle off)
        if (off) {
          queue.filters.ffmpeg.setInputArgs([]);
          
          const embed = new EmbedBuilder()
            .setDescription(i18n.__("rate.disabled"))
            .setColor("#F8AA2A");
          
          return interaction.editReply({ embeds: [embed] });
        }

        // Show current rate info if no percentage provided
        const embed = new EmbedBuilder()
          .setTitle("⚡ Rate Filter")
          .setDescription(i18n.__("rate.info"))
          .setColor("#F8AA2A")
          .addFields({
            name: "Usage",
            value: "`/rate percentage:150` - Set rate to 150%\n`/rate off:true` - Disable rate filter",
            inline: false
          })
          .setFooter({ text: "⭐ Premium Feature" });
        
        return interaction.editReply({ embeds: [embed] });
      }

      // Calculate rate multiplier (percentage/100)
      const rateMultiplier = percentage! / 100;

      // Apply rate filter (changes both speed and pitch)
      // Using asetrate and atempo for proper rate change
      const rateFilter = `asetrate=44100*${rateMultiplier},aresample=44100`;
      
      await queue.filters.ffmpeg.setInputArgs(["-af", rateFilter]);

      const embed = new EmbedBuilder()
        .setTitle("⚡ Rate Effect Applied")
        .setDescription(i18n.__mf("rate.enabled", { percentage }))
        .setColor("#F8AA2A")
        .addFields({
          name: "⚙️ Settings",
          value: `**Rate:** ${percentage}% (${rateMultiplier}x)`,
          inline: false
        },
        {
          name: "⚠️ Note",
          value: "This changes both speed and pitch. Timestamps may be inaccurate.",
          inline: false
        })
        .setFooter({ text: "⭐ Premium Feature" });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("[rate] Error:", error);
      return interaction.editReply({
        content: i18n.__("rate.error")
      });
    }
  }
};
