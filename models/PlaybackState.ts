import { Schema, model, Document, Model } from "mongoose";
import type { ITrack as ITrackBase, IPlaybackState as IPlaybackStateBase, LoopMode, TrackSource } from "../shared/types";

// Re-export shared types for backwards compatibility
export type { ITrackBase as ITrack, IPlaybackStateBase as IPlaybackState };

// Create local aliases for use in this file
type ITrack = ITrackBase;
type IPlaybackState = IPlaybackStateBase;

// Document type for Mongoose
export type PlaybackStateDocument = IPlaybackState & Document;

// Track sub-schema
const trackSchema = new Schema<ITrack>(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    requestedBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      avatar: { type: String, default: null },
    },
    source: {
      type: String,
      enum: ["youtube", "spotify", "soundcloud", "file", "unknown"],
      default: "unknown",
    },
  },
  { _id: false }
);

// Playback State Schema
const playbackStateSchema = new Schema<IPlaybackState>(
  {
    guildId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    
    // Connection State
    isConnected: { type: Boolean, default: false },
    voiceChannelId: { type: String, default: null },
    voiceChannelName: { type: String, default: null },
    textChannelId: { type: String, default: null },
    
    // Playback State
    isPlaying: { type: Boolean, default: false },
    isPaused: { type: Boolean, default: false },
    volume: { type: Number, default: 80 },
    
    // Current Track
    currentTrack: { type: trackSchema, default: null },
    currentPosition: { type: Number, default: 0 },
    
    // Queue
    queue: { type: [trackSchema], default: [] },
    queueSize: { type: Number, default: 0 },
    
    // Loop State
    loopMode: { 
      type: String, 
      enum: ["off", "track", "queue"],
      default: "off"
    },
    
    // Audio Quality
    audioBitrate: { type: Number, default: 128 },
    
    // Timestamps
    lastUpdated: { type: Date, default: Date.now },
    playbackStartedAt: { type: Date, default: null },
  },
  {
    timestamps: false, // We manage lastUpdated manually
  }
);

// TTL index - auto-delete stale states after 1 hour
playbackStateSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 3600 });

// Export the model
export const PlaybackState = model<IPlaybackState>("PlaybackState", playbackStateSchema);
export default PlaybackState;
