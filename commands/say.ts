import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { servedByOtherInstance } from "../services/fleet/dispatcher";
import { GuildSettingsService } from "../services/guildSettings";
import { TTS_LANGUAGES, TTS_SPEAKERS, TTSLanguage, ttsService, TTSSpeaker } from "../services/tts";
import { i18n } from "../utils/i18n";
import { listenersElsewhere } from "../utils/playFlow";

/**
 * /say command - Text-to-Speech using Replicate's Qwen3-TTS
 * 
 * Features:
 * - Converts text to speech and plays it in voice channel
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 * - Uses saved user configuration for defaults
 */

export default {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription(i18n.__("say.description"))
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription(i18n.__("say.optionText"))
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription(i18n.__("say.optionLanguage"))
        .setRequired(false)
        .addChoices(...TTS_LANGUAGES.map(lang => ({ name: lang, value: lang })))
    )
    .addStringOption((option) =>
      option
        .setName("voice")
        .setDescription(i18n.__("say.optionVoice"))
        .setRequired(false)
        .addChoices(...TTS_SPEAKERS.map(speaker => ({ name: speaker, value: speaker })))
    ),
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  isAvailable: () => ttsService.isAvailable(),

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString("text", true);
    const languageOption = interaction.options.getString("language") as TTSLanguage | null;
    const voiceOption = interaction.options.getString("voice") as TTSSpeaker | null;
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;

    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({
        content: i18n.__("play.errorNotChannel"),
        ephemeral: true,
      }).catch(console.error);
    }

    // Check if TTS service is available
    if (!ttsService.isAvailable()) {
      return interaction.reply({
        content: i18n.__("say.errorNotAvailable"),
        ephemeral: true,
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();

    if (!playerService.isInitialized()) {
      return interaction.reply({
        content: `❌ ${i18n.__("common.playerInitializing")}`,
        ephemeral: true,
      }).catch(console.error);
    }

    // Speaking would queue into the music of people listening in another channel.
    const busyIn = interaction.guild ? listenersElsewhere(interaction.guild, voiceChannel.id) : null;
    if (busyIn) {
      return interaction.reply({
        content: `🎧 ${i18n.__mf("play.botNotInChannel", { channel: `<#${busyIn.id}>` })}`,
        ephemeral: true,
      }).catch(console.error);
    }
    // Another Bypass instance plays in this channel: don't join on top of it.
    const servedBy = await servedByOtherInstance(interaction);
    if (servedBy) return interaction.reply({ content: servedBy, ephemeral: true }).catch(console.error);

    await interaction.deferReply();
    const textChannel = interaction.channel as TextChannel;

    try {
      // Respect guild voice channel restrictions (same rule as /play)
      if (guildId) {
        const settingsService = GuildSettingsService.getInstance();
        const isVoiceChannelAllowed = await settingsService.isVoiceChannelAllowed(guildId, voiceChannel.id);
        if (!isVoiceChannelAllowed) {
          return interaction.editReply({
            content: `❌ ${i18n.__("common.voiceChannelNotAllowed")}`
          }).catch(console.error);
        }
      }

      // Get user's saved TTS configuration
      const userConfig = await ttsService.getConfig(userId, guildId);

      // Generate speech using TTS service with user config as defaults
      const result = await ttsService.generateSpeech({
        text,
        // Only override if explicitly provided in command
        ...(languageOption && { language: languageOption }),
        ...(voiceOption && { speaker: voiceOption }),
      }, userConfig);

      // Play the generated audio
      const playResult = await playerService.play(voiceChannel, result.url, textChannel);

      if (!playResult) {
        return interaction.editReply({
          content: i18n.__("say.errorGenerate"),
        }).catch(console.error);
      }

      // Get the actual values used (from config or defaults)
      const usedLanguage = languageOption || userConfig?.language || "Spanish";
      const usedVoice = voiceOption || userConfig?.speaker || "Aiden";
      const usedMode = userConfig?.mode || "custom_voice";

      return interaction.editReply({
        content: i18n.__mf("say.success", { 
          text: text.length > 100 ? text.substring(0, 100) + "..." : text,
          language: usedLanguage,
          voice: usedVoice,
        }) + (usedMode === "voice_clone" ? " 🎭" : ""),
      }).catch(console.error);

    } catch (error) {
      console.error("[say] Error:", error);
      return interaction.editReply({
        content: i18n.__("say.errorGenerate"),
      }).catch(console.error);
    }
  },
};
