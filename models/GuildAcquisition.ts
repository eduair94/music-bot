import { type Model, model, models, Schema } from "mongoose";

/**
 * Where each server came from and what happened next (collection
 * `guildacquisitions`, one document per guild). Written by the primary bot
 * (services/growth/acquisition.ts); read by the dashboard's admin Growth panel.
 *
 * Never holds GA client/session ids: those are used once for the GA4 event
 * and dropped.
 */
export interface IGuildAcquisition {
  guildId: string;
  name: string;
  memberCount: number;
  ownerId?: string;
  /** Source of the FIRST join (ref code, "direct", or "pre-tracking" for backfilled servers). Never overwritten. */
  ref: string;
  /** Source of the most recent rejoin. */
  lastRef?: string;
  /** Website button that was clicked (`site-hero`…), when the click came from our site. */
  placement?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** ISO country of the click (Cloudflare). */
  country?: string;
  /** When the matched invite click happened. */
  clickTs?: Date;
  /** Latest join. */
  joinedAt: Date;
  /** First song played in this server (any Bypass instance). */
  firstPlayAt?: Date;
  /** Set while the bot is out of the server. */
  leftAt?: Date;
  rejoins: number;
  /** Created at startup for a server that joined before tracking existed. */
  backfilled?: boolean;
  /** The referrer (`ref: u-<id>`) already got their reward for this server. */
  referralRewardedAt?: Date;
}

const guildAcquisitionSchema = new Schema<IGuildAcquisition>(
  {
    guildId: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    memberCount: { type: Number, default: 0 },
    ownerId: String,
    ref: { type: String, required: true },
    lastRef: String,
    placement: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    country: String,
    clickTs: Date,
    joinedAt: { type: Date, required: true },
    firstPlayAt: Date,
    leftAt: Date,
    rejoins: { type: Number, default: 0 },
    backfilled: Boolean,
    referralRewardedAt: Date
  },
  { collection: "guildacquisitions", versionKey: false, minimize: true }
);

guildAcquisitionSchema.index({ ref: 1, joinedAt: -1 });
guildAcquisitionSchema.index({ joinedAt: -1 });
guildAcquisitionSchema.index({ ref: 1, referralRewardedAt: -1 });

export const GuildAcquisition =
  (models.GuildAcquisition as Model<IGuildAcquisition> | undefined) ??
  model<IGuildAcquisition>("GuildAcquisition", guildAcquisitionSchema);
export default GuildAcquisition;
