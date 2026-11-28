import { adminJson, requireOwner } from "@/lib/admin-auth";
import { type AcquisitionRow, buildGrowthReport, clampDays, type DailyClicks, windowDays } from "../../../../../../shared/growthReport";
import { GuildAcquisition } from "@/lib/models/GuildAcquisition";
import { connectToDatabase } from "@/lib/mongodb";
import { getRedis } from "@/lib/redis";
import { gaServerConfigured } from "../../../../../../shared/gaMeasurement";
import { inviteDailyKey } from "../../../../../../shared/growth";

export const dynamic = "force-dynamic";

/** Per-day invite clicks by source (Redis hashes); null when Redis is unavailable. */
async function readDailyClicks(dates: string[]): Promise<DailyClicks[] | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const pipeline = redis.pipeline();
    for (const date of dates) pipeline.hgetall(inviteDailyKey(date));
    const results = (await pipeline.exec()) ?? [];
    // ioredis reports a dead connection as one error per command, not a rejection.
    if (dates.length > 0 && results.length > 0 && results.every(([error]) => error)) {
      console.error("[admin/growth] Redis unavailable:", results[0][0]?.message);
      return null;
    }
    return dates.map((date, i) => {
      const [error, value] = results[i] ?? [null, null];
      const counts: Record<string, number> = {};
      if (!error && value && typeof value === "object") {
        for (const [ref, n] of Object.entries(value as Record<string, string>)) counts[ref] = Number(n) || 0;
      }
      return { date, counts };
    });
  } catch (error) {
    console.error("[admin/growth] Redis unavailable:", error);
    return null;
  }
}

/** Every acquisition row (a few hundred at most at our scale); null when Mongo is unavailable. */
async function readAcquisitions(): Promise<AcquisitionRow[] | null> {
  try {
    await connectToDatabase();
    return await GuildAcquisition.find({})
      .select("guildId name memberCount ref lastRef placement joinedAt firstPlayAt leftAt rejoins backfilled referralRewardedAt country -_id")
      .sort({ joinedAt: -1 })
      .limit(5000)
      .lean<AcquisitionRow[]>();
  } catch (error) {
    console.error("[admin/growth] MongoDB unavailable:", error);
    return null;
  }
}

/** GET /api/admin/growth?days=30 — install attribution funnel for the owner console. */
export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;

  const days = clampDays(new URL(request.url).searchParams.get("days"));
  const now = new Date();
  try {
    // Redis (clicks) and Mongo (joins) degrade independently.
    const [dailyClicks, acquisitions] = await Promise.all([readDailyClicks(windowDays(days, now)), readAcquisitions()]);
    return adminJson(
      buildGrowthReport({
        days,
        now,
        dailyClicks: dailyClicks ?? [],
        acquisitions: acquisitions ?? [],
        config: {
          gaServer: gaServerConfigured(),
          gaClient: Boolean(process.env.NEXT_PUBLIC_GA_ID),
          clarity: Boolean(process.env.NEXT_PUBLIC_CLARITY_ID),
        },
        sources: { redis: dailyClicks !== null, mongo: acquisitions !== null },
      })
    );
  } catch (error) {
    console.error("[admin/growth] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
