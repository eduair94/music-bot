import { Schema, model } from "mongoose";

/**
 * Daily AI use counter. `_id` is "<bucket>:<guildId>:<YYYY-MM-DD>" (UTC day);
 * documents expire two days after they are created.
 */
export interface IAiQuota {
  _id: string;
  count: number;
  createdAt: Date;
}

const aiQuotaSchema = new Schema<IAiQuota>(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 48 }
  },
  { versionKey: false }
);

export const AiQuota = model<IAiQuota>("AiQuota", aiQuotaSchema, "aiquota");
