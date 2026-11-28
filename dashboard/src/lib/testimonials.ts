import "server-only";
import { Feedback } from "./models/Feedback";
import { connectToDatabase } from "./mongodb";
import { TESTIMONIALS_MAX, toTestimonials, type Testimonial } from "./testimonials-shape";
import { withTimeout } from "./with-timeout";

/*
 * Quotes for the landing page: feedback whose author allowed quoting and the
 * owner featured from the console (Admin > Feedback). Same rules as
 * public-stats: the read is bounded by a short timeout and any failure yields
 * an empty list, so the page renders without the block instead of waiting.
 */

const TIMEOUT_MS = 1500;
const MEMO_MS = 30_000;

/** Only the fields the quote is built from; contact and Discord ids are never read. */
const PROJECTION = { _id: 0, message: 1, quoteOk: 1, featured: 1, quoteAttribution: 1, source: 1, createdAt: 1 } as const;

async function load(): Promise<Testimonial[] | null> {
  if (!process.env.MONGODB_URI) return [];
  const docs = await withTimeout(
    (async () => {
      await connectToDatabase();
      return Feedback.find({ featured: true, quoteOk: true }, PROJECTION)
        .sort({ createdAt: -1 })
        .limit(TESTIMONIALS_MAX)
        .lean();
    })(),
    TIMEOUT_MS,
  );
  return docs ? toTestimonials(docs) : null;
}

const memo: { at: number; value: Testimonial[]; inflight: Promise<Testimonial[]> | null } = {
  at: 0,
  value: [],
  inflight: null,
};

/** Up to six featured quotes, newest first; empty when there are none or Mongo is unavailable. */
export async function getTestimonials(): Promise<Testimonial[]> {
  if (Date.now() - memo.at < MEMO_MS) return memo.value;
  if (!memo.inflight) {
    memo.inflight = load()
      .catch((error) => {
        console.error("[testimonials] load failed:", error instanceof Error ? error.message : error);
        return null;
      })
      .then((value) => {
        memo.inflight = null;
        // A failure is not remembered: the next render tries again.
        if (value === null) return [];
        memo.value = value;
        memo.at = Date.now();
        return value;
      });
  }
  return memo.inflight;
}
