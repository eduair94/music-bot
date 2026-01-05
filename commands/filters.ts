import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";

export default {
  data: new SlashCommandBuilder()
    .setName("filters")
    .setDescription("View all active audio filters"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: "❌ There is nothing playing." }).catch(console.error);
    }

    const enabledFilters = queue.filters.ffmpeg.getFiltersEnabled();
    
    // Map filter names to display names
    const filterDisplayNames: Record<string, string> = {
      "8D": "🎧 8D Audio",
      "bassboost": "🔊 Bass Boost",
      "nightcore": "⚡ Nightcore",
      "vaporwave": "🌊 Vaporwave",
      "echo": "🔉 Echo",
      "tremolo": "〰️ Tremolo",
      "vibrato": "📳 Vibrato",
      "karaoke": "🎤 Karaoke",
      "flanger": "⚡ Distortion/Flanger",
      "gate": "🚪 Gate",
      "haas": "🔈 Haas",
      "reverse": "⏪ Reverse",
      "surround": "🔊 Surround",
      "mcompand": "📊 Compand",
      "phaser": "🌀 Phaser",
      "pulsator": "💓 Pulsator",
      "subboost": "🔊 Sub Boost",
      "chorus": "🎵 Chorus",
      "fadein": "📈 Fade In",
      "dim": "🔅 Dim",
      "earrape": "💥 Earrape",
      "lofi": "📻 Lo-Fi",
      "normalizer": "📏 Normalizer",
      "silenceremove": "🔇 Silence Remove",
      "softlimiter": "🛑 Soft Limiter",
    };

    const embed = new EmbedBuilder()
      .setTitle("🎛️ Active Audio Filters")
      .setColor("#9B59B6");

    if (enabledFilters.length === 0) {
      embed.setDescription("No filters are currently active.\n\nUse commands like `/8d`, `/bassboost`, `/nightcore`, `/echo`, etc. to apply filters.");
    } else {
      const filterList = enabledFilters.map(f => filterDisplayNames[f] || `• ${f}`).join("\n");
      embed.setDescription(`**Currently Active:**\n${filterList}`);
      embed.setFooter({ text: "Use /clearfilters to remove all filters" });
    }

    return interaction.editReply({ embeds: [embed] }).catch(console.error);
  }
};
