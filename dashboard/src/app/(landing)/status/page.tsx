/**
 * Public status page: one row per Bypass player, from the heartbeats each bot
 * process writes to Redis every 20 seconds (services/telemetry.ts).
 */

import AutoRefresh from "@/components/landing/AutoRefresh";
import SectionHeader from "@/components/landing/SectionHeader";
import { getPublicStats } from "@/lib/public-stats";
import { compactCount, type PlayerState, type PublicStats, uptimeLabel } from "@/lib/public-stats-shape";
import { GITHUB_ISSUES_URL } from "@/lib/site";
import { Metadata } from "next";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

export const revalidate = 30;

const description =
  "Live status of the Bypass Discord music bot: which players are online, gateway latency, uptime, and how many servers each one is in.";

export const metadata: Metadata = {
  title: "Status",
  description,
  alternates: { canonical: "/status" },
  openGraph: { title: "Bypass status", description, url: "/status" },
};

const STATE_LABEL: Record<PlayerState, string> = { online: "Online", stale: "Late", offline: "Offline" };
const LED: Record<PlayerState, string> = { online: "led", stale: "led led--amber", offline: "led led--off" };

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

function headline(stats: PublicStats | null): string {
  if (!stats) return "Status unavailable.";
  const total = stats.players.length;
  if (stats.online === total) return total === 1 ? "Bypass is online." : "All players are online.";
  if (stats.online === 0) return "Bypass is offline.";
  return `${stats.online} of ${total} players are online.`;
}

function ago(sec: number | null): string {
  if (sec === null) return "never";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

const th = "console-label px-4 py-3 font-normal whitespace-nowrap";
const td = "px-4 py-3.5 whitespace-nowrap";
const num = "font-mono tabular-nums";

export default async function StatusPage() {
  const stats = await getPublicStats();
  const now = stats ? Date.parse(stats.generatedAt) : Date.now();

  return (
    <div className="pt-18">
      <AutoRefresh seconds={30} />

      <section className="pt-16 pb-20 lg:pt-24 lg:pb-24" aria-labelledby="status-title">
        <div className="shell">
          <SectionHeader
            as="h1"
            id="status-title"
            title={headline(stats)}
            lede={
              stats ? (
                <>
                  Each player sends a heartbeat every 20 seconds. One that misses them for 90 seconds shows as late, after
                  10 minutes as offline. Updated <span className={`${num} text-cream`}>{timeFormat.format(now)}</span>{" "}
                  UTC, refreshes every 30 seconds.
                </>
              ) : (
                "This page can't reach the bots' telemetry right now. That is usually the website, not the bot. Ask in the support server if music has stopped."
              )
            }
          />

          {stats && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Bypass players and their live status</caption>
                <thead className="border-b border-line">
                  <tr>
                    <th scope="col" className={th}>Player</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={`${th} text-right`}>Latency</th>
                    <th scope="col" className={`${th} text-right`}>Servers</th>
                    <th scope="col" className={`${th} text-right`}>Playing</th>
                    <th scope="col" className={`${th} text-right`}>Running for</th>
                    <th scope="col" className={`${th} text-right`}>Last heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.players.map((p) => (
                    <tr key={p.instance}>
                      <th scope="row" className={`${td} font-medium text-cream`}>{p.name}</th>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2.5 text-dune">
                          <span className={LED[p.state]} aria-hidden="true" />
                          {STATE_LABEL[p.state]}
                        </span>
                      </td>
                      <td className={`${td} ${num} text-right text-dune`}>{p.pingMs === null ? "—" : `${p.pingMs} ms`}</td>
                      <td className={`${td} ${num} text-right text-dune`}>{compactCount(p.servers)}</td>
                      <td className={`${td} ${num} text-right text-dune`}>{p.state === "online" ? p.playing : "—"}</td>
                      <td className={`${td} ${num} text-right text-dune`}>
                        {p.state === "offline" ? "—" : uptimeLabel(p.startedAt, now)}
                      </td>
                      <td className={`${td} ${num} text-right text-dune`}>{ago(p.lastSeenSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {stats && (
        <section className="py-20 lg:py-24 bg-panel/40 border-y border-line" aria-labelledby="reach-title">
          <div className="shell">
            <h2 id="reach-title" className="font-display text-3xl md:text-4xl font-bold tracking-[-0.02em] text-cream">
              Reach
            </h2>
            <dl className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Servers", value: stats.servers, note: "Distinct servers with at least one Bypass player." },
                {
                  label: "Members",
                  value: stats.members,
                  note: "Sum of the member counts of those servers, the figure bot lists show.",
                },
                ...(stats.songsPlayed !== null
                  ? [{ label: "Songs played", value: stats.songsPlayed, note: "Counted since September 2026." }]
                  : []),
                { label: "Playing now", value: stats.playingNow, note: "Songs playing across online players." },
              ].map((item) => (
                <div key={item.label} className="border-t border-line pt-5">
                  <dt className="console-label">{item.label}</dt>
                  <dd className={`mt-2 ${num} text-2xl text-cream`}>{compactCount(item.value)}</dd>
                  <dd className="mt-2 text-sm text-dust leading-relaxed text-pretty">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="py-20 lg:py-24" aria-labelledby="report-title">
        <div className="shell">
          <h2 id="report-title" className="font-display text-3xl md:text-4xl font-bold tracking-[-0.02em] text-cream">
            Something this page doesn&apos;t show?
          </h2>
          <p className="mt-4 max-w-[38rem] text-lg text-dune leading-relaxed text-pretty">
            A player can be online and still fail to play a track. Tell us in the support server, or file a bug on
            GitHub with the song and the time it happened.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/support"
              prefetch={false}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber px-5 text-sm font-semibold text-coal transition-colors hover:bg-amber-hot"
            >
              <FaDiscord className="h-4 w-4" aria-hidden="true" />
              Join the support server
            </Link>
            <a
              href={GITHUB_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60"
            >
              Report a bug<span className="sr-only"> on GitHub (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
