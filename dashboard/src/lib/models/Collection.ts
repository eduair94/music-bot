import mongoose, { Schema, model, Model, Document } from "mongoose";

/**
 * Track Item Interface - Represents a saved track in a collection
 */
export interface ICollectionTrack {
  title: string;
  author: string;
  url: string;
  duration: number;
  thumbnail?: string;
  addedAt: Date;
  addedBy?: string;
}

/**
 * Collection Interface - User-created playlist
 */
export interface ICollection extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name: string;
  description?: string;
  tracks: ICollectionTrack[];
  isPublic: boolean;
  shareCode?: string;
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
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

collectionSchema.index({ userId: 1, name: 1 }, { unique: true });

// Prevent model overwrite during hot reloads
export const Collection: Model<ICollection> = 
  mongoose.models.Collection || model<ICollection>("Collection", collectionSchema);
