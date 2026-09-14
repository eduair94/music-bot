"use client";

import { AreaChart, AreaPoint } from "@/components/insights/AreaChart";
import { BarRow } from "@/components/insights/BarRow";
import type { AdminOverview } from "@/types/admin";
import { useMemo, useState } from "react";
import { Label, Panel } from "./ui";

type Metric = "commands" | "tracks" | "errors";
const ACCENT: Record<Metric, string> = { commands: "#f8aa2a", tracks: "#5be49b", errors: "#ff5a48" };

export function ActivityCharts({ overview }: { overview: AdminOverview }) {
  const [metric, setMetric] = useState<Metric>("commands");
  const series: AreaPoint[] = useMemo(
    () => overview.series14d.map((p) => ({ label: p.date.slice(5), value: p[metric] })),
    [overview.series14d, metric]
  );
  const topMax = overview.topCommands7d[0]?.count || 1;
  const srcMax = overview.sources7d[0]?.starts || 1;
  const noEvents = overview.series14d.every((p) => p.commands === 0 && p.tracks === 0 && p.errors === 0);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <Label>Daily {metric}</Label>
          <div className="flex gap-1">
            {(["commands", "tracks", "errors"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider border ${
                  metric === m ? "border-amber/60 text-amber bg-amber/10" : "border-line text-dust hover:text-cream"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {noEvents ? (
          <p className="text-sm text-dune font-mono py-10 text-center">
            No events yet — the bot starts recording commands, tracks and errors after this deploy.
          </p>
        ) : (
          <AreaChart data={series} height={240} accent={ACCENT[metric]} />
        )}
      </Panel>

      <div className="space-y-4">
        <Panel>
          <Label className="mb-3">Top commands · 7d</Label>
          {overview.topCommands7d.length === 0 && <p className="text-xs text-dust font-mono">No data</p>}
          <ul className="space-y-2.5">
            {overview.topCommands7d.map((c) => (
              <li key={c.command}>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-cream">/{c.command}</span>
                  <span className="text-dust">
                    {c.count}
                    {c.failed > 0 && <span className="text-clip"> · {c.failed} failed</span>}
                  </span>
                </div>
                <BarRow value={c.count} max={topMax} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <Label className="mb-3">Sources · 7d</Label>
          {overview.sources7d.length === 0 && <p className="text-xs text-dust font-mono">No data</p>}
          <ul className="space-y-2.5">
            {overview.sources7d.map((s) => (
              <li key={s.source}>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-cream">{s.source}</span>
                  <span className="text-dust">
                    {s.starts}
                    {s.errors > 0 && <span className="text-clip"> · {s.errors} errors</span>}
                  </span>
                </div>
                <BarRow value={s.starts} max={srcMax} accent={s.errors > s.starts / 4 ? "#ff5a48" : "#5be49b"} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
