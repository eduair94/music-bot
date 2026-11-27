"use client";

/**
 * What the server listened to over the last 7 or 30 days: the period's
 * numbers on one ruled line, plays per day stacked by the bot (stage) that
 * played them, plays by hour, top tracks and
 * requesters, sources, what played recently, and what changed on the
 * dashboard. The period switch scopes everything above the logs.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { demoActivity, isDemo } from "@/lib/dash/demo";
import { useActivity, useAudit, useHistory } from "@/lib/dash/hooks";
import { useGuildLive } from "@/lib/dash/live";
import { fmtCount } from "@/lib/dash/format";
import type { Activity } from "@/lib/dash/types";
import { Button, cx } from "../ui";
import { fmtDay } from "./chart";
import { DailyChart } from "./DailyChart";
import { HourStrip } from "./HourStrip";
import { ChangeLog, RecentTable } from "./Logs";
import { SourcesBar, TopRequesters, TopTracks } from "./Rankings";
import { instancesIn } from "./stages";

type Days = 7 | 30;

export function ActivityScreen() {
  const { fleet, guildId } = useGuildLive();
  const [days, setDays] = useState<Days>(30);
  const activity = useActivity(days);
  // The demo resource never reloads when its path changes, so build the fixture for the picked period here.
  const demo = useMemo(() => (isDemo(guildId) ? demoActivity(days) : null), [guildId, days]);
  const history = useHistory();
  const audit = useAudit();

  // Dates and "time ago" depend on the viewer's clock and locale: render them on the client.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const data = demo ?? activity.data;
  // Bot chips only mean something when more than one bot plays here.
  const bots = new Set<number>([
    ...instancesIn(data?.totals.byInstance),
    ...(history.data?.items ?? []).map((h) => h.instance || 1),
    ...(fleet?.instances ?? []).filter((i) => i.inGuild).map((i) => i.instance),
  ]);
  const showBots = bots.size > 1;
  const stale = !demo && activity.loading && Boolean(data);
  const range = data?.daily.length
    ? `${fmtDay(data.daily[0].date, { day: "numeric", month: "short" })} – ${fmtDay(data.daily.at(-1)!.date, { day: "numeric", month: "short" })}`
    : "";

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 pb-3 pt-4 sm:px-6">
        <h1 className="bill text-[52px] leading-[0.85] sm:text-[60px]">Activity</h1>
        <p className="pb-1 text-[15px] text-ink-2">
          {fleet?.guild.name ?? "This server"} · last {days} days{now && range ? <span className="text-ink-3"> · {range}</span> : null}
        </p>
        <div className="ml-auto pb-1">
          <Period value={days} onChange={setDays} />
        </div>
      </div>

      <div className="border-t-2 border-ink px-4 sm:px-6">
        {activity.error && !data ? (
          <div className="py-12">
            <p className="bill text-[34px]">Activity didn&apos;t load</p>
            <p className="mt-2 max-w-prose text-[15px] text-ink-2">{activity.error}. Try again in a moment.</p>
            <Button variant="ink" className="mt-4" onClick={() => void activity.reload()}>
              Try again
            </Button>
          </div>
        ) : !data || now === null ? (
          <Skeleton />
        ) : (
          <div className={cx("transition-opacity duration-200", stale && "opacity-55")} aria-busy={stale || undefined}>
            <Headline totals={data.totals} days={days} />
            {data.totals.plays === 0 ? (
              <NoPlays days={days} guildId={fleet?.guild.id} />
            ) : (
              <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-12">
                <Block title="Plays per day" className="lg:col-span-8">
                  <DailyChart daily={data.daily} byInstance={data.totals.byInstance} />
                </Block>
                <Block title="Sources" className="lg:col-span-4">
                  <SourcesBar sources={data.sources} />
                </Block>
                <Block title="Plays by hour" className="lg:col-span-12">
                  <HourStrip hours={data.hours} />
                </Block>
                <Block title="Top tracks" className="lg:col-span-7">
                  <TopTracks items={data.topTracks} showBots={showBots} />
                </Block>
                <Block title="Top requesters" className="lg:col-span-5">
                  <TopRequesters items={data.topRequesters} />
                </Block>
              </div>
            )}
          </div>
        )}

        {now !== null ? (
          <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-12">
            <Block title="Recently played" className="lg:col-span-8">
              {history.error && !history.data ? (
                <Inline error={history.error} onRetry={() => void history.reload()} />
              ) : history.data ? (
                <RecentTable items={history.data.items} now={now} showBots={showBots} />
              ) : (
                <Lines />
              )}
            </Block>
            <Block title="Dashboard changes" className="lg:col-span-4">
              {audit.error && !audit.data ? (
                <Inline error={audit.error} onRetry={() => void audit.reload()} />
              ) : audit.data ? (
                <ChangeLog items={audit.data.items} now={now} />
              ) : (
                <Lines />
              )}
            </Block>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Period({ value, onChange }: { value: Days; onChange: (d: Days) => void }) {
  return (
    <div role="group" aria-label="Period" className="inline-flex rounded-[4px] border border-ink p-0.5">
      {([7, 30] as Days[]).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={cx(
            "h-8 rounded-[3px] px-3.5 text-[13px] font-semibold transition-colors duration-150",
            value === d ? "bg-ink text-stock" : "text-ink hover:bg-ink/[0.07]",
          )}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

function listening(ms: number): { value: string; unit: string } {
  const minutes = Math.round(ms / 60000);
  if (minutes < 120) return { value: fmtCount(minutes), unit: minutes === 1 ? "minute listened" : "minutes listened" };
  return { value: fmtCount(Math.round(minutes / 60)), unit: "hours listened" };
}

/** The period's numbers, set like the footer line of a festival bill. */
function Headline({ totals, days }: { totals: Activity["totals"]; days: Days }) {
  const l = listening(totals.listeningMs);
  const items = [
    { value: fmtCount(totals.plays), unit: totals.plays === 1 ? "play" : "plays" },
    l,
    { value: fmtCount(totals.requesters), unit: totals.requesters === 1 ? "requester" : "requesters" },
    { value: fmtCount(totals.skips), unit: totals.skips === 1 ? "skip" : "skips" },
  ];
  return (
    <dl
      aria-label={`Totals for the last ${days} days`}
      className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-ink py-4 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1"
    >
      {items.map((it, i) => (
        <div
          key={it.unit}
          className={cx(
            "flex items-baseline gap-2",
            i > 0 && "sm:before:mr-2 sm:before:text-[22px] sm:before:leading-none sm:before:text-ink-3 sm:before:content-['·']",
          )}
        >
          <dt className="bill order-2 text-[17px] text-ink-2 sm:text-[20px]">{it.unit}</dt>
          <dd className="clock order-1 text-[34px] leading-none sm:text-[40px]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({
  title,
  className,
  aside,
  children,
}: {
  title: string;
  className?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cx("min-w-0 pt-10", className)} aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 className="bill text-[28px] sm:text-[32px]">{title}</h2>
        {aside ? <span className="text-[13px]">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function NoPlays({ days, guildId }: { days: Days; guildId?: string }) {
  return (
    <div className="grid items-end gap-6 border-b border-rule py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div>
        <p className="bill text-[40px]">No plays in the last {days} days</p>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
          Once someone plays music with Bypass in this server, the days, hours, top tracks and requesters fill in here.
        </p>
        {guildId ? (
          <Link
            href={`/servers/${guildId}`}
            className="mt-5 inline-flex h-10 items-center rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock hover:bg-ink-2"
          >
            Start music from the Fleet
          </Link>
        ) : null}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dash/crowd-strip.webp" alt="" width={768} height={256} className="w-full opacity-90" />
    </div>
  );
}

function Inline({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <p className="py-6 text-[14px] text-ink-2">
      Couldn&apos;t load this: {error}.{" "}
      <button type="button" onClick={onRetry} className="font-semibold text-ink underline underline-offset-2">
        Try again
      </button>
    </p>
  );
}

function Lines() {
  return (
    <div aria-busy="true" className="space-y-2.5 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded-[4px] bg-ink/[0.06]" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity">
      <div className="flex gap-6 border-b border-ink py-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-[4px] bg-ink/10" />
        ))}
      </div>
      <div className="grid gap-x-10 pt-10 lg:grid-cols-12">
        <div className="h-64 animate-pulse rounded-[4px] bg-ink/[0.06] lg:col-span-8" />
        <div className="mt-6 h-64 animate-pulse rounded-[4px] bg-ink/[0.06] lg:col-span-4 lg:mt-0" />
      </div>
    </div>
  );
}
