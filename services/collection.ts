import { Track } from "discord-player";
import { nanoid } from "nanoid";
import { Collection, ICollection, ICollectionTrack } from "../models/Collection";

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
   * Get all collections for a user
   */
  async getUserCollections(userId: string): Promise<ICollection[]> {
    return await Collection.find({ userId }).sort({ updatedAt: -1 });
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
   * Get a collection by ID
   */
  async getById(collectionId: string): Promise<ICollection | null> {
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

    const newTracks: ICollectionTrack[] = tracks.map((track) => ({
      title: track.title,
      author: track.author,
      url: track.url,
      duration: track.durationMS / 1000,
      thumbnail: track.thumbnail,
      addedAt: new Date(),
      addedBy: userId,
    }));

    collection.tracks.push(...newTracks);
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
    // Prepare tracks
    const allTracks: ICollectionTrack[] = [];

    if (currentTrack) {
      allTracks.push({
        title: currentTrack.title,
        author: currentTrack.author,
        url: currentTrack.url,
        duration: currentTrack.durationMS / 1000,
        thumbnail: currentTrack.thumbnail,
        addedAt: new Date(),
        addedBy: userId,
      });
    }

    for (const track of tracks) {
      allTracks.push({
        title: track.title,
        author: track.author,
        url: track.url,
        duration: track.durationMS / 1000,
        thumbnail: track.thumbnail,
        addedAt: new Date(),
        addedBy: userId,
      });
    }

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
      description: `Cloned from ${source.name}`,
      tracks: source.tracks.map((t) => ({ ...t, addedAt: new Date() })),
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

    target.tracks.push(...source.tracks);
    return await target.save();
  }

  /**
   * Get collection count for a user
   */
  async getCollectionCount(userId: string): Promise<number> {
    return await Collection.countDocuments({ userId });
  }

  /**
   * Check if user can create more collections (limit: 50)
   */
  async canCreateCollection(userId: string, limit = 50): Promise<boolean> {
    const count = await this.getCollectionCount(userId);
    return count < limit;
  }
}

export const collectionService = CollectionService.getInstance();
