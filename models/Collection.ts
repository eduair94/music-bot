import { Schema, model, Document } from "mongoose";

/**
 * Track Item Interface - Represents a saved track in a collection
 */
export interface ICollectionTrack {
  title: string;
  author: string;
  url: string;
  duration: number; // Duration in seconds
  thumbnail?: string;
  addedAt: Date;
  addedBy?: string; // User ID who added this track
}

/**
 * Collection Interface - User-created playlist
 */
export interface ICollection extends Document {
  userId: string; // Owner of the collection
  name: string; // Collection name
  description?: string;
  tracks: ICollectionTrack[];
  isPublic: boolean; // Whether others can view/play
  shareCode?: string; // Unique share code for sharing
  createdAt: Date;
  updatedAt: Date;
}

const collectionTrackSchema = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    url: { type: String, required: true },
    duration: { type: Number, required: true },
    thumbnail: { type: String },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: String },
  },
  { _id: false }
);

const collectionSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    tracks: {
      type: [collectionTrackSchema],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareCode: {
      type: String,
      unique: true,
      sparse: true, // Allows null values
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index for user + name uniqueness
collectionSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for share code lookups
collectionSchema.index({ shareCode: 1 });

export const Collection = model<ICollection>("Collection", collectionSchema);
