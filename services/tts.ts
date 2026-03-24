import Replicate from "replicate";
import { ITTSConfig, TTSConfig } from "../models/TTSConfig";

/**
 * Text-to-Speech Service using Replicate's Qwen3-TTS model
 * 
 * Features:
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 * - Voice cloning with reference audio
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

class TTSService {
  private static instance: TTSService;
  private replicate: Replicate | null = null;

  private constructor() {}

  public static getInstance(): TTSService {
    if (!this.instance) {
      this.instance = new TTSService();
    }
    return this.instance;
  }

  /**
   * Initialize the Replicate client
   */
  public initialize(): void {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!apiToken) {
      console.warn("[TTS] ⚠️ REPLICATE_API_TOKEN not set. TTS features will be disabled.");
      return;
    }

    this.replicate = new Replicate({
      auth: apiToken,
    });
    
    console.log("[TTS] ✅ Replicate TTS service initialized");
  }

  /**
   * Check if the TTS service is available
   */
  public isAvailable(): boolean {
    return this.replicate !== null;
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
   * Generate speech from text using Qwen3-TTS
   */
  public async generateSpeech(options: TTSOptions, userConfig?: ITTSConfig | null): Promise<TTSResult> {
    if (!this.replicate) {
      throw new Error("TTS service not initialized. Please set REPLICATE_API_TOKEN.");
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
