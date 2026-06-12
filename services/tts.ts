import axios from "axios";
import fs from "fs";
import path from "path";
import Replicate from "replicate";
import { ITTSConfig, TTSConfig } from "../models/TTSConfig";

/**
 * Text-to-Speech Service
 *
 * Providers (in priority order):
 * - Google Gemini TTS (GEMINI_API_KEY) - default provider
 * - Replicate's Qwen3-TTS (REPLICATE_API_TOKEN) - fallback, required for voice cloning
 *
 * Features:
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 * - Voice cloning with reference audio (Replicate only)
 * - User-specific configuration persistence
 */

export type TTSLanguage = "Spanish" | "English" | "French" | "German" | "Italian" | "Portuguese" | "Chinese" | "Japanese" | "Korean";
export type TTSSpeaker = "Aiden" | "Aria" | "Aurora" | "Luna" | "River" | "Sage" | "Willow";
export type TTSMode = "custom_voice" | "voice_clone";

export const TTS_LANGUAGES: TTSLanguage[] = ["Spanish", "English", "French", "German", "Italian", "Portuguese", "Chinese", "Japanese", "Korean"];
export const TTS_SPEAKERS: TTSSpeaker[] = ["Aiden", "Aria", "Aurora", "Luna", "River", "Sage", "Willow"];

export interface TTSOptions {
  text: string;
  mode?: TTSMode;
  language?: TTSLanguage;
  speaker?: TTSSpeaker;
  // Voice clone options
  referenceText?: string;
  referenceAudioUrl?: string;
  styleInstruction?: string;
  voiceDescription?: string;
}

export interface TTSResult {
  url: string;
}

export interface TTSConfigUpdate {
  mode?: TTSMode;
  language?: string;
  speaker?: string;
  referenceText?: string | null;
  referenceAudioUrl?: string | null;
  styleInstruction?: string | null;
  voiceDescription?: string | null;
}

/** Maps the bot's speaker names to Gemini TTS prebuilt voices */
const GEMINI_VOICE_MAP: Record<TTSSpeaker, string> = {
  Aiden: "Puck",
  Aria: "Kore",
  Aurora: "Aoede",
  Luna: "Leda",
  River: "Charon",
  Sage: "Orus",
  Willow: "Zephyr",
};

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

class TTSService {
  private static instance: TTSService;
  private replicate: Replicate | null = null;
  private geminiApiKey: string | null = null;

  private constructor() {}

  public static getInstance(): TTSService {
    if (!this.instance) {
      this.instance = new TTSService();
    }
    return this.instance;
  }

  /**
   * Initialize TTS providers (Google Gemini preferred, Replicate fallback)
   */
  public initialize(): void {
    const geminiKey = process.env.GEMINI_API_KEY;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (geminiKey) {
      this.geminiApiKey = geminiKey;
      console.log("[TTS] ✅ Google Gemini TTS service initialized");
    }

    if (replicateToken) {
      this.replicate = new Replicate({
        auth: replicateToken,
      });
      console.log("[TTS] ✅ Replicate TTS service initialized");
    }

    if (!geminiKey && !replicateToken) {
      console.warn("[TTS] ⚠️ Neither GEMINI_API_KEY nor REPLICATE_API_TOKEN set. TTS features will be disabled.");
    }
  }

  /**
   * Check if the TTS service is available
   */
  public isAvailable(): boolean {
    return this.geminiApiKey !== null || this.replicate !== null;
  }

  /**
   * Get user's TTS configuration
   */
  public async getConfig(userId: string, guildId?: string): Promise<ITTSConfig | null> {
    try {
      // First try to find guild-specific config
      if (guildId) {
        const guildConfig = await TTSConfig.findOne({ userId, guildId });
        if (guildConfig) return guildConfig.toObject();
      }
      
      // Fall back to user's global config
      const globalConfig = await TTSConfig.findOne({ userId, guildId: null });
      return globalConfig?.toObject() || null;
    } catch (error) {
      console.error("[TTS] Error getting config:", error);
      return null;
    }
  }

