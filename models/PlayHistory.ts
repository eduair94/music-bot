import { Model, Schema, Types, model, models } from "mongoose";

/** How long a play stays in the history. */
export const PLAY_HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * One song that started playing in a server. Written by
 * services/playHistory.ts on every track start, read by /history.
 */
export interface IPlayHistory {
  _id?: Types.ObjectId;
  guildId: string;
  title: string;
  author: string;
  /** Link to play it again: a URL, or a `ytsearch1:` query for bridged songs. */
  url: string;
  /** Milliseconds; 0 when unknown (streams). */
  duration: number;
  thumbnail: string;
  source: string;
  /** Who asked; null for songs the bot queued itself. */
  requestedBy: { id: string; username: string } | null;
  /** Queued by autoplay rather than a person. */
  autoplay: boolean;
  /** Which fleet bot played it (1 = Bypass). Rows written before this field existed count as 1. */
  instance: number;
  playedAt: Date;
}

const playHistorySchema = new Schema<IPlayHistory>(
  {
    guildId: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, default: "" },
    url: { type: String, required: true },
    duration: { type: Number, default: 0 },
    thumbnail: { type: String, default: "" },
    source: { type: String, default: "unknown" },
    requestedBy: {
      type: new Schema({ id: { type: String, required: true }, username: { type: String, default: "" } }, { _id: false }),
      default: null
    },
    autoplay: { type: Boolean, default: false },
    instance: { type: Number, default: 1, min: 1, max: 8 },
    playedAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: false, collection: "playhistory", versionKey: false }
);

playHistorySchema.index({ guildId: 1, playedAt: -1 });
playHistorySchema.index({ guildId: 1, "requestedBy.id": 1, playedAt: -1 });
playHistorySchema.index({ playedAt: 1 }, { expireAfterSeconds: PLAY_HISTORY_TTL_SECONDS });

export const PlayHistory: Model<IPlayHistory> =
  (models.PlayHistory as Model<IPlayHistory> | undefined) ?? model<IPlayHistory>("PlayHistory", playHistorySchema);
export default PlayHistory;
