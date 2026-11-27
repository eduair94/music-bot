import { Document, Schema, Types, model } from "mongoose";
import {
    BUS_COMMANDS,
    type BotCommandParams as BotCommandParamsBase,
    type BotCommandType as BotCommandTypeBase,
    type CommandStatus
} from "../shared/types";

// Re-export shared types for backwards compatibility
export type BotCommandType = BotCommandTypeBase;
export type BotCommandParams = BotCommandParamsBase;

/**
 * Bot Command Interface
 * 
 * This model represents commands sent from the dashboard to the bot.
 * The dashboard creates commands, and the bot polls and executes them.
 * The primary also uses it to hand work to other fleet instances: each
 * instance only runs commands whose `instance` is its own (missing = 1).
 */
export interface IBotCommand {
  _id?: Types.ObjectId;
  guildId?: string;     // Optional for linked bot commands
  instance?: number;    // Fleet instance that runs it (default 1)
  userId?: string;      // Optional for linked bot commands
  botId?: string;       // For linked bot commands
  type?: string;        // Alternative to command for linked bot commands
  command?: BotCommandType;
  params?: BotCommandParams;
  status: CommandStatus;
  result?: string;
  data?: unknown;       // Structured result (search: { results })
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
    instance: {
      type: Number,
      default: 1,
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
      // Every command in the dashboard v2 contract, plus linked-bot control.
      enum: [...BUS_COMMANDS, "linked_bot_start", "linked_bot_stop", "linked_bot_restart"]
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
      textChannelId: { type: String },
      enabled: { type: Boolean },
      name: { type: String },
      level: { type: String, enum: ["off", "low", "medium", "high"] },
      positions: { type: [Number], default: undefined },
      next: { type: Boolean },
      now: { type: Boolean },
      autoplay: { type: Boolean },
      source: { type: String },
      locale: { type: String },
      // play: a saved collection handed to a fleet instance (first song = query).
      savedCollection: {
        type: new Schema(
          {
            name: { type: String },
            tracks: [
              new Schema(
                { title: String, author: String, url: String, thumbnail: String, duration: Number },
                { _id: false }
              ),
            ],
          },
          { _id: false }
        ),
        default: undefined,
      },
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    result: { type: String },
    data: { type: Schema.Types.Mixed },
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

// Compound indexes for efficient polling (each instance polls its own commands)
botCommandSchema.index({ guildId: 1, status: 1, createdAt: 1 });
botCommandSchema.index({ status: 1, instance: 1, createdAt: 1 });

// Index for linked bot commands
botCommandSchema.index({ type: 1, status: 1, createdAt: 1 });
botCommandSchema.index({ botId: 1, status: 1 });

// TTL index - auto-delete old commands after 5 minutes
botCommandSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

// Export the model
export const BotCommand = model<IBotCommand>("BotCommand", botCommandSchema);
export default BotCommand;
