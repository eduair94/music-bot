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
        .setDescription(i18n.__("sayconfig.view.description"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mode")
        .setDescription(i18n.__("sayconfig.mode.description"))
        .addStringOption((option) =>
          option
            .setName("mode")
            .setDescription(i18n.__("sayconfig.mode.option"))
            .setRequired(true)
            .addChoices(
              { name: i18n.__("sayconfig.mode.customVoice"), value: "custom_voice" },
              { name: i18n.__("sayconfig.mode.voiceClone"), value: "voice_clone" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("language")
        .setDescription(i18n.__("sayconfig.language.description"))
        .addStringOption((option) =>
          option
            .setName("language")
            .setDescription(i18n.__("sayconfig.language.option"))
            .setRequired(true)
            .addChoices(...TTS_LANGUAGES.map(lang => ({ name: lang, value: lang })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("voice")
        .setDescription(i18n.__("sayconfig.voice.description"))
        .addStringOption((option) =>
          option
            .setName("voice")
            .setDescription(i18n.__("sayconfig.voice.option"))
            .setRequired(true)
            .addChoices(...TTS_SPEAKERS.map(speaker => ({ name: speaker, value: speaker })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("description")
        // "sayconfig.description" is the command's own description, so this
        // subcommand's strings live under sayconfig.voiceDescription.
        .setDescription(i18n.__("sayconfig.voiceDescription.description"))
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription(i18n.__("sayconfig.voiceDescription.option"))
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("style")
        .setDescription(i18n.__("sayconfig.style.description"))
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription(i18n.__("sayconfig.style.option"))
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reference")
        .setDescription(i18n.__("sayconfig.reference.description"))
        .addAttachmentOption((option) =>
          option
            .setName("audio")
            .setDescription(i18n.__("sayconfig.reference.optionAudio"))
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription(i18n.__("sayconfig.reference.optionText"))
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription(i18n.__("sayconfig.reset.description"))
    ),
  cooldown: 3,
  isAvailable: () => ttsService.isAvailable(),

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
          content: i18n.__("common.unknownSubcommand"),
          ephemeral: true,
        });
    }
  },

  async handleView(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const config = await ttsService.getConfig(userId, guildId || undefined);

    const embed = new EmbedBuilder()
      .setTitle(`🎤 ${i18n.__("sayconfig.view.title")}`)
      .setColor(0x5865F2)
      .setTimestamp();

    if (!config) {
      embed.setDescription(i18n.__("sayconfig.view.noConfig"));
      embed.addFields(
        { name: i18n.__("sayconfig.view.mode"), value: "custom_voice", inline: true },
        { name: i18n.__("sayconfig.view.language"), value: "Spanish", inline: true },
        { name: i18n.__("sayconfig.view.voice"), value: "Aiden", inline: true }
      );
    } else {
      embed.addFields(
        { name: i18n.__("sayconfig.view.mode"), value: config.mode, inline: true },
        { name: i18n.__("sayconfig.view.language"), value: config.language, inline: true },
        { name: i18n.__("sayconfig.view.voice"), value: config.speaker, inline: true }
      );

      if (config.voiceDescription) {
        embed.addFields({ name: i18n.__("sayconfig.view.voiceDescription"), value: config.voiceDescription, inline: false });
      }
      if (config.styleInstruction) {
        embed.addFields({ name: i18n.__("sayconfig.view.styleInstruction"), value: config.styleInstruction, inline: false });
      }
      if (config.referenceAudioUrl) {
        embed.addFields({ name: i18n.__("sayconfig.view.referenceAudio"), value: `✅ ${i18n.__("sayconfig.view.referenceAudioSet")}`, inline: true });
      }
      if (config.referenceText) {
        embed.addFields({ name: i18n.__("sayconfig.view.referenceText"), value: config.referenceText.substring(0, 100) + (config.referenceText.length > 100 ? "..." : ""), inline: false });
      }
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async handleMode(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const mode = interaction.options.getString("mode", true) as TTSMode;

    await ttsService.saveConfig(userId, guildId, { mode });

    return interaction.reply({
      content: `✅ ${i18n.__mf("sayconfig.mode.set", { mode })}`,
      ephemeral: true,
    });
  },

  async handleLanguage(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const language = interaction.options.getString("language", true);

    await ttsService.saveConfig(userId, guildId, { language });

    return interaction.reply({
      content: `✅ ${i18n.__mf("sayconfig.language.set", { language })}`,
      ephemeral: true,
    });
  },

  async handleVoice(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const speaker = interaction.options.getString("voice", true);

    await ttsService.saveConfig(userId, guildId, { speaker });

    return interaction.reply({
      content: `✅ ${i18n.__mf("sayconfig.voice.set", { voice: speaker })}`,
      ephemeral: true,
    });
  },

  async handleDescription(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const voiceDescription = interaction.options.getString("text", true);

    await ttsService.saveConfig(userId, guildId, { voiceDescription });

    return interaction.reply({
      content: `✅ ${i18n.__mf("sayconfig.voiceDescription.set", { text: voiceDescription })}`,
      ephemeral: true,
    });
  },

  async handleStyle(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const styleInstruction = interaction.options.getString("text", true);

    await ttsService.saveConfig(userId, guildId, { styleInstruction });

    return interaction.reply({
      content: `✅ ${i18n.__mf("sayconfig.style.set", { text: styleInstruction })}`,
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
        content: `❌ ${i18n.__mf("common.invalidFileType", { formats: audioExtensions.join(', ') })}`,
      });
    }

    // Check file size (max 10MB for reference audio)
    const maxSize = 10 * 1024 * 1024;
    if (attachment.size > maxSize) {
      return interaction.editReply({
        content: `❌ ${i18n.__mf("common.fileTooLarge", { size: (attachment.size / 1024 / 1024).toFixed(2), max: 10 })}`,
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
        content: [
          `✅ ${i18n.__("sayconfig.reference.saved")}`,
          `📝 ${i18n.__mf("sayconfig.reference.text", { text: referenceText })}`,
          `🎤 ${i18n.__mf("sayconfig.reference.modeSet", { mode: "voice_clone" })}`
        ].join("\n"),
      });
    } catch (error) {
      console.error("[sayconfig] Error uploading reference audio:", error);
      return interaction.editReply({
        content: `❌ ${i18n.__("sayconfig.reference.failed")}`,
      });
    }
  },

  async handleReset(interaction: ChatInputCommandInteraction, userId: string, guildId: string | null) {
    const deleted = await ttsService.deleteConfig(userId, guildId || undefined);

    if (deleted) {
      return interaction.reply({
        content: `✅ ${i18n.__("sayconfig.reset.done")}`,
        ephemeral: true,
      });
    } else {
      return interaction.reply({
        content: `ℹ️ ${i18n.__("sayconfig.reset.none")}`,
        ephemeral: true,
      });
    }
  },
};
