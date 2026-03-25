import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { TTS_LANGUAGES, TTS_SPEAKERS, TTSMode, ttsService } from "../services/tts";
import { i18n } from "../utils/i18n";

/**
 * /sayconfig command - Configure TTS settings
 * 
 * Features:
 * - Set default language and voice
 * - Configure voice cloning settings
 * - Upload reference audio
 * - View current configuration
 */

export default {
  data: new SlashCommandBuilder()
    .setName("sayconfig")
    .setDescription(i18n.__("sayconfig.description"))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View your current TTS configuration")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mode")
        .setDescription("Set TTS mode (custom_voice or voice_clone)")
        .addStringOption((option) =>
          option
            .setName("mode")
            .setDescription("TTS mode")
            .setRequired(true)
            .addChoices(
              { name: "Custom Voice (default)", value: "custom_voice" },
              { name: "Voice Clone", value: "voice_clone" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("language")
        .setDescription("Set default language")
        .addStringOption((option) =>
          option
            .setName("language")
            .setDescription("Language for speech")
            .setRequired(true)
            .addChoices(...TTS_LANGUAGES.map(lang => ({ name: lang, value: lang })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("voice")
        .setDescription("Set default voice/speaker")
        .addStringOption((option) =>
          option
            .setName("voice")
            .setDescription("Voice to use")
            .setRequired(true)
            .addChoices(...TTS_SPEAKERS.map(speaker => ({ name: speaker, value: speaker })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("description")
        .setDescription("Set voice description for custom voice generation")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Voice description (e.g., 'deep male voice with calm tone')")
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("style")
        .setDescription("Set style instruction for voice generation")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Style instruction (e.g., 'speak slowly and clearly')")
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reference")
        .setDescription("Set reference audio and text for voice cloning")
        .addAttachmentOption((option) =>
          option
            .setName("audio")
            .setDescription("Reference audio file (MP3, WAV, etc.)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Transcript of the reference audio")
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Reset your TTS configuration to defaults")
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id || null;

    // Check if TTS service is available
    if (!ttsService.isAvailable()) {
      return interaction.reply({
        content: i18n.__("say.errorNotAvailable"),
        ephemeral: true,
      }).catch(console.error);
    }

    switch (subcommand) {
      case "view":
        return this.handleView(interaction, userId, guildId);
      case "mode":
        return this.handleMode(interaction, userId, guildId);
      case "language":
        return this.handleLanguage(interaction, userId, guildId);
      case "voice":
        return this.handleVoice(interaction, userId, guildId);
      case "description":
        return this.handleDescription(interaction, userId, guildId);
      case "style":
        return this.handleStyle(interaction, userId, guildId);
      case "reference":
        return this.handleReference(interaction, userId, guildId);
      case "reset":
        return this.handleReset(interaction, userId, guildId);
      default:
        return interaction.reply({
          content: "Unknown subcommand",
          ephemeral: true,
        });
    }
  },

  async handleView(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const config = await ttsService.getConfig(userId, guildId || undefined);
    
    const embed = new EmbedBuilder()
      .setTitle("🎤 TTS Configuration")
      .setColor(0x5865F2)
      .setTimestamp();

    if (!config) {
      embed.setDescription("No custom configuration set. Using defaults.");
      embed.addFields(
        { name: "Mode", value: "custom_voice", inline: true },
        { name: "Language", value: "Spanish", inline: true },
        { name: "Voice", value: "Aiden", inline: true }
      );
    } else {
      embed.addFields(
        { name: "Mode", value: config.mode, inline: true },
        { name: "Language", value: config.language, inline: true },
        { name: "Voice", value: config.speaker, inline: true }
      );

      if (config.voiceDescription) {
        embed.addFields({ name: "Voice Description", value: config.voiceDescription, inline: false });
      }
      if (config.styleInstruction) {
        embed.addFields({ name: "Style Instruction", value: config.styleInstruction, inline: false });
      }
      if (config.referenceAudioUrl) {
        embed.addFields({ name: "Reference Audio", value: "✅ Set", inline: true });
      }
      if (config.referenceText) {
        embed.addFields({ name: "Reference Text", value: config.referenceText.substring(0, 100) + (config.referenceText.length > 100 ? "..." : ""), inline: false });
      }
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async handleMode(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const mode = interaction.options.getString("mode", true) as TTSMode;
    
    await ttsService.saveConfig(userId, guildId, { mode });
    
    return interaction.reply({
      content: `✅ TTS mode set to **${mode}**`,
      ephemeral: true,
    });
  },

  async handleLanguage(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const language = interaction.options.getString("language", true);
    
    await ttsService.saveConfig(userId, guildId, { language });
    
    return interaction.reply({
      content: `✅ Default language set to **${language}**`,
      ephemeral: true,
    });
  },

  async handleVoice(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const speaker = interaction.options.getString("voice", true);
    
    await ttsService.saveConfig(userId, guildId, { speaker });
    
    return interaction.reply({
      content: `✅ Default voice set to **${speaker}**`,
      ephemeral: true,
    });
  },

  async handleDescription(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const voiceDescription = interaction.options.getString("text", true);
    
    await ttsService.saveConfig(userId, guildId, { voiceDescription });
    
    return interaction.reply({
      content: `✅ Voice description set to: "${voiceDescription}"`,
      ephemeral: true,
    });
  },

  async handleStyle(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const styleInstruction = interaction.options.getString("text", true);
    
    await ttsService.saveConfig(userId, guildId, { styleInstruction });
    
    return interaction.reply({
      content: `✅ Style instruction set to: "${styleInstruction}"`,
      ephemeral: true,
    });
  },

  async handleReference(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment("audio", true);
    const referenceText = interaction.options.getString("text", true);

    // Validate audio file
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
    const fileName = attachment.name.toLowerCase();
    const isAudioFile = audioExtensions.some(ext => fileName.endsWith(ext));

    if (!isAudioFile) {
      return interaction.editReply({
        content: `❌ Invalid file type. Supported formats: ${audioExtensions.join(', ')}`,
      });
    }

    // Check file size (max 10MB for reference audio)
    const maxSize = 10 * 1024 * 1024;
    if (attachment.size > maxSize) {
      return interaction.editReply({
        content: `❌ File is too large (${(attachment.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`,
      });
    }

    try {
      // Download the audio file
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to Replicate
      const referenceAudioUrl = await ttsService.uploadReferenceAudio(buffer, attachment.name);

      // Save config with reference audio and text
      await ttsService.saveConfig(userId, guildId, {
        referenceAudioUrl,
        referenceText,
        mode: "voice_clone", // Automatically switch to voice_clone mode
      });

      return interaction.editReply({
        content: `✅ Reference audio uploaded and saved!\n📝 Reference text: "${referenceText}"\n🎤 Mode automatically set to **voice_clone**`,
      });
    } catch (error) {
      console.error("[sayconfig] Error uploading reference audio:", error);
      return interaction.editReply({
        content: "❌ Failed to upload reference audio. Please try again.",
      });
    }
  },

  async handleReset(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const deleted = await ttsService.deleteConfig(userId, guildId || undefined);
    
    if (deleted) {
      return interaction.reply({
        content: "✅ TTS configuration reset to defaults.",
        ephemeral: true,
      });
    } else {
      return interaction.reply({
        content: "ℹ️ No custom configuration found to reset.",
        ephemeral: true,
      });
    }
  },
};
