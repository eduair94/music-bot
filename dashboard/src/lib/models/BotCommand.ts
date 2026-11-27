import { Document, Schema, Types, model, models } from "mongoose";
import {
    BUS_COMMANDS,
    type BotCommandParams,
    type BotCommandType,
    type CommandStatus
} from "../../../../shared/types";

// Re-export shared types for backwards compatibility
export type { BotCommandParams, BotCommandType };

export interface IBotCommand {
  _id?: Types.ObjectId;
  guildId?: string;  // Optional for linked bot commands
  instance?: number; // Fleet instance that runs it (default 1)
  userId?: string;   // Optional for linked bot commands
  botId?: string;    // For linked bot commands
  type?: string;     // Alternative to command for linked bot commands
  command?: BotCommandType;
  params?: BotCommandParams;
  status: CommandStatus;
  result?: string;
  data?: unknown;    // Structured result (search: { results })
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  requestedBy?: {
    id: string;
    username: string;
  };
}

export type BotCommandDocument = IBotCommand & Document;

const botCommandSchema = new Schema<IBotCommand>(
  {
    guildId: { type: String, index: true },
    instance: { type: Number, default: 1 },
    userId: { type: String },
    botId: { type: String, index: true },  // For linked bot commands
    type: { type: String },  // Alternative to command
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
      id: { type: String, required: true },
      username: { type: String, required: true },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const BotCommand = models.BotCommand || model<IBotCommand>("BotCommand", botCommandSchema);
export default BotCommand;
