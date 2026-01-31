import Replicate from "replicate";

/**
 * Text-to-Speech Service using Replicate's Qwen3-TTS model
 * 
 * Features:
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 * - Returns audio URL for Discord playback
 */

export type TTSLanguage = "Spanish" | "English" | "French" | "German" | "Italian" | "Portuguese" | "Chinese" | "Japanese" | "Korean";
export type TTSSpeaker = "Aiden" | "Aria" | "Aurora" | "Luna" | "River" | "Sage" | "Willow";

export interface TTSOptions {
  text: string;
  language?: TTSLanguage;
  speaker?: TTSSpeaker;
}

export interface TTSResult {
  url: string;
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
   * Generate speech from text using Qwen3-TTS
   */
  public async generateSpeech(options: TTSOptions): Promise<TTSResult> {
    if (!this.replicate) {
      throw new Error("TTS service not initialized. Please set REPLICATE_API_TOKEN.");
    }

    const { text, language = "Spanish", speaker = "Aiden" } = options;

    console.log(`[TTS] 🎤 Generating speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (${language}, ${speaker})`);

    const input = {
      mode: "custom_voice",
      text,
      speaker,
      language,
    };

    const output = await this.replicate.run("qwen/qwen3-tts", { input });

    // Handle different response formats from Replicate
    let audioUrl: string;
    if (typeof output === "string") {
      audioUrl = output;
    } else if (output && typeof output === "object") {
      // Could be a FileOutput object with url() method or a direct URL property
      if ("url" in output && typeof (output as any).url === "function") {
        audioUrl = (output as any).url();
      } else if ("url" in output && typeof (output as any).url === "string") {
        audioUrl = (output as any).url;
      } else if (Array.isArray(output) && output.length > 0) {
        // Sometimes returns an array of URLs
        audioUrl = typeof output[0] === "string" ? output[0] : (output[0] as any).url?.() || (output[0] as any).url;
      } else {
        // Try to extract href or toString
        audioUrl = (output as any).href || String(output);
      }
    } else {
      throw new Error("Unexpected output format from Replicate TTS");
    }

    console.log(`[TTS] ✅ Audio generated: ${audioUrl}`);

    // Return only the URL - let the player service handle streaming
    return {
      url: audioUrl,
    };
  }
}

export const ttsService = TTSService.getInstance();
