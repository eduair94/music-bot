"use client";

import { delta } from "@/lib/admin/aggregate";
import { compact, pct } from "@/lib/admin/format";
import type { AdminOverview } from "@/types/admin";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "signal" | "clip" }) {
  const subColor = tone === "signal" ? "text-signal" : tone === "clip" ? "text-clip" : "text-dust";
  return (
    <div className="console-panel rounded-xl p-5">
      <div className="console-label">{label}</div>
      <div className="stat-readout text-3xl md:text-4xl font-bold text-cream mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 font-mono ${subColor}`}>{sub}</div>}
    </div>
  );
}

function trend(curr: number, prev: number): { sub: string; tone?: "signal" | "clip" } {
  const d = delta(curr, prev);
  if (d.pct === null) return { sub: `${prev} previous 24h` };
  const sign = d.abs >= 0 ? "+" : "";
  return { sub: `${sign}${d.abs} (${sign}${d.pct}%) vs prev 24h`, tone: d.abs >= 0 ? "signal" : "clip" };
}

export function KpiGrid({ overview }: { overview: AdminOverview }) {
  const t = overview.totals;
  const a = overview.activity;
  const m = overview.membership30d;
  const cmd = trend(a.commands24h, a.commandsPrev24h);
  const trk = trend(a.tracks24h, a.tracksPrev24h);
  const linkedOnline = t.linkedBots.online;
  const linkedTotal = Object.values(t.linkedBots).reduce((s, n) => s + n, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <Kpi
        label="Servers"
        value={t.guilds.toLocaleString()}
        sub={`+${m.joins} / −${m.leaves} last 30d`}
        tone={m.joins >= m.leaves ? "signal" : "clip"}
      />
      <Kpi label="Member reach" value={compact(t.members)} sub={`${t.guildsWithSettings} configured servers`} />
      <Kpi label="Playing now" value={String(t.playing)} sub={`${t.paused} paused`} />
      <Kpi label="Commands 24h" value={a.commands24h.toLocaleString()} sub={cmd.sub} tone={cmd.tone} />
      <Kpi label="Tracks 24h" value={a.tracks24h.toLocaleString()} sub={trk.sub} tone={trk.tone} />
      <Kpi
        label="Error rate 24h"
        value={pct(a.errorRate24h)}
        sub={`${a.errors24h} errors`}
        tone={a.errorRate24h > 5 ? "clip" : "signal"}
      />
      <Kpi label="Active 7d" value={a.uniqueUsers7d.toLocaleString()} sub={`users · ${a.uniqueGuilds7d} servers`} />
      <Kpi
        label="Premium"
        value={t.premiumUsers.toLocaleString()}
        sub={`${t.premiumGuilds} servers · ${linkedOnline}/${linkedTotal} linked bots online`}
      />
    </div>
  );
}
