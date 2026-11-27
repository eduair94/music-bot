import { Document, Schema, model, models } from "mongoose";
import type { IPlaybackState, ITrack } from "../../../../shared/types";

// Re-export shared types for backwards compatibility
export type { IPlaybackState, ITrack };

export type PlaybackStateDocument = IPlaybackState & Document;

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

const playbackStateSchema = new Schema<IPlaybackState>(
  {
    // Unique per (guildId, instance); the bot creates the indexes (services/fleet/playbackState.ts).
    guildId: { type: String, required: true },
    instance: { type: Number, default: 1 },
    isConnected: { type: Boolean, default: false },
    voiceChannelId: { type: String, default: null },
    voiceChannelName: { type: String, default: null },
    textChannelId: { type: String, default: null },
    isPlaying: { type: Boolean, default: false },
    isPaused: { type: Boolean, default: false },
    volume: { type: Number, default: 80 },
    currentTrack: { type: trackSchema, default: null },
    currentPosition: { type: Number, default: 0 },
    queue: { type: [trackSchema], default: [] },
    queueSize: { type: Number, default: 0 },
    loopMode: { 
      type: String, 
      enum: ["off", "track", "queue"],
      default: "off"
    },
    audioBitrate: { type: Number, default: 128 },
    positionAt: { type: Number, default: null },
    autoplay: { type: Boolean, default: false },
    filters: { type: [String], default: [] },
    listeners: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    playbackStartedAt: { type: Date, default: null },
  },
  // The bot owns this collection's indexes; never recreate the pre-fleet
  // unique guildId index from here.
  { autoIndex: false }
);

export const PlaybackState = models.PlaybackState || model<IPlaybackState>("PlaybackState", playbackStateSchema);
export default PlaybackState;
