import mongoose, { Schema } from "mongoose";

/**
 * Daily metrics snapshot (read model for the dashboard).
 * Same collection the bot writes to once per day.
 */
export interface IMetricsSnapshot {
  date: string;
  totalGuilds: number;
  totalMembers: number;
  activeGuilds: number;
  premiumUsers: number;
  founders: number;
  capturedAt: Date;
}

const metricsSnapshotSchema = new Schema<IMetricsSnapshot>({
  date: { type: String, required: true, unique: true, index: true },
  totalGuilds: { type: Number, default: 0 },
  totalMembers: { type: Number, default: 0 },
  activeGuilds: { type: Number, default: 0 },
  premiumUsers: { type: Number, default: 0 },
  founders: { type: Number, default: 0 },
  capturedAt: { type: Date, default: Date.now },
});

export const MetricsSnapshot =
  mongoose.models.MetricsSnapshot ||
  mongoose.model<IMetricsSnapshot>("MetricsSnapshot", metricsSnapshotSchema);

export default MetricsSnapshot;
