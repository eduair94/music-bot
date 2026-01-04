import { Schema, model, models, Document, Types } from "mongoose";
import type { 
  BotCommandType, 
  BotCommandParams, 
  CommandStatus,
  LoopMode 
} from "../../../../shared/types";

// Re-export shared types for backwards compatibility
export type { BotCommandType, BotCommandParams };

export interface IBotCommand {
  _id?: Types.ObjectId;
  guildId?: string;  // Optional for linked bot commands
  userId?: string;   // Optional for linked bot commands
  botId?: string;    // For linked bot commands
  type?: string;     // Alternative to command for linked bot commands
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

export type BotCommandDocument = IBotCommand & Document;

const botCommandSchema = new Schema<IBotCommand>(
  {
    guildId: { type: String, index: true },
    userId: { type: String },
    botId: { type: String, index: true },  // For linked bot commands
    type: { type: String },  // Alternative to command
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
