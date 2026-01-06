import { auth } from "@/auth";
import { Collection, ICollectionTrack } from "@/lib/models/Collection";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ collectionId: string }>;
}

// POST add a track to collection
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;

  try {
    const body = await request.json();
    const { track, tracks } = body;

    await connectToDatabase();

    const collection = await Collection.findOne({
      _id: collectionId,
      userId: session.user.discordId,
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Add single track or multiple tracks
    const tracksToAdd: ICollectionTrack[] = tracks || (track ? [track] : []);
    
    if (tracksToAdd.length === 0) {
      return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
    }

    // Validate and add tracks
    for (const t of tracksToAdd) {
      if (!t.title || !t.url) {
        return NextResponse.json({ error: "Each track must have a title and url" }, { status: 400 });
      }
      
      collection.tracks.push({
        title: t.title,
        author: t.author || "Unknown",
        url: t.url,
        duration: t.duration || 0,
        thumbnail: t.thumbnail,
        addedAt: new Date(),
        addedBy: session.user.discordId,
      });
    }

    await collection.save();

    return NextResponse.json({ 
      success: true, 
      tracksAdded: tracksToAdd.length,
      totalTracks: collection.tracks.length 
    });
  } catch (error) {
    console.error("Error adding tracks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE remove tracks from collection
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;

  try {
    const body = await request.json();
    const { indexes, url } = body;

    await connectToDatabase();

    const collection = await Collection.findOne({
      _id: collectionId,
      userId: session.user.discordId,
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    let removedCount = 0;

    if (indexes && Array.isArray(indexes)) {
      // Remove by indexes (sort descending to avoid index shifting)
      const sortedIndexes = [...indexes].sort((a, b) => b - a);
      for (const index of sortedIndexes) {
        if (index >= 0 && index < collection.tracks.length) {
          collection.tracks.splice(index, 1);
          removedCount++;
        }
      }
    } else if (url) {
      // Remove by URL
      const originalLength = collection.tracks.length;
      collection.tracks = collection.tracks.filter(t => t.url !== url);
      removedCount = originalLength - collection.tracks.length;
    }

    await collection.save();

    return NextResponse.json({ 
      success: true, 
      removedCount,
      totalTracks: collection.tracks.length 
    });
  } catch (error) {
    console.error("Error removing tracks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
