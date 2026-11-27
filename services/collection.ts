import { Track } from "discord-player";
import { nanoid } from "nanoid";
import { Collection, ICollection, ICollectionTrack } from "../models/Collection";
import { i18n } from "../utils/i18n";

/**
 * Most tracks one collection keeps. The largest queue a server can configure
 * is 1000 songs, so a bigger collection could never be loaded in one go, and
 * the cap keeps each document far below MongoDB's 16 MB limit.
 */
export const MAX_COLLECTION_TRACKS = 1000;

/** Most collections one user can own. */
export const MAX_COLLECTIONS_PER_USER = 50;

/** A collection's name and size, without loading its tracks. */
export interface CollectionSummary {
  id: string;
  name: string;
  count: number;
  shared: boolean;
}

/** A track to store, before it gets its addedAt/addedBy stamp. */
export type NewCollectionTrack = Omit<ICollectionTrack, "addedAt" | "addedBy">;

const OBJECT_ID = /^[a-f\d]{24}$/i;

function fromPlayerTrack(track: Track, userId: string): ICollectionTrack {
  return {
    title: track.title,
    author: track.author,
    url: track.url,
    duration: track.durationMS / 1000,
    thumbnail: track.thumbnail,
    addedAt: new Date(),
    addedBy: userId,
  };
}

/** A plain copy of a stored track (never spread a Mongoose subdocument). */
function copyTrack(track: ICollectionTrack): ICollectionTrack {
  return {
    title: track.title,
    author: track.author,
    url: track.url,
    duration: track.duration,
    thumbnail: track.thumbnail,
    addedAt: track.addedAt ?? new Date(),
    addedBy: track.addedBy,
  };
}

/**
 * CollectionService - Manages user collections/playlists
 */
export class CollectionService {
  private static instance: CollectionService;

  private constructor() {}

  public static getInstance(): CollectionService {
    if (!this.instance) {
      this.instance = new CollectionService();
    }
    return this.instance;
  }

  /**
   * Create a new collection
   */
  async create(
    userId: string,
    name: string,
    description?: string
  ): Promise<ICollection> {
    const collection = new Collection({
      userId,
      name,
      description,
      tracks: [],
      isPublic: false,
    });
    return await collection.save();
  }

  /**
   * Create a collection from a list of tracks (playlist import). Tracks past
   * MAX_COLLECTION_TRACKS are left out; `skipped` says how many.
   */
  async createFromTracks(
    userId: string,
    name: string,
    tracks: NewCollectionTrack[],
    sourceUrl?: string
  ): Promise<{ collection: ICollection; skipped: number }> {
    const kept = tracks.slice(0, MAX_COLLECTION_TRACKS);
    const collection = new Collection({
      userId,
      name,
      tracks: kept.map((t) => ({ ...t, addedAt: new Date(), addedBy: userId })),
      isPublic: false,
      sourceUrl: sourceUrl?.slice(0, 500),
    });
    return { collection: await collection.save(), skipped: tracks.length - kept.length };
  }

  /**
   * Get all collections for a user
   */
  async getUserCollections(userId: string): Promise<ICollection[]> {
    return await Collection.find({ userId }).sort({ updatedAt: -1 });
  }

  /**
   * Names and sizes of a user's collections, most recently updated first,
   * without transferring the tracks (lists and autocomplete).
   */
  async listSummaries(userId: string): Promise<CollectionSummary[]> {
    const rows = await Collection.aggregate<{ _id: unknown; name: string; count: number; shareCode?: string }>([
      { $match: { userId } },
      { $sort: { updatedAt: -1 } },
      { $project: { name: 1, shareCode: 1, count: { $size: { $ifNull: ["$tracks", []] } } } },
    ]);
    return rows.map((r) => ({ id: String(r._id), name: r.name, count: r.count, shared: Boolean(r.shareCode) }));
  }

  /**
   * Get a specific collection by name
   */
  async getByName(
    userId: string,
    name: string
  ): Promise<ICollection | null> {
    return await Collection.findOne({ userId, name });
  }

  /**
   * Get a collection by ID (null for anything that isn't a valid id)
   */
  async getById(collectionId: string): Promise<ICollection | null> {
    if (!OBJECT_ID.test(collectionId ?? "")) return null;
    return await Collection.findById(collectionId);
  }

