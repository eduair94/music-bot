import { Schema, model, models } from "mongoose";

/** One song that started playing (written by the bot's services/playHistory.ts; 30-day TTL). */
export interface IPlayHistory {
  guildId: string;
  title: string;
  author: string;
  url: string;
  /** Milliseconds; 0 when unknown (streams). */
  duration: number;
  thumbnail: string;
  source: string;
  requestedBy: { id: string; username: string } | null;
  autoplay: boolean;
  playedAt: Date;
}

// Read model. The bot owns the collection and its indexes (incl. the TTL).
const playHistorySchema = new Schema<IPlayHistory>(
  {
    guildId: String,
    title: String,
    author: String,
    url: String,
    duration: Number,
    thumbnail: String,
    source: String,
    requestedBy: { type: new Schema({ id: String, username: String }, { _id: false }), default: null },
    autoplay: Boolean,
    playedAt: Date
  },
  { versionKey: false, autoIndex: false, collection: "playhistory" }
);

export const PlayHistoryModel = models.PlayHistory || model<IPlayHistory>("PlayHistory", playHistorySchema);
export default PlayHistoryModel;
