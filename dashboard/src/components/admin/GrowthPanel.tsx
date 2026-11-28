"use client";

import { AreaChart, type AreaPoint } from "@/components/insights/AreaChart";
import { BarRow } from "@/components/insights/BarRow";
import { pct, relTime } from "@/lib/admin/format";
import type { GrowthReport } from "@/lib/admin/growth";
import { type ReactNode, useMemo, useState } from "react";
import { Chip, Label, Loader, Panel, Unavailable } from "./ui";
import { usePolling } from "./usePolling";

/**
 * Install attribution: where servers come from (`/invite?ref=` clicks →
 * joins), whether they play a song, whether they stay. Data from
 * GET /api/admin/growth (Redis click counters + Mongo `guildacquisitions`).
 */

const WINDOWS = [7, 30, 90] as const;
type Series = "joins" | "clicks";
// signal green for joins, dune for clicks (amber stays for actions and live state).
const SERIES_ACCENT: Record<Series, string> = { joins: "#5be49b", clicks: "#a89d90" };

const cell = "px-3 py-2 border-b border-line/60 whitespace-nowrap";
const num = `${cell} stat-readout text-right`;

function Table({ headers, minWidth = 640, children }: { headers: string[]; minWidth?: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-left">
            {headers.map((h, i) => (
              <th key={h} className={`console-label font-normal px-3 py-2 border-b border-line ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="console-panel rounded-xl p-4">
      <div className="console-label">{label}</div>
      <div className="stat-readout text-2xl md:text-3xl font-bold text-cream mt-1.5">{value}</div>
      {sub && <div className="text-xs mt-1 font-mono text-dust">{sub}</div>}
    </div>
  );
}

function hours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function Flag({ on, label, hint }: { on: boolean; label: string; hint: string }) {
  return (
    <Chip tone={on ? "signal" : "dust"} title={hint}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-signal" : "bg-dust"}`} />
      {label}
    </Chip>
  );
}

export function GrowthPanel() {
  const [days, setDays] = useState<number>(30);
  const [series, setSeries] = useState<Series>("joins");
  const { data, error, loading } = usePolling<GrowthReport>(`/api/admin/growth?days=${days}`, 120_000);

  const chart: AreaPoint[] = useMemo(
    () => (data ? (series === "joins" ? data.joinsByDay : data.clicksByDay).map((p) => ({ label: p.date.slice(5), value: p.total })) : []),
    [data, series]
  );

  if (loading && !data) return <Loader />;
  if (!data) return <Unavailable what={`Growth data${error ? ` (${error})` : ""}`} />;

  const t = data.totals;
  const funnelMax = Math.max(1, ...data.funnel.map((f) => Math.max(f.joins, f.clicks)));
  const empty = t.clicks === 0 && t.joins === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Flag on={data.config.gaServer} label="GA server events" hint="GA_MEASUREMENT_ID (or NEXT_PUBLIC_GA_ID) + GA_API_SECRET in the dashboard env; the bot sends the events and needs them in its .env too" />
          <Flag on={data.config.gaClient} label="GA tag" hint="NEXT_PUBLIC_GA_ID" />
          <Flag on={data.config.clarity} label="Clarity" hint="NEXT_PUBLIC_CLARITY_ID" />
          {!data.sources.redis && <Chip tone="clip">clicks unavailable (Redis)</Chip>}
          {!data.sources.mongo && <Chip tone="clip">joins unavailable (Mongo)</Chip>}
        </div>
        <div className="flex gap-1" role="group" aria-label="Window">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              aria-pressed={days === w}
              className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider border ${
                days === w ? "border-amber/60 text-amber bg-amber/10" : "border-line text-dust hover:text-cream"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Invite clicks" value={t.clicks.toLocaleString()} sub={`${data.from.slice(5)} → ${data.to.slice(5)}`} />
        <Stat label="Servers joined" value={t.joins.toLocaleString()} sub={t.joinRate === null ? "no clicks" : `${pct(t.joinRate)} of clicks`} />
        <Stat label="Played a song" value={t.activated.toLocaleString()} sub={`${pct(t.activationRate)} of joins`} />
        <Stat label="Still installed" value={t.installed.toLocaleString()} sub={`${t.removed} removed`} />
        <Stat label="To first song" value={hours(t.medianHoursToFirstPlay)} sub="median" />
        <Stat label="Before tracking" value={data.preTracking.toLocaleString()} sub="servers, not in funnel" />
      </div>

      <Panel>
        <div className="flex items-center justify-between mb-3">
          <Label>Daily {series === "joins" ? "server joins" : "invite clicks"}</Label>
          <div className="flex gap-1">
            {(["joins", "clicks"] as Series[]).map((s) => (
              <button
                key={s}
                onClick={() => setSeries(s)}
                aria-pressed={series === s}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider border ${
                  series === s ? "border-amber/60 text-amber bg-amber/10" : "border-line text-dust hover:text-cream"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {empty ? (
          <p className="text-sm text-dune font-mono py-10 text-center">
            Nothing tracked in this window yet. Clicks are logged by /invite, joins by the bot.
          </p>
        ) : (
          <AreaChart data={chart} height={200} accent={SERIES_ACCENT[series]} />
        )}
      </Panel>

      <Panel className="p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex justify-between">
          <Label>Funnel by source · {data.days}d</Label>
          <Label>clicks → joins → played → stayed</Label>
        </div>
        {data.funnel.length === 0 ? (
          <p className="p-4 text-xs text-dust font-mono">No clicks or joins in this window.</p>
        ) : (
          <Table headers={["Source", "Clicks", "Joins", "Join rate", "Played", "Installed", "Removed", "To 1st song"]} minWidth={760}>
            {data.funnel.map((f) => (
              <tr key={f.ref}>
                <td className={cell}>
                  <div className="text-cream">{f.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-dust w-28 truncate">{f.ref}</span>
                    <div className="w-24">
                      <BarRow value={f.joins} max={funnelMax} accent="#5be49b" />
                    </div>
                  </div>
                </td>
                <td className={num}>{f.clicks}</td>
                <td className={`${num} text-cream`}>{f.joins}</td>
                <td className={num}>{pct(f.joinRate)}</td>
                <td className={num}>
                  {f.activated} <span className="text-dust text-xs">{f.joins ? pct(f.activationRate) : ""}</span>
                </td>
                <td className={num}>{f.installed}</td>
                <td className={`${num} ${f.removed ? "text-clip" : ""}`}>{f.removed}</td>
                <td className={num}>{hours(f.medianHoursToFirstPlay)}</td>
              </tr>
            ))}
            <tr>
              <td className={`${cell} console-label`}>{t.label}</td>
              <td className={num}>{t.clicks}</td>
              <td className={`${num} text-cream`}>{t.joins}</td>
              <td className={num}>{pct(t.joinRate)}</td>
              <td className={num}>{t.activated}</td>
              <td className={num}>{t.installed}</td>
              <td className={num}>{t.removed}</td>
              <td className={num}>{hours(t.medianHoursToFirstPlay)}</td>
            </tr>
          </Table>
        )}
      </Panel>

      {data.placements.length > 0 && (
        <Panel className="p-0 overflow-hidden">
          <div className="p-4 border-b border-line flex justify-between">
            <Label>Website buttons · {data.days}d</Label>
            <Label>which button turns visits into servers</Label>
          </div>
          <Table headers={["Button", "Clicks", "Joins", "Join rate", "Played"]} minWidth={520}>
            {data.placements.map((p) => (
              <tr key={p.placement}>
                <td className={cell}>
                  <div className="text-cream">{p.label}</div>
                  <div className="font-mono text-[11px] text-dust">{p.placement}</div>
                </td>
                <td className={num}>{p.clicks}</td>
                <td className={`${num} text-cream`}>{p.joins}</td>
                <td className={num}>{pct(p.joinRate)}</td>
                <td className={num}>{p.activated}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="p-0 overflow-hidden lg:col-span-3">
          <div className="p-4 border-b border-line">
            <Label>Recent joins</Label>
          </div>
          {data.recent.length === 0 ? (
            <p className="p-4 text-xs text-dust font-mono">No tracked joins in this window.</p>
          ) : (
            <Table headers={["Server", "Source", "Joined", "Status"]} minWidth={560}>
              {data.recent.map((r) => (
                <tr key={`${r.guildId}-${r.joinedAt}`}>
                  <td className={cell}>
                    <div className="text-cream truncate max-w-[220px]">{r.name}</div>
                    <div className="font-mono text-[11px] text-dust">
                      {r.memberCount} members{r.country ? ` · ${r.country}` : ""}
                    </div>
                  </td>
                  <td className={`${cell} text-right`}>
                    <div className="text-dune">{r.label}</div>
                    {r.rejoin && <div className="font-mono text-[11px] text-dust">rejoin</div>}
                  </td>
                  <td className={`${cell} text-right font-mono text-xs text-dune`}>{relTime(r.joinedAt)}</td>
                  <td className={`${cell} text-right`}>
                    {r.leftAt ? (
                      <Chip tone="clip">left {relTime(r.leftAt)}</Chip>
                    ) : r.firstPlayAt ? (
                      <Chip tone="signal">playing</Chip>
                    ) : (
                      <Chip>no song yet</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel className="p-0 overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-line flex justify-between">
            <Label>Top referrers</Label>
            <Label>all time</Label>
          </div>
          {data.topReferrers.length === 0 ? (
            <p className="p-4 text-xs text-dust font-mono">No referral joins yet. Every /invite link is personal.</p>
          ) : (
            <Table headers={["Discord id", "Servers", "Installed", "Played", "Rewarded"]} minWidth={420}>
              {data.topReferrers.map((r) => (
                <tr key={r.userId}>
                  <td className={`${cell} font-mono text-xs text-cream`}>{r.userId}</td>
                  <td className={num}>{r.servers}</td>
                  <td className={num}>{r.installed}</td>
                  <td className={num}>{r.activated}</td>
                  <td className={num}>{r.rewarded}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
