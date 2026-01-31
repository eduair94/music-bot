import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { ttsService, TTSLanguage, TTSSpeaker } from "../services/tts";
import { i18n } from "../utils/i18n";

/**
 * /say command - Text-to-Speech using Replicate's Qwen3-TTS
 * 
 * Features:
 * - Converts text to speech and plays it in voice channel
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 */

const LANGUAGES: TTSLanguage[] = ["Spanish", "English", "French", "German", "Italian", "Portuguese", "Chinese", "Japanese", "Korean"];
const SPEAKERS: TTSSpeaker[] = ["Aiden", "Aria", "Aurora", "Luna", "River", "Sage", "Willow"];

export default {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription(i18n.__("say.description"))
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Text to convert to speech")
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Language for speech (default: Spanish)")
        .setRequired(false)
        .addChoices(...LANGUAGES.map(lang => ({ name: lang, value: lang })))
    )
    .addStringOption((option) =>
      option
        .setName("voice")
        .setDescription("Voice to use (default: Aiden)")
        .setRequired(false)
        .addChoices(...SPEAKERS.map(speaker => ({ name: speaker, value: speaker })))
    ),
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString("text", true);
    const language = (interaction.options.getString("language") || "Spanish") as TTSLanguage;
    const voice = (interaction.options.getString("voice") || "Aiden") as TTSSpeaker;
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;

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
        content: "❌ Music player is still initializing. Please try again in a few seconds.",
        ephemeral: true,
      }).catch(console.error);
    }

    await interaction.deferReply();
    const textChannel = interaction.channel as TextChannel;

    try {
      // Generate speech using TTS service
      const result = await ttsService.generateSpeech({
        text,
        language,
        speaker: voice,
      });

      // Play the generated audio
      const playResult = await playerService.play(voiceChannel, result.url, textChannel);

      if (!playResult) {
        return interaction.editReply({
          content: i18n.__("say.errorGenerate"),
        }).catch(console.error);
      }

      return interaction.editReply({
        content: i18n.__mf("say.success", { 
          text: text.length > 100 ? text.substring(0, 100) + "..." : text,
          language,
          voice,
        }),
      }).catch(console.error);

    } catch (error) {
      console.error("[say] Error:", error);
      return interaction.editReply({
        content: i18n.__("say.errorGenerate"),
      }).catch(console.error);
    }
  },
};
