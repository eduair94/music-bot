import { Document, Schema, model } from "mongoose";

/**
 * TTS Configuration Interface
 * 
 * Stores user-specific TTS preferences including voice cloning settings.
 */
export interface ITTSConfig {
  /** Discord user ID */
  userId: string;
  /** Guild ID (optional - for guild-specific settings) */
  guildId?: string | null;
  
  // Voice Settings
  /** TTS mode: custom_voice or voice_clone */
  mode: "custom_voice" | "voice_clone";
  /** Default language */
  language: string;
  /** Default speaker/voice name */
  speaker: string;
  
  // Voice Clone Settings (for mode: voice_clone)
  /** Reference text for voice cloning */
  referenceText?: string | null;
  /** URL to reference audio file for voice cloning */
  referenceAudioUrl?: string | null;
  /** Style instruction for voice generation */
  styleInstruction?: string | null;
  /** Voice description for custom voice generation */
  voiceDescription?: string | null;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITTSConfigDocument extends ITTSConfig, Document {}

const ttsConfigSchema = new Schema<ITTSConfig>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    guildId: {
      type: String,
      default: null,
      index: true,
    },
    
    // Voice Settings
    mode: {
      type: String,
      enum: ["custom_voice", "voice_clone"],
      default: "custom_voice",
    },
    language: {
      type: String,
      default: "Spanish",
    },
    speaker: {
      type: String,
      default: "Aiden",
    },
    
    // Voice Clone Settings
    referenceText: {
      type: String,
      default: null,
    },
    referenceAudioUrl: {
      type: String,
      default: null,
    },
    styleInstruction: {
      type: String,
      default: null,
    },
    voiceDescription: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + guild lookups
ttsConfigSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export const TTSConfig = model<ITTSConfig>("TTSConfig", ttsConfigSchema);
