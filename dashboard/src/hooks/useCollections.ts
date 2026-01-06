"use client";

import { useState, useEffect, useCallback } from "react";

export interface CollectionTrack {
  title: string;
  author: string;
  url: string;
  duration: number;
  thumbnail?: string;
  addedAt: Date;
  addedBy?: string;
}

export interface Collection {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  tracks: CollectionTrack[];
  isPublic: boolean;
  shareCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UseCollectionsReturn {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCollection: (name: string, description?: string, isPublic?: boolean) => Promise<Collection | null>;
  updateCollection: (id: string, data: Partial<Collection>) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  addTracks: (collectionId: string, tracks: Partial<CollectionTrack>[]) => Promise<boolean>;
  removeTracks: (collectionId: string, indexes: number[]) => Promise<boolean>;
  saveQueueToCollection: (collectionId: string, queue: Partial<CollectionTrack>[]) => Promise<boolean>;
}

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/collections");
      if (!res.ok) throw new Error("Failed to fetch collections");
      const data = await res.json();
      setCollections(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const createCollection = useCallback(async (
    name: string, 
    description?: string, 
    isPublic?: boolean
  ): Promise<Collection | null> => {
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPublic }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create collection");
      }
      
      const collection = await res.json();
      setCollections(prev => [collection, ...prev]);
      return collection;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    }
  }, []);

  const updateCollection = useCallback(async (
    id: string, 
    data: Partial<Collection>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to update collection");
      
      const updated = await res.json();
      setCollections(prev => prev.map(c => c._id === id ? updated : c));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, []);

  const deleteCollection = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete collection");
      
      setCollections(prev => prev.filter(c => c._id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, []);

  const addTracks = useCallback(async (
    collectionId: string, 
    tracks: Partial<CollectionTrack>[]
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/${collectionId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks }),
      });
      
      if (!res.ok) throw new Error("Failed to add tracks");
      
      await fetchCollections();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, [fetchCollections]);

  const removeTracks = useCallback(async (
    collectionId: string, 
    indexes: number[]
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/${collectionId}/tracks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexes }),
      });
      
      if (!res.ok) throw new Error("Failed to remove tracks");
      
      await fetchCollections();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, [fetchCollections]);

  const saveQueueToCollection = useCallback(async (
    collectionId: string, 
    queue: Partial<CollectionTrack>[]
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: queue }),
      });
      
      if (!res.ok) throw new Error("Failed to save queue");
      
      await fetchCollections();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, [fetchCollections]);

  return {
    collections,
    loading,
    error,
    refresh: fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    addTracks,
    removeTracks,
    saveQueueToCollection,
  };
}
