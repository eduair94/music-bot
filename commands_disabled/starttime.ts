import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

function parseTime(timeStr: string): number | null {
  // Parse time formats: "1m 30s", "1:30", "90s", "90"
  if (!timeStr) return null;
  
  // Format: "1:30" or "1:30:00"
  if (timeStr.includes(":")) {
    const parts = timeStr.split(":").map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }
  
  // Format: "1m 30s", "30s", "1h 30m"
  let totalSeconds = 0;
  const hourMatch = timeStr.match(/(\d+)\s*h/i);
  const minMatch = timeStr.match(/(\d+)\s*m(?!s)/i);
  const secMatch = timeStr.match(/(\d+)\s*s/i);
  
  if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1], 10);
  
  // If no units found, treat as seconds
  if (!hourMatch && !minMatch && !secMatch) {
    const num = parseInt(timeStr, 10);
    if (!isNaN(num)) return num;
    return null;
  }
  
  return totalSeconds > 0 ? totalSeconds : null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("starttime")
    .setDescription(i18n.__("starttime.description"))
    .addStringOption(option =>
      option
        .setName("time")
        .setDescription("Start time (e.g., '30s', '1:30', '1m 30s') or 'reset'")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("starttime.noQueue"),
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("starttime.notInVoice"),
        ephemeral: true
      });
    }

    const timeInput = interaction.options.getString("time", true).toLowerCase();
    const currentTrack = queue.currentTrack;

    if (!currentTrack) {
      return interaction.reply({
        content: i18n.__("starttime.noTrack"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      if (timeInput === "reset") {
        // Reset to beginning
        await queue.node.seek(0);
        
        const embed = new EmbedBuilder()
          .setDescription(i18n.__("starttime.reset"))
          .setColor("#F8AA2A");
        
        return interaction.editReply({ embeds: [embed] });
      }

      const seconds = parseTime(timeInput);
      
      if (seconds === null || seconds < 0) {
        return interaction.editReply({
          content: i18n.__("starttime.invalidTime")
        });
      }

      const trackDuration = currentTrack.durationMS / 1000;
      if (seconds >= trackDuration) {
        return interaction.editReply({
          content: i18n.__mf("starttime.tooLong", { duration: currentTrack.duration })
        });
      }

      // Seek to the specified start time
      await queue.node.seek(seconds * 1000);

      const embed = new EmbedBuilder()
        .setTitle("‚è±Ô∏è Start Time Set")
        .setDescription(i18n.__mf("starttime.success", { time: formatTime(seconds) }))
        .setColor("#F8AA2A")
        .addFields({
          name: "Ìæµ Track",
          value: currentTrack.title,
          inline: false
        });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("[starttime] Error:", error);
      return interaction.editReply({
        content: i18n.__("starttime.error")
      });
    }
  }
};
