import { Schema, model } from "mongoose";

/**
 * Daily metrics snapshot — one document per calendar day (UTC).
 *
 * Written by the bot once per day so the dashboard can chart real growth over
 * time. Before this existed there was no historical record; growth could only
 * be reconstructed from the join dates of servers still present today.
 */
export interface IMetricsSnapshot {
  /** UTC calendar day, "YYYY-MM-DD" — one snapshot per day */
  date: string;
  /** Servers the bot was in at capture time */
  totalGuilds: number;
  /** Sum of member counts across all servers (reach) */
  totalMembers: number;
  /** Servers actively playing at capture time */
  activeGuilds: number;
  /** Active premium patrons */
  premiumUsers: number;
  /** Founder-tier patrons */
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

export const MetricsSnapshot = model<IMetricsSnapshot>("MetricsSnapshot", metricsSnapshotSchema);
export default MetricsSnapshot;
