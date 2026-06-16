import { hasAdminAccess } from "@/lib/admin-auth";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { IMetricsSnapshot, MetricsSnapshot } from "@/lib/models/MetricsSnapshot";
import { PatreonUserModel } from "@/lib/models/PatreonUser";
import { connectToDatabase } from "@/lib/mongodb";
import { getAllBotGuildsData, getBotStatus } from "@/lib/redis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function monthKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7); // YYYY-MM
}

/** Build a continuous monthly series between the first and current month. */
function monthsBetween(firstTs: number): string[] {
  const out: string[] = [];
  const start = new Date(firstTs);
  start.setUTCDate(1);
  const end = new Date();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export async function GET() {
  if (!(await hasAdminAccess())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Redis (guild list) and Mongo (premium/settings/snapshots) degrade
    // independently — one backend being down must not blank the whole page.
    const guilds = await getAllBotGuildsData();
    const botStatus = await getBotStatus().catch(() => null);

    let snapshots: IMetricsSnapshot[] = [];
    let premiumPatrons: { createdAt: Date; isFounder: boolean; lifetimeSupportCents: number; tierTitle?: string }[] = [];
    let founderCount = 0;
    let settingsCount = 0;
    let lifetimeAgg: { total: number }[] = [];

    try {
      await connectToDatabase();
      [snapshots, premiumPatrons, founderCount, settingsCount, lifetimeAgg] = await Promise.all([
        MetricsSnapshot.find({}).sort({ date: 1 }).lean<IMetricsSnapshot[]>(),
        PatreonUserModel.find({ isPremium: true })
          .select("createdAt isFounder lifetimeSupportCents tierTitle")
          .lean<{ createdAt: Date; isFounder: boolean; lifetimeSupportCents: number; tierTitle?: string }[]>(),
        PatreonUserModel.countDocuments({ isFounder: true }),
        GuildSettingsModel.countDocuments({}),
        PatreonUserModel.aggregate([
          { $group: { _id: null, total: { $sum: "$lifetimeSupportCents" } } },
        ]),
      ]);
    } catch (dbError) {
      console.error("[admin/analytics] MongoDB unavailable, serving Redis-only data:", dbError);
    }

    // ── Current totals ──────────────────────────────────────────
    const totalGuilds = guilds.length;
    const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const lifetimeSupportUsd = (lifetimeAgg[0]?.total || 0) / 100;

    // ── Server growth reconstructed from join dates ─────────────
    // Survivorship-biased: only counts servers still present today.
    const joined = guilds
      .map((g) => g.joinedAt)
      .filter((t): t is number => typeof t === "number" && t > 0)
      .sort((a, b) => a - b);

    let serverGrowth: { date: string; cumulative: number; added: number }[] = [];
    if (joined.length > 0) {
      const addedByMonth = new Map<string, number>();
      for (const ts of joined) {
        const k = monthKey(ts);
        addedByMonth.set(k, (addedByMonth.get(k) || 0) + 1);
      }
      let cumulative = 0;
      serverGrowth = monthsBetween(joined[0]).map((date) => {
        const added = addedByMonth.get(date) || 0;
        cumulative += added;
        return { date, cumulative, added };
      });
    }

    // ── Premium-patron growth from signup dates ─────────────────
    const premiumDates = premiumPatrons
      .map((p) => (p.createdAt ? new Date(p.createdAt).getTime() : 0))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    let premiumGrowth: { date: string; cumulative: number }[] = [];
    if (premiumDates.length > 0) {
      const addedByMonth = new Map<string, number>();
      for (const ts of premiumDates) {
        const k = monthKey(ts);
        addedByMonth.set(k, (addedByMonth.get(k) || 0) + 1);
      }
      let cumulative = 0;
      premiumGrowth = monthsBetween(premiumDates[0]).map((date) => {
        cumulative += addedByMonth.get(date) || 0;
        return { date, cumulative };
      });
    }

    // ── Real daily snapshots (empty until the bot has run a day) ─
    const snapshotGrowth = snapshots.map((s) => ({
      date: s.date,
      totalGuilds: s.totalGuilds,
      totalMembers: s.totalMembers,
      premiumUsers: s.premiumUsers,
      activeGuilds: s.activeGuilds,
    }));

    // ── Leaderboards ────────────────────────────────────────────
    const byMembers = [...guilds].sort((a, b) => b.memberCount - a.memberCount);
    const topServers = byMembers.slice(0, 10).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      memberCount: g.memberCount,
      joinedAt: g.joinedAt,
    }));
    const recentJoins = [...guilds]
      .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
      .slice(0, 10)
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        memberCount: g.memberCount,
        joinedAt: g.joinedAt,
      }));

    return NextResponse.json({
      totals: {
        totalGuilds,
        totalMembers,
        activeGuilds: snapshots.at(-1)?.activeGuilds ?? 0,
        premiumUsers: premiumPatrons.length,
        founders: founderCount,
        guildsWithSettings: settingsCount,
        avgMembers: totalGuilds > 0 ? Math.round(totalMembers / totalGuilds) : 0,
        lifetimeSupportUsd,
      },
      serverGrowth,
      premiumGrowth,
      snapshotGrowth,
      topServers,
      recentJoins,
      reconstructed: snapshotGrowth.length === 0,
      botStatus,
    });
  } catch (error) {
    console.error("[admin/analytics] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