  /**
   * Save user's TTS configuration
   */
  public async saveConfig(userId: string, guildId: string | null, config: TTSConfigUpdate): Promise<ITTSConfig> {
    try {
      const filter = { userId, guildId: guildId || null };
      const update = {
        ...config,
        userId,
        guildId: guildId || null,
      };
      
      const result = await TTSConfig.findOneAndUpdate(
        filter,
        { $set: update },
        { upsert: true, new: true }
      );
      
      console.log(`[TTS] ✅ Config saved for user ${userId}${guildId ? ` in guild ${guildId}` : ' (global)'}`);
      return result.toObject();
    } catch (error) {
      console.error("[TTS] Error saving config:", error);
      throw error;
    }
  }

  /**
   * Delete user's TTS configuration
   */
  public async deleteConfig(userId: string, guildId?: string): Promise<boolean> {
    try {
      const filter = guildId ? { userId, guildId } : { userId, guildId: null };
      const result = await TTSConfig.deleteOne(filter);
      return result.deletedCount > 0;
    } catch (error) {
      console.error("[TTS] Error deleting config:", error);
      return false;
    }
  }

  /**
   * Generate speech from text (Google Gemini TTS preferred, Replicate fallback)
   */
  public async generateSpeech(options: TTSOptions, userConfig?: ITTSConfig | null): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error("TTS service not initialized. Please set GEMINI_API_KEY or REPLICATE_API_TOKEN.");
    }

    // Merge user config with provided options (options override config)
    const mode = options.mode || userConfig?.mode || "custom_voice";
    const language = options.language || userConfig?.language || "Spanish";
    const speaker = options.speaker || userConfig?.speaker || "Aiden";
    const referenceText = options.referenceText || userConfig?.referenceText;
    const referenceAudioUrl = options.referenceAudioUrl || userConfig?.referenceAudioUrl;
    const styleInstruction = options.styleInstruction || userConfig?.styleInstruction;
    const voiceDescription = options.voiceDescription || userConfig?.voiceDescription;

    console.log(`[TTS] 🎤 Generating speech (${mode}): "${options.text.substring(0, 50)}${options.text.length > 50 ? '...' : ''}" (${language}, ${speaker})`);

    // Voice cloning is only supported by Replicate; everything else prefers Gemini
    const useReplicate = (mode === "voice_clone" && this.replicate) || !this.geminiApiKey;

    if (mode === "voice_clone" && !this.replicate) {
      console.warn("[TTS] ⚠️ voice_clone requested but REPLICATE_API_TOKEN not set — falling back to Gemini prebuilt voice (no cloning)");
    }

    if (!useReplicate) {
      return this.generateSpeechGoogle(options.text, language, speaker as TTSSpeaker, styleInstruction || undefined);
    }

    if (!this.replicate) {
      throw new Error("TTS service not initialized. Please set REPLICATE_API_TOKEN.");
    }

    // Build input based on mode
    const input: Record<string, any> = {
      mode,
      text: options.text,
      speaker,
      language,
    };

    // Add voice clone specific parameters
    if (mode === "voice_clone") {
      if (referenceText) input.reference_text = referenceText;
      if (referenceAudioUrl) input.reference_audio = referenceAudioUrl;
      if (styleInstruction) input.style_instruction = styleInstruction;
      if (voiceDescription) input.voice_description = voiceDescription;
    } else {
      // custom_voice mode can also use voice_description
      if (voiceDescription) input.voice_description = voiceDescription;
    }

    console.log(`[TTS] 📝 Input:`, JSON.stringify(input, null, 2));

    const output = await this.replicate.run("qwen/qwen3-tts", { input });

    // Extract URL from Replicate FileOutput
    const audioUrl = this.extractUrl(output);

    console.log(`[TTS] ✅ Audio generated: ${audioUrl}`);

    return { url: audioUrl };
  }

  /**
   * Generate speech using Google Gemini TTS.
   * Returns a local WAV file path (Gemini returns raw PCM, not a URL).
   */
  private async generateSpeechGoogle(text: string, language: string, speaker: TTSSpeaker, styleInstruction?: string): Promise<TTSResult> {
    const voiceName = GEMINI_VOICE_MAP[speaker] || "Puck";

    // Gemini TTS takes style/language directives as a natural-language prefix
    const instruction = styleInstruction
      ? `${styleInstruction}. Say the following in ${language}:`
      : `Say the following in ${language}:`;
    const prompt = `${instruction} ${text}`;

    console.log(`[TTS] 📝 Gemini input: voice=${voiceName}, prompt="${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      },
      { timeout: 60_000 }
    );

    const parts = response.data?.candidates?.[0]?.content?.parts;
    const inlineData = Array.isArray(parts) ? parts.find((p: any) => p.inlineData?.data)?.inlineData : undefined;

    if (!inlineData) {
      console.error("[TTS] ❌ Unexpected Gemini response:", JSON.stringify(response.data).substring(0, 500));
      throw new Error("No audio data returned from Gemini TTS");
    }

    // mimeType is e.g. "audio/L16;codec=pcm;rate=24000"
    const sampleRate = parseInt(/rate=(\d+)/.exec(inlineData.mimeType || "")?.[1] || "24000", 10);
    const pcm = Buffer.from(inlineData.data, "base64");
    const wav = this.pcmToWav(pcm, sampleRate);

    const dir = path.join(process.cwd(), "temp", "tts");
    fs.mkdirSync(dir, { recursive: true });
    this.cleanupOldTTSFiles(dir);

    const filePath = path.join(dir, `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);
    fs.writeFileSync(filePath, new Uint8Array(wav));

    console.log(`[TTS] ✅ Audio generated: ${filePath} (${(wav.length / 1024).toFixed(1)} KB, ${sampleRate} Hz)`);

    return { url: filePath };
  }

  /**
   * Wrap raw 16-bit mono PCM in a WAV container
   */
  private pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);

    return Buffer.concat([new Uint8Array(header), new Uint8Array(pcm)]);
  }

  /**
   * Remove generated TTS files older than 30 minutes
   */
  private cleanupOldTTSFiles(dir: string): void {
    try {
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.warn("[TTS] ⚠️ Temp file cleanup failed:", error);
    }
  }

  /**
   * Upload reference audio to Replicate for voice cloning
   * Returns the URL that can be used as reference_audio
   */
  public async uploadReferenceAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    if (!this.replicate) {
      throw new Error("TTS service not initialized. Please set REPLICATE_API_TOKEN.");
    }

    try {
      // Convert Buffer to Uint8Array for File constructor compatibility
      const uint8Array = new Uint8Array(audioBuffer);
      const file = new File([uint8Array], filename, { type: this.getMimeType(filename) });
      
      // Upload to Replicate
      const fileOutput = await this.replicate.files.create(file);
      
      console.log(`[TTS] ✅ Reference audio uploaded: ${fileOutput.urls.get}`);
      return fileOutput.urls.get;
    } catch (error) {
      console.error("[TTS] Error uploading reference audio:", error);
      throw error;
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
    };
    return mimeTypes[ext || ''] || 'audio/mpeg';
  }

  /**
   * Extract URL from Replicate output (handles various formats)
   */
  private extractUrl(output: unknown): string {
    let audioUrl: string;
    
    if (typeof output === "string") {
      audioUrl = output;
    } else if (output && typeof output === "object") {
      if ("href" in output && typeof (output as any).href === "string") {
        audioUrl = (output as any).href;
      } else if (typeof (output as any).toString === "function") {
        const str = (output as any).toString();
        if (str.startsWith("http")) {
          audioUrl = str;
        } else {
          audioUrl = String(output);
        }
      } else if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        audioUrl = typeof first === "string" ? first : (first as any).href || String(first);
      } else {
        audioUrl = String(output);
      }
    } else {
      throw new Error("Unexpected output format from Replicate TTS");
    }

    if (typeof audioUrl !== "string" || !audioUrl.startsWith("http")) {
      console.error(`[TTS] ❌ Invalid audio URL: ${audioUrl}`);
      throw new Error("Failed to get valid audio URL from Replicate");
    }

    return audioUrl;
  }
}

export const ttsService = TTSService.getInstance();
