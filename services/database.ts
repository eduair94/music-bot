import mongoose from "mongoose";
import { config } from "../utils/config";

/**
 * DatabaseService - Manages MongoDB connection
 * 
 * This service provides a singleton pattern for database connectivity
 * and handles connection lifecycle management.
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private connected = false;
  private connectionUri: string = "";
  private reconnecting = false;

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

    connection.on("connected", () => {
      console.log("[Database] ✅ MongoDB connected");
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

    // Store URI for potential reconnection
    this.connectionUri = uri;

    try {
      console.log("[Database] 🔌 Connecting to MongoDB...");
      
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      this.connected = true;
      console.log("[Database] ✅ Connected to MongoDB successfully!");

    } catch (error) {
      console.error("[Database] ❌ Failed to connect to MongoDB:", error);
      console.log("[Database] ⚠️ Continuing without database - settings won't persist");
    }
  }

  /**
   * Check the actual mongoose connection state
   * More reliable than the internal flag
   */
  public getConnectionState(): number {
    return mongoose.connection.readyState;
  }

  /**
   * Check if the database is ready for operations
   * Uses mongoose's actual connection state
   */
  public isReady(): boolean {
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    return mongoose.connection.readyState === 1;
  }

  /**
   * Ensure database connection is ready before operations
   * Attempts to reconnect if disconnected
   * @returns true if connected, false otherwise
   */
  public async ensureConnection(): Promise<boolean> {
    // Already connected
    if (this.isReady()) {
      this.connected = true;
      return true;
    }

    // No URI configured
    const uri = this.connectionUri || config.MONGODB_URI;
    if (!uri) {
      console.log("[Database] ⚠️ No MongoDB URI available for reconnection");
      return false;
    }

    // Already attempting reconnection
    if (this.reconnecting) {
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.isReady();
    }

    // Attempt reconnection
    this.reconnecting = true;
    try {
      console.log("[Database] 🔄 Attempting to reconnect to MongoDB...");
      
      // If there's an existing connection, try to close it first
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      this.connected = true;
      console.log("[Database] ✅ Reconnected to MongoDB successfully!");
      return true;
    } catch (error) {
      console.error("[Database] ❌ Reconnection failed:", error);
      this.connected = false;
      return false;
    } finally {
      this.reconnecting = false;
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
