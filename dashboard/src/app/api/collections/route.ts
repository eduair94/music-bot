import { auth } from "@/auth";
import { Collection, ICollection } from "@/lib/models/Collection";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

// GET all collections for the current user
export async function GET() {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    const collections = await Collection.find({ userId: session.user.discordId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(collections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create a new collection
export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, isPublic, tracks } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Collection name is required" }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Collection name must be 100 characters or less" }, { status: 400 });
    }

    await connectToDatabase();

    // Check for duplicate name
    const existing = await Collection.findOne({ 
      userId: session.user.discordId, 
      name: name.trim() 
    });
    
    if (existing) {
      return NextResponse.json({ error: "A collection with this name already exists" }, { status: 400 });
    }

    const collection = await Collection.create({
      userId: session.user.discordId,
      name: name.trim(),
      description: description?.trim() || "",
      isPublic: isPublic || false,
      tracks: tracks || [],
      shareCode: isPublic ? crypto.randomBytes(6).toString("hex") : undefined,
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
