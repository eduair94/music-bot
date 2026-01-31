import http from "http";
import https from "https";
import Replicate from "replicate";
import { Readable } from "stream";

/**
 * Text-to-Speech Service using Replicate's Qwen3-TTS model
 * 
 * Features:
 * - Multi-language support (Spanish by default)
 * - Multiple voice options
 * - Returns audio as a readable stream for Discord playback
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
  stream: Readable;
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

    const output = await this.replicate.run("qwen/qwen3-tts", { input }) as { url: () => string };

    const audioUrl = output.url();
    console.log(`[TTS] ✅ Audio generated: ${audioUrl}`);

    // Fetch the audio as a stream
    const stream = await this.fetchAudioStream(audioUrl);

    return {
      url: audioUrl,
      stream,
    };
  }

  /**
   * Fetch audio from URL as a readable stream
   */
  private fetchAudioStream(url: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.fetchAudioStream(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch audio: HTTP ${response.statusCode}`));
          return;
        }

        resolve(response);
      }).on("error", reject);
    });
  }
}

export const ttsService = TTSService.getInstance();
