"use client";

/**
 * The Player: one stage of the bill up close. Stage tabs on top, the stage
 * header (the Fleet's stage name morphs into it), then the deck on the left
 * and the running order + recent songs on the right.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headphones, Plus, Volume2 } from "lucide-react";
import { useGuildLive } from "@/lib/dash/live";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, Me } from "@/lib/dash/types";
import { Button, cx } from "../ui";
import { PlayerDeck } from "./PlayerDeck";
import { QueueList } from "./QueueList";
import { RecentlyPlayed } from "./RecentlyPlayed";
import { gateOf, lockProps, openAdd } from "./shared";
import { BenchPanel, InvitePanel, OffAirPanel } from "./StagePanels";
import { PANEL_ID, StageTabs, tabId } from "./StageTabs";

/** No ?bot: the stage in the member's voice channel, else the first one playing, else Bypass. */
function defaultStage(instances: FleetInstance[], me: Me | null): number {
  const mine = me?.voiceChannelId ? instances.find((i) => i.playback?.voiceChannelId === me.voiceChannelId) : undefined;
  const playing = instances.find((i) => i.playback?.currentTrack);
  return (mine ?? playing ?? instances.find((i) => i.instance === 1) ?? instances[0])?.instance ?? 1;
}

export function PlayerScreen() {
  const { fleet, me, link } = useGuildLive();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const instances = useMemo(() => fleet?.instances ?? [], [fleet]);

  const requested = Number(search.get("bot"));
  const valid = instances.some((i) => i.instance === requested);

  // Without ?bot the default is chosen once, so the page doesn't jump when sets change.
  const [auto, setAuto] = useState<number | null>(null);
  useEffect(() => {
    if (!valid && auto === null && instances.length > 0) setAuto(defaultStage(instances, me));
  }, [valid, auto, instances, me]);

  const selected = valid ? requested : (auto ?? defaultStage(instances, me));
  const select = useCallback(
    (n: number) => router.replace(`${pathname}?bot=${n}`, { scroll: false }),
    [router, pathname],
  );

  const inst = instances.find((i) => i.instance === selected) ?? instances[0];
  if (!fleet || !inst) return null;

  const s = stage(inst.instance);
  const p = inst.playback;
  const playing = Boolean(inst.inGuild && inst.online && p?.currentTrack);
  const yours = Boolean(p?.isConnected && me?.voiceChannelId && p.voiceChannelId === me.voiceChannelId);
  const playGate = gateOf(me, "play");
  const idleChannel = p?.isConnected ? null : (me?.voiceChannelId ?? inst.binding.voiceChannelId);

  const status = !inst.inGuild
    ? "Not in this server"
    : !inst.online
      ? "Off air"
      : p?.isConnected
        ? `${p.voiceChannelName ?? "Voice"} · ${p.listeners ?? 0} listening`
        : "On the bench";

  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-20 pt-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
        <StageTabs
          instances={instances}
          selected={inst.instance}
          onSelect={select}
          me={me}
          className="order-first w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] xl:order-last xl:mx-0 xl:ml-auto xl:w-auto xl:max-w-full xl:px-0"
        />
        <header className="min-w-[min(100%,18rem)] max-w-full" style={{ viewTransitionName: `stage-${inst.instance}` }}>
          <div
            aria-hidden
            className="mb-3 h-2"
            style={
              inst.inGuild
                ? { background: s.color }
                : { backgroundImage: "linear-gradient(to right, #8a8378 60%, transparent 0)", backgroundSize: "14px 8px" }
            }
          />
          <h1 className={cx("bill text-[52px] leading-[0.85] sm:text-[60px]", !inst.inGuild && "text-ink-3")}>{inst.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-ink-2">
            {p?.isConnected ? <Volume2 size={16} className="shrink-0" style={{ color: s.color === "#f5b700" ? "#9a7300" : s.color }} aria-hidden /> : null}
            <span>{status}</span>
            {yours ? (
              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                <span aria-hidden>·</span>
                <Headphones size={14} aria-hidden /> you&apos;re here
              </span>
            ) : null}
            {inst.inGuild && inst.online ? (
              <span
                className={cx("ml-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", link === "live" ? "text-[#157a41]" : "text-ink-3")}
                title={link === "live" ? "Changes from Discord show up here as they happen" : link === "polling" ? "Live link lost; refreshing every few seconds" : "Connecting"}
              >
                <span aria-hidden className={cx("h-2 w-2 rounded-full", link === "live" ? "now-dot bg-stage-4" : "bg-ink-3")} />
                {link === "live" ? "Live updates" : link === "polling" ? "Refreshing" : "Connecting"}
              </span>
            ) : null}
          </p>
        </header>
        {playing ? (
          <div className="ml-auto pb-0.5 lg:hidden">
            <Button
              variant="ink"
              size="sm"
              {...lockProps(playGate)}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-55"
              onClick={() => playGate.ok && openAdd(inst.instance)}
            >
              <Plus size={14} /> Add songs
            </Button>
          </div>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(inst.instance)}
        className="mt-5 border-t-2 border-ink pt-6"
      >
        {!inst.inGuild ? (
          <InvitePanel inst={inst} guildName={fleet.guild.name} me={me} />
        ) : !inst.online ? (
          <OffAirPanel inst={inst} />
        ) : playing && p ? (
          <div className="grid gap-y-14 lg:grid-cols-12">
            <div className="lg:col-span-5 lg:self-start lg:pr-10 lg:[@media(min-height:760px)]:sticky lg:[@media(min-height:760px)]:top-[5.75rem]">
              <PlayerDeck key={inst.instance} inst={inst} p={p} me={me} />
            </div>
            <div className="min-w-0 lg:col-span-7 lg:border-l lg:border-rule lg:pl-10">
              <QueueList key={inst.instance} instance={inst.instance} p={p} me={me} />
              <RecentlyPlayed className="mt-14" instance={inst.instance} name={inst.name} me={me} />
            </div>
          </div>
        ) : (
          <div className="grid gap-y-14 lg:grid-cols-12">
            <div className="lg:col-span-5 lg:pr-10">
              <BenchPanel inst={inst} me={me} />
            </div>
            <div className="min-w-0 lg:col-span-7 lg:border-l lg:border-rule lg:pl-10">
              <RecentlyPlayed instance={inst.instance} name={inst.name} me={me} voiceChannelId={idleChannel} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
