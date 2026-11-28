/**
 * Weekly growth digest, run by hand (the bot posts it by itself on Mondays,
 * see services/growth/digest.ts).
 *
 * Usage (reads REDIS_URL, MONGODB_URI and GROWTH_DIGEST_WEBHOOK_URL /
 * FEEDBACK_WEBHOOK_URL from .env or the environment):
 *   npx ts-node --transpile-only scripts/growthDigest.ts --dry-run   print the webhook JSON, post nothing
 *   npx ts-node --transpile-only scripts/growthDigest.ts             post it now (ignores the weekly lock)
 *
 * stdout carries only the JSON: every log goes to stderr, so `--dry-run | jq` works.
 * (utils/config is not imported for that reason: it logs to stdout when loaded.)
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  buildGrowthDigest,
  collectDigestInput,
  digestPayload,
  digestWebhookUrl,
  postGrowthDigest
} from "../services/growth/digest";
import { closeRedis } from "../shared/services/redis";

async function main(): Promise<number> {
  console.log = console.info = console.error;
  const dryRun = process.argv.includes("--dry-run");
  const url = digestWebhookUrl();
  if (!dryRun && !url) {
    console.error(
      "Set GROWTH_DIGEST_WEBHOOK_URL (or FEEDBACK_WEBHOOK_URL) to an https Discord webhook, or use --dry-run"
    );
    return 1;
  }

  // Same default as utils/config.ts.
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/music-bot";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  } catch (error) {
    // Still useful: the digest says MongoDB was unreachable and shows the click counts.
    console.error("MongoDB unavailable:", (error as Error)?.message ?? error);
  }

  try {
    const now = new Date();
    if (dryRun) {
      const input = await collectDigestInput(now);
      process.stdout.write(`${JSON.stringify(digestPayload(buildGrowthDigest(input)), null, 2)}\n`);
      return 0;
    }
    const ok = await postGrowthDigest({ now, url: url! });
    console.error(ok ? "Growth digest posted." : "Growth digest NOT posted (see the warning above).");
    return ok ? 0 : 1;
  } finally {
    await Promise.race([
      Promise.allSettled([mongoose.disconnect(), closeRedis()]),
      new Promise((resolve) => setTimeout(resolve, 3000).unref())
    ]);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
