"use client";

/**
 * Demo-only stand-in for useCollections (NEXT_PUBLIC_DASH_DEMO=1 without a
 * session): same shape, kept in memory, so the setlists screen can be
 * designed and checked without Mongo. Synthetic data.
 */
import { useCallback, useState } from "react";
import type { Collection, CollectionTrack } from "@/hooks/useCollections";

const at = new Date("2026-11-20T21:00:00Z");

function tr(title: string, author: string, duration: number): CollectionTrack {
  return {
    title,
    author,
    duration,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${author}`)}`,
    addedAt: at,
  };
}

const SEED: Collection[] = [
  {
    _id: "demo-1",
    userId: "demo",
    name: "Late night drive",
    description: "Synths for the last hour of the raid.",
    isPublic: true,
    shareCode: "a1b2c3d4e5f6",
    createdAt: at,
    updatedAt: at,
    tracks: [
      tr("Nightcall", "Kavinsky", 258),
      tr("Midnight City", "M83", 243),
      tr("Resonance", "HOME", 211),
      tr("Genesis", "Justice", 234),
      tr("A Real Hero", "College & Electric Youth", 267),
    ],
  },
  {
    _id: "demo-2",
    userId: "demo",
    name: "Daft Punk, front to back",
    isPublic: false,
    createdAt: at,
    updatedAt: at,
    tracks: [
      tr("One More Time", "Daft Punk", 320),
      tr("Digital Love", "Daft Punk", 298),
      tr("Around the World", "Daft Punk", 429),
      tr("Instant Crush", "Daft Punk", 337),
    ],
  },
  {
    _id: "demo-3",
    userId: "demo",
    name: "Karaoke shortlist",
    isPublic: false,
    createdAt: at,
    updatedAt: at,
    tracks: [],
  },
];

export function useDemoCollections() {
  const [collections, setCollections] = useState<Collection[]>(SEED);
  const pause = () => new Promise((r) => setTimeout(r, 350));

  const createCollection = useCallback(async (name: string, description?: string, isPublic?: boolean) => {
    await pause();
    const c: Collection = {
      _id: `demo-${Date.now()}`,
      userId: "demo",
      name,
      description,
      isPublic: Boolean(isPublic),
      shareCode: isPublic ? Math.random().toString(16).slice(2, 14) : undefined,
      tracks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCollections((prev) => [c, ...prev]);
    return c;
  }, []);

  const updateCollection = useCallback(async (id: string, data: Partial<Collection>) => {
    await pause();
    setCollections((prev) =>
      prev.map((c) =>
        c._id === id
          ? { ...c, ...data, shareCode: data.isPublic ? c.shareCode ?? Math.random().toString(16).slice(2, 14) : c.shareCode }
          : c,
      ),
    );
    return true;
  }, []);

  const deleteCollection = useCallback(async (id: string) => {
    await pause();
    setCollections((prev) => prev.filter((c) => c._id !== id));
    return true;
  }, []);

  const removeTracks = useCallback(async (id: string, indexes: number[]) => {
    await pause();
    setCollections((prev) => prev.map((c) => (c._id === id ? { ...c, tracks: c.tracks.filter((_, i) => !indexes.includes(i)) } : c)));
    return true;
  }, []);

  return {
    collections,
    loading: false,
    error: null as string | null,
    refresh: async () => {},
    createCollection,
    updateCollection,
    deleteCollection,
    removeTracks,
  };
}
