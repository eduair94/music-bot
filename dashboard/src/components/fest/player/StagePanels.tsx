"use client";

/** A stage with no set on: on the bench, off air, or not invited yet. */
import { ArrowUpRight, Play } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, Me } from "@/lib/dash/types";
import { Button } from "../ui";
import { gateOf, lockProps, openAdd } from "./shared";

export function BenchPanel({ inst, me }: { inst: FleetInstance; me: Me | null }) {
  const s = stage(inst.instance);
  const p = inst.playback;
  const play = gateOf(me, "play");
  return (
    <section
      aria-labelledby="bench-title"
      className="overflow-hidden rounded-[4px] border-2"
      style={{ borderColor: s.color, background: `color-mix(in srgb, ${s.tint} 55%, transparent)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.benchArt} alt="" width={960} height={640} className="mx-auto block w-full max-w-[36rem] px-6 pt-6" />
      <div className="border-t-2 bg-stock/80 px-5 pb-5 pt-4 sm:px-6" style={{ borderColor: s.color }}>
        <h2 id="bench-title" className="bill text-[40px] sm:text-[48px]">
          On the bench
        </h2>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-snug text-ink-2">
          {p?.isConnected
            ? `${inst.name} is waiting in ${p.voiceChannelName ?? "a voice channel"} with nothing playing.`
            : `${inst.name} is free.`}{" "}
          Pick a song and the voice channel, and it opens there.
        </p>
        <Button
          className="mt-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-55"
          variant="stage"
          stageColor={s.color}
          stageOn={s.on}
          {...lockProps(play)}
          onClick={() => play.ok && openAdd(inst.instance)}
        >
          <Play size={15} fill="currentColor" /> Start music here
        </Button>
        {!play.ok ? <p className="mt-2 text-[13px] text-ink-2">{play.reason}</p> : null}
      </div>
    </section>
  );
}

export function OffAirPanel({ inst }: { inst: FleetInstance }) {
  return (
    <section aria-labelledby="offair-title" className="hatch rounded-[4px] border border-ink/30 p-6 sm:p-8">
      <div className="max-w-[44ch] rounded-[4px] bg-stock p-5">
        <h2 id="offair-title" className="bill text-[40px] text-ink-2">
          Off air
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-ink-2">
          {inst.name} isn&apos;t responding right now. Its stage comes back on its own when it reconnects.
        </p>
      </div>
    </section>
  );
}

export function InvitePanel({ inst, guildName, me }: { inst: FleetInstance; guildName: string; me: Me | null }) {
  const s = stage(inst.instance);
  return (
    <section
      aria-labelledby="invite-title"
      className="grid items-center gap-6 rounded-[4px] border-[1.5px] border-dashed border-ink/50 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
    >
      <div>
        <h2 id="invite-title" className="bill text-[40px] sm:text-[48px]">
          Not in {guildName}
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-snug text-ink-2">
          Invite {inst.name} to run another voice channel at the same time. One <code className="font-semibold">/play</code> still
          covers every stage.
        </p>
        <a
          href={inst.inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2"
        >
          Invite {inst.name} <ArrowUpRight size={15} />
        </a>
        {me && !me.isAdmin ? (
          <p className="mt-3 text-[13px] text-ink-3">Adding a bot needs the Manage Server permission on Discord.</p>
        ) : null}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.benchArt} alt="" width={960} height={640} className="w-full opacity-45 grayscale" />
    </section>
  );
}
