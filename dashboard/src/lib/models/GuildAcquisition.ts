import mongoose, { Schema } from "mongoose";

/**
 * Where each server came from (collection `guildacquisitions`, one row per
 * guild). Written by the bot (services/growth/acquisition.ts, schema in
 * models/GuildAcquisition.ts); the dashboard only reads it for the admin
 * Growth panel.
 */
export interface IGuildAcquisition {
  guildId: string;
  name: string;
  memberCount: number;
  ownerId?: string;
  ref: string;
  lastRef?: string;
  /** Website button that was clicked (`site-hero`…), when the click came from our site. */
  placement?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  country?: string;
  clickTs?: Date;
  joinedAt: Date;
  firstPlayAt?: Date;
  leftAt?: Date;
  rejoins: number;
  backfilled?: boolean;
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
    referralRewardedAt: Date,
  },
  // The bot owns the indexes.
  { collection: "guildacquisitions", versionKey: false, autoIndex: false }
);

export const GuildAcquisition =
  (mongoose.models.GuildAcquisition as mongoose.Model<IGuildAcquisition> | undefined) ??
  mongoose.model<IGuildAcquisition>("GuildAcquisition", guildAcquisitionSchema);

export default GuildAcquisition;
