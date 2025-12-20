import mongoose from "mongoose";

/**
 * DatabaseService - Manages MongoDB connection
 * 
 * This service provides a singleton pattern for database connectivity
 * and handles connection lifecycle management.
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private connected = false;

  private constructor() {
    // Set up connection event handlers once
    // Note: mongoose.connection inherits from EventEmitter but TypeScript types
    // in mongoose v9 don't properly expose the 'on' method, so we cast it
    const connection = mongoose.connection as any;
    
    connection.on("error", (error: Error) => {
      console.error("[Database] ❌ MongoDB connection error:", error);
    });

    connection.on("disconnected", () => {
      console.log("[Database] ⚠️ MongoDB disconnected");
      this.connected = false;
    });

    connection.on("reconnected", () => {
      console.log("[Database] 🔄 MongoDB reconnected");
      this.connected = true;
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!this.instance) {
      this.instance = new DatabaseService();
    }
    return this.instance;
  }

  /**
   * Connect to MongoDB
   * @param uri MongoDB connection string
   */
  public async connect(uri: string): Promise<void> {
    if (this.connected) {
      console.log("[Database] Already connected to MongoDB");
      return;
    }

    if (!uri) {
      console.log("[Database] ⚠️ No MongoDB URI provided - running without database");
      console.log("[Database] ⚠️ Guild settings will not persist across restarts");
      return;
    }

    try {
      console.log("[Database] 🔌 Connecting to MongoDB...");
      
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.connected = true;
      console.log("[Database] ✅ Connected to MongoDB successfully!");

    } catch (error) {
      console.error("[Database] ❌ Failed to connect to MongoDB:", error);
      console.log("[Database] ⚠️ Continuing without database - settings won't persist");
    }
  }

  /**
   * Check if connected to database
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await mongoose.disconnect();
      this.connected = false;
      console.log("[Database] 🔌 Disconnected from MongoDB");
    } catch (error) {
      console.error("[Database] ❌ Error disconnecting from MongoDB:", error);
    }
  }
}

// Export singleton getter for convenience
export function useDatabase(): DatabaseService {
  return DatabaseService.getInstance();
}
