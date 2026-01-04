import { Document, Schema, Types, model } from "mongoose";
import type {
    BotCommandParams as BotCommandParamsBase,
    BotCommandType as BotCommandTypeBase,
    CommandStatus
} from "../shared/types";

// Re-export shared types for backwards compatibility
export type BotCommandType = BotCommandTypeBase;
export type BotCommandParams = BotCommandParamsBase;

/**
 * Bot Command Interface
 * 
 * This model represents commands sent from the dashboard to the bot.
 * The dashboard creates commands, and the bot polls and executes them.
 */
export interface IBotCommand {
  _id?: Types.ObjectId;
  guildId?: string;     // Optional for linked bot commands
  userId?: string;      // Optional for linked bot commands
  botId?: string;       // For linked bot commands
  type?: string;        // Alternative to command for linked bot commands
  command?: BotCommandType;
  params?: BotCommandParams;
  status: CommandStatus;
  result?: string;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  requestedBy?: {
    id: string;
    username: string;
  };
}

// Document type for Mongoose
export type BotCommandDocument = IBotCommand & Document;

// Bot Command Schema
const botCommandSchema = new Schema<IBotCommand>(
  {
    guildId: { 
      type: String, 
      index: true 
    },
    userId: {
      type: String,
    },
    botId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
    },
    command: { 
      type: String, 
      enum: [
        "play", "pause", "resume", "skip", "stop",
        "volume", "shuffle", "loop", "remove", "skipto",
        "move", "clear", "seek",
        "linked_bot_start", "linked_bot_stop", "linked_bot_restart"
      ]
    },
    params: {
      query: { type: String },
      volume: { type: Number },
      loopMode: { type: String, enum: ["off", "track", "queue"] },
      position: { type: Number },
      from: { type: Number },
      to: { type: Number },
      seconds: { type: Number },
      voiceChannelId: { type: String },
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    result: { type: String },
    error: { type: String },
    processedAt: { type: Date },
    requestedBy: {
      id: { type: String },
      username: { type: String },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for efficient polling
botCommandSchema.index({ guildId: 1, status: 1, createdAt: 1 });

// Index for linked bot commands
botCommandSchema.index({ type: 1, status: 1, createdAt: 1 });
botCommandSchema.index({ botId: 1, status: 1 });

// TTL index - auto-delete old commands after 5 minutes
botCommandSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

// Export the model
export const BotCommand = model<IBotCommand>("BotCommand", botCommandSchema);
export default BotCommand;
