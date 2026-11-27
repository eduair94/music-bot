import { Schema, model } from "mongoose";

/**
 * One billed Claude call: which credit key served it and what it cost.
 * Read back per month and key so no key spends past its included credits
 * (services/ai/claudeCredits.ts).
 */
export interface IClaudeUsage {
  month: string; // "2026-11"
  key: string; // key label, never the key itself
  feature: string; // "ai_playlist", "ai_radio"
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: Date;
}

const claudeUsageSchema = new Schema<IClaudeUsage>(
  {
    month: { type: String, required: true },
    key: { type: String, required: true },
    feature: { type: String, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 }
  },
  { versionKey: false }
);
claudeUsageSchema.index({ month: 1, key: 1 });

export const ClaudeUsage = model<IClaudeUsage>("ClaudeUsage", claudeUsageSchema, "claudeusage");
