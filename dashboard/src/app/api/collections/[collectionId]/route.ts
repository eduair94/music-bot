import { auth } from "@/auth";
import { Collection } from "@/lib/models/Collection";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ collectionId: string }>;
}

// GET a single collection
export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;

  try {
    await connectToDatabase();
    
    const collection = await Collection.findOne({
      _id: collectionId,
      userId: session.user.discordId,
    }).lean();

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json(collection);
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT update a collection
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;

  try {
    const body = await request.json();
    const { name, description, isPublic, tracks } = body;

    await connectToDatabase();

    const collection = await Collection.findOne({
      _id: collectionId,
      userId: session.user.discordId,
    });

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Update fields if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Invalid collection name" }, { status: 400 });
      }
      // Check for duplicate name
      const existing = await Collection.findOne({
        userId: session.user.discordId,
        name: name.trim(),
        _id: { $ne: collectionId },
      });
      if (existing) {
        return NextResponse.json({ error: "A collection with this name already exists" }, { status: 400 });
      }
      collection.name = name.trim();
    }

    if (description !== undefined) {
      collection.description = description?.trim() || "";
    }

    if (isPublic !== undefined) {
      collection.isPublic = isPublic;
      if (isPublic && !collection.shareCode) {
        collection.shareCode = crypto.randomBytes(6).toString("hex");
      }
    }

    if (tracks !== undefined) {
      collection.tracks = tracks;
    }

    await collection.save();

    return NextResponse.json(collection);
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE a collection
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collectionId } = await params;

  try {
    await connectToDatabase();

    const result = await Collection.deleteOne({
      _id: collectionId,
      userId: session.user.discordId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
