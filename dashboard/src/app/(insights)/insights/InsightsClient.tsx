"use client";

import BrandMark from "@/components/common/BrandMark";
import { AreaChart, AreaPoint } from "@/components/insights/AreaChart";
import { BarRow } from "@/components/insights/BarRow";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface ServerLite {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  joinedAt: number;
}

interface Analytics {
  totals: {
    totalGuilds: number;
    totalMembers: number;
    activeGuilds: number;
    premiumUsers: number;
    founders: number;
    guildsWithSettings: number;
    avgMembers: number;
    lifetimeSupportUsd: number;
  };
  serverGrowth: { date: string; cumulative: number; added: number }[];
  premiumGrowth: { date: string; cumulative: number }[];
  snapshotGrowth: { date: string; totalGuilds: number; totalMembers: number; premiumUsers: number; activeGuilds: number }[];
  topServers: ServerLite[];
  recentJoins: ServerLite[];
  reconstructed: boolean;
}

function iconUrl(id: string, icon: string | null, size = 64) {
  if (!icon) return "";
  const fmt = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${fmt}?size=${size}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d > 365) return `${Math.floor(d / 365)}y ago`;
  if (d > 30) return `${Math.floor(d / 30)}mo ago`;
  if (d >= 1) return `${d}d ago`;
  return "today";
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="console-panel rounded-xl p-5">
      <div className="console-label">{label}</div>
      <div className="stat-readout text-3xl md:text-4xl font-bold text-cream mt-2">{value}</div>
      {sub && <div className="text-xs text-dust mt-1 font-mono">{sub}</div>}
    </div>
  );
}

function SectionHead({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-4">
        <span className="console-label text-amber!">{kicker}</span>
        <span className="flex-1 h-px bg-line" />
        {note && <span className="console-label">{note}</span>}
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight mt-3">{title}</h2>
    </div>
  );
}