  /**
   * Get a collection by share code
   */
  async getByShareCode(shareCode: string): Promise<ICollection | null> {
    return await Collection.findOne({ shareCode });
  }

  /**
   * Delete a collection
   */
  async delete(userId: string, name: string): Promise<boolean> {
    const result = await Collection.deleteOne({ userId, name });
    return result.deletedCount > 0;
  }

  /**
   * Rename a collection
   */
  async rename(
    userId: string,
    oldName: string,
    newName: string
  ): Promise<ICollection | null> {
    return await Collection.findOneAndUpdate(
      { userId, name: oldName },
      { name: newName },
      { new: true }
    );
  }

  /**
   * Add tracks to a collection
   */
  async addTracks(
    userId: string,
    name: string,
    tracks: Track[]
  ): Promise<ICollection | null> {
    const collection = await Collection.findOne({ userId, name });
    if (!collection) return null;

    collection.tracks.push(...tracks.map((track) => fromPlayerTrack(track, userId)));
    return await collection.save();
  }

  /**
   * Save current queue as a collection
   */
  async saveQueue(
    userId: string,
    name: string,
    tracks: Track[],
    currentTrack?: Track
  ): Promise<ICollection> {
    const allTracks: ICollectionTrack[] = [];
    if (currentTrack) allTracks.push(fromPlayerTrack(currentTrack, userId));
    for (const track of tracks) allTracks.push(fromPlayerTrack(track, userId));

    // Check if collection exists
    const existing = await Collection.findOne({ userId, name });
    if (existing) {
      existing.tracks = allTracks;
      return await existing.save();
    }

    // Create new
    const collection = new Collection({
      userId,
      name,
      tracks: allTracks,
      isPublic: false,
    });
    return await collection.save();
  }

  /**
   * Remove a track from collection by index
   */
  async removeTrack(
    userId: string,
    name: string,
    index: number
  ): Promise<ICollection | null> {
    const collection = await Collection.findOne({ userId, name });
    if (!collection) return null;
    if (index < 0 || index >= collection.tracks.length) return null;

    collection.tracks.splice(index, 1);
    return await collection.save();
  }

  /**
   * Generate a share code for a collection
   */
  async createShareCode(
    userId: string,
    name: string
  ): Promise<string | null> {
    const shareCode = nanoid(10);
    const collection = await Collection.findOneAndUpdate(
      { userId, name },
      { shareCode, isPublic: true },
      { new: true }
    );
    return collection ? shareCode : null;
  }

  /**
   * Remove share code from a collection
   */
  async removeShareCode(
    userId: string,
    name: string
  ): Promise<ICollection | null> {
    return await Collection.findOneAndUpdate(
      { userId, name },
      { $unset: { shareCode: 1 }, isPublic: false },
      { new: true }
    );
  }

  /**
   * Clone a collection from a share code
   */
  async cloneFromShareCode(
    userId: string,
    shareCode: string,
    newName: string
  ): Promise<ICollection | null> {
    const source = await Collection.findOne({ shareCode });
    if (!source) return null;

    const collection = new Collection({
      userId,
      name: newName,
      description: i18n.__mf("collections.clone.clonedFrom", { name: source.name }).slice(0, 500),
      tracks: source.tracks.map((t) => ({ ...copyTrack(t), addedAt: new Date() })),
      isPublic: false,
    });

    return await collection.save();
  }

  /**
   * Merge two collections
   */
  async merge(
    userId: string,
    sourceName: string,
    targetName: string
  ): Promise<ICollection | null> {
    const source = await Collection.findOne({ userId, name: sourceName });
    const target = await Collection.findOne({ userId, name: targetName });

    if (!source || !target) return null;

    target.tracks.push(...source.tracks.map((t) => copyTrack(t)));
    return await target.save();
  }

  /**
   * Get collection count for a user
   */
  async getCollectionCount(userId: string): Promise<number> {
    return await Collection.countDocuments({ userId });
  }

  /**
   * Check if user can create more collections
   */
  async canCreateCollection(userId: string, limit = MAX_COLLECTIONS_PER_USER): Promise<boolean> {
    const count = await this.getCollectionCount(userId);
    return count < limit;
  }
}

export const collectionService = CollectionService.getInstance();