export default function InsightsClient() {
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<"servers" | "members">("servers");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(async (r) => {
        if (r.status === 403) {
          router.replace("/insights/login");
          return null;
        }
        if (!r.ok) throw new Error("Failed to load analytics");
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch((e) => setError(e.message));
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/insights/login");
    router.refresh();
  }

  // Growth series: prefer real daily snapshots, else reconstructed monthly.
  const growthSeries: AreaPoint[] = useMemo(() => {
    if (!data) return [];
    if (data.snapshotGrowth.length > 1) {
      return data.snapshotGrowth.map((s) => ({
        label: s.date.slice(5),
        value: metric === "servers" ? s.totalGuilds : s.totalMembers,
      }));
    }
    return data.serverGrowth.map((s) => ({
      label: monthLabel(s.date),
      value: s.cumulative,
    }));
  }, [data, metric]);

  const memberReachSeries: AreaPoint[] = useMemo(() => {
    if (!data) return [];
    // Reconstruct cumulative member reach by month from server growth + top data
    // is not exact; only show when snapshots exist.
    if (data.snapshotGrowth.length > 1) {
      return data.snapshotGrowth.map((s) => ({ label: s.date.slice(5), value: s.totalMembers }));
    }
    return [];
  }, [data]);

  const premiumSeries: AreaPoint[] = useMemo(() => {
    if (!data) return [];
    return data.premiumGrowth.map((s) => ({ label: monthLabel(s.date), value: s.cumulative }));
  }, [data]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="console-panel rounded-xl p-8 text-center">
          <p className="text-clip font-mono">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="eq scale-150">
          <span /><span /><span /><span /><span />
        </div>
      </div>
    );
  }

  const t = data.totals;
  const topMax = data.topServers[0]?.memberCount || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BrandMark size={38} />
          <div>
            <div className="font-display text-xl font-bold tracking-tight">Insights</div>
            <div className="console-label">Admin analytics</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm border border-line-bright hover:border-amber/60 text-dune hover:text-cream rounded-lg transition-colors font-medium"
        >
          Sign out
        </button>
      </div>

      {/* Honesty banner */}
      {data.reconstructed && (
        <div className="console-panel rounded-xl p-4 mb-8 border-amber/30 flex gap-3">
          <span className="led led--amber mt-1.5 shrink-0" />
          <p className="text-sm text-dune leading-relaxed">
            <span className="text-cream font-semibold">Growth is reconstructed from join dates.</span>{" "}
            No daily history existed before now, so the server curve below is built
            from the join timestamps of servers <span className="text-cream">still present today</span>{" "}
            (it can&apos;t show servers that have since left). Daily snapshots now
            capture real totals — this chart becomes exact as history accrues.
          </p>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <Stat label="Servers" value={t.totalGuilds.toLocaleString()} sub={`${t.guildsWithSettings} configured`} />
        <Stat label="Member reach" value={compact(t.totalMembers)} sub={`${t.avgMembers.toLocaleString()} avg / server`} />
        <Stat label="Premium users" value={t.premiumUsers.toLocaleString()} sub={`${t.founders} founders`} />
        <Stat label="Lifetime support" value={`$${compact(t.lifetimeSupportUsd)}`} sub="Patreon, all time" />
      </div>

      {/* Growth chart */}
      <section className="mb-12">
        <SectionHead
          kicker="Growth"
          title={metric === "servers" ? "Servers over time" : "Member reach over time"}
          note={data.reconstructed ? "Reconstructed · monthly" : "Daily snapshots"}
        />
        <div className="console-panel rounded-2xl p-6">
          {data.snapshotGrowth.length > 1 && (
            <div className="flex gap-2 mb-5">
              {(["servers", "members"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest border transition-colors ${
                    metric === m
                      ? "bg-amber text-coal border-amber"
                      : "bg-panel text-dune border-line hover:border-line-bright"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <AreaChart
            data={metric === "members" && memberReachSeries.length ? memberReachSeries : growthSeries}
          />
        </div>
      </section>

      {/* Premium growth + breakdown */}
      <section className="grid lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2">
          <SectionHead kicker="Revenue" title="Premium signups" note="cumulative" />
          <div className="console-panel rounded-2xl p-6">
            {premiumSeries.length > 0 ? (
              <AreaChart data={premiumSeries} accent="#5be49b" height={200} />
            ) : (
              <div className="flex items-center justify-center text-dust font-mono text-sm h-[200px]">
                No premium signups recorded yet
              </div>
            )}
          </div>
        </div>
        <div>
          <SectionHead kicker="Mix" title="Tiers" />
          <div className="console-panel rounded-2xl p-6 space-y-5">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-dune">Founders</span>
                <span className="stat-readout text-cream font-bold">{t.founders}</span>
              </div>
              <BarRow value={t.founders} max={t.premiumUsers || 1} accent="#f8aa2a" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-dune">Other premium</span>
                <span className="stat-readout text-cream font-bold">
                  {Math.max(0, t.premiumUsers - t.founders)}
                </span>
              </div>
              <BarRow value={Math.max(0, t.premiumUsers - t.founders)} max={t.premiumUsers || 1} accent="#5be49b" />
            </div>
            <div className="ruler-x" />
            <div className="flex justify-between">
              <span className="console-label">Conversion</span>
              <span className="font-mono text-sm text-cream">
                {t.totalMembers > 0 ? ((t.premiumUsers / t.totalMembers) * 100).toFixed(3) : "0"}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboards */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionHead kicker="Top servers" title="By member count" note={`${data.topServers.length}`} />
          <div className="console-panel rounded-2xl p-4 space-y-1">
            {data.topServers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-panel-raised/50">
                <span className="font-mono text-xs text-dust w-5">{String(i + 1).padStart(2, "0")}</span>
                {s.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl(s.id, s.icon)} alt="" className="w-8 h-8 rounded-lg" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-panel-raised border border-line flex items-center justify-center text-xs text-dune">
                    {s.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-cream truncate">{s.name}</div>
                  <BarRow value={s.memberCount} max={topMax} />
                </div>
                <span className="font-mono text-sm text-dune">{compact(s.memberCount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHead kicker="Recent" title="Latest servers" note="newest first" />
          <div className="console-panel rounded-2xl p-4 space-y-1">
            {data.recentJoins.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-panel-raised/50">
                {s.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl(s.id, s.icon)} alt="" className="w-8 h-8 rounded-lg" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-panel-raised border border-line flex items-center justify-center text-xs text-dune">
                    {s.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-cream truncate">{s.name}</div>
                  <div className="font-mono text-[10px] text-dust">{compact(s.memberCount)} members</div>
                </div>
                <span className="font-mono text-xs text-dune">{relTime(s.joinedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ruler-x mt-12 mb-4" />
      <p className="text-center font-mono text-xs text-dust">
        Bypass · admin insights · data is live from Redis + MongoDB
      </p>
    </div>
  );
}
