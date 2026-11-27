"use client";

/**
 * The Fleet: every Bypass bot in the server as a stage on one festival bill.
 * Songs are sets blocked out on a shared clock, sized by duration; a red NOW
 * line runs across all stages and advances in real time. Finished sets leave
 * the bill upward and the next one is printed in, ink wiping down.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Crosshair, ListPlus, MoreHorizontal, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Volume2 } from "lucide-react";
import { useActivity } from "@/lib/dash/hooks";
import { useGuildLive, useTicker } from "@/lib/dash/live";
import { fmtClock, fmtCount, fmtListening, fmtMs, livePosition, trackMs } from "@/lib/dash/format";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, PlaybackState, Track } from "@/lib/dash/types";
import { useToast } from "./Toast";
import { Button, cx, IconButton, Menu, MenuItem } from "./ui";
import { useTransitionNav } from "./vt";

const PX_PER_MIN = 26;
const MIN = 60_000;
const px = (ms: number) => (ms / MIN) * PX_PER_MIN;
const QUEUE_END_PX = 168;

function openAdd(instance?: number) {
  window.dispatchEvent(new CustomEvent("fest:add-song", { detail: { instance } }));
}

/** Where each stage's current set started, given the live position. */
function currentStart(p: PlaybackState, now: number): number {
  return now - livePosition(p, now);
}

export function FleetBill() {
  const { fleet, me, link, send } = useGuildLive();
  const now = useTicker(1000);
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const lastUserScroll = useRef(0);

  const instances = useMemo(() => fleet?.instances ?? [], [fleet]);
  const live = instances.filter((i) => i.playback?.currentTrack);

  // Origin of the clock: two-minute tick before the earliest current set.
  const [origin, setOrigin] = useState(() => Math.floor((Date.now() - 4 * MIN) / (2 * MIN)) * 2 * MIN);
  useEffect(() => {
    const starts = live.map((i) => currentStart(i.playback!, now));
    const earliest = Math.min(now - 3 * MIN, ...starts);
    const want = Math.floor(earliest / (2 * MIN)) * 2 * MIN;
    if (want < origin || now - origin > 45 * MIN) setOrigin(want);
  }, [live, now, origin]);

  // Length of the bill: past the end of the longest queue, at least 40 minutes.
  const end = useMemo(() => {
    let last = now + 40 * MIN;
    for (const i of live) {
      const p = i.playback!;
      let t = currentStart(p, now) + trackMs(p.currentTrack);
      for (const q of p.queue) t += trackMs(q);
      last = Math.max(last, t + 14 * MIN);
    }
    return Math.min(last, origin + 4 * 60 * MIN);
  }, [live, now, origin]);

  const height = px(end - origin);
  const nowY = px(now - origin);

  // Follow NOW: keep the line a fifth of the way down while following.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !follow || Date.now() - lastUserScroll.current < 6000) return;
    const target = Math.max(0, nowY - el.clientHeight * 0.2);
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTo({ top: target, behavior: "smooth" });
  }, [nowY, follow]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = origin; t <= end; t += 2 * MIN) out.push(t);
    return out;
  }, [origin, end]);

  if (!fleet) return null;

  const onAir = instances.filter((i) => i.playback?.isConnected).length;
  const bench = instances.filter((i) => i.inGuild && i.online && !i.playback?.isConnected).length;
  const missing = instances.filter((i) => !i.inGuild).length;
  const configured = instances.length;
  const showMore = configured < (fleet.limits.free ?? 4);

  const control = async (inst: number, cmd: Parameters<typeof send>[1], params?: Record<string, unknown>, label?: string) => {
    const r = await send(inst, cmd, params);
    if (!r.success) toast.push({ tone: "error", title: label ? `Couldn't ${label}` : "That didn't work", detail: r.reason || r.error });
    return r;
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col max-lg:h-[calc(100dvh-7rem)]">
      {/* Title row */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <h1 className="bill text-[52px] leading-[0.85] sm:text-[60px]">Fleet</h1>
        <p className="min-w-0 basis-full pb-1 text-[15px] text-ink-2 sm:basis-auto">
          {fleet.guild.name} · {onAir} on air · {bench} on the bench{missing ? ` · ${missing} not in this server` : ""}
          <span
            className={cx("ml-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", link === "live" ? "text-stage-4" : "text-ink-3")}
            title={link === "live" ? "Updates arrive live" : link === "polling" ? "Live link lost; refreshing every few seconds" : "Connecting"}
          >
            <span aria-hidden className={cx("h-2 w-2 rounded-full", link === "live" ? "now-dot bg-stage-4" : "bg-ink-3")} />
            {link === "live" ? "Live" : link === "polling" ? "Refreshing" : "Connecting"}
          </span>
        </p>
        <div className="flex items-center gap-2 pb-1 sm:ml-auto">
          <Button
            variant={follow ? "ink" : "outline"}
            size="sm"
            aria-pressed={follow}
            onClick={() => {
              lastUserScroll.current = 0;
              setFollow((f) => !f);
            }}
          >
            <Crosshair size={14} /> Follow NOW
          </Button>
          <Button variant="ink" size="sm" onClick={() => openAdd()}>
            <Plus size={14} /> Add to queue
          </Button>
        </div>
      </div>

      {/* The bill */}
      <div
        ref={scroller}
        onWheel={() => (lastUserScroll.current = Date.now())}
        onTouchMove={() => (lastUserScroll.current = Date.now())}
        className="relative min-h-0 flex-1 overflow-auto border-t-2 border-ink"
      >
        <div
          className="grid min-w-full"
          style={{
            gridTemplateColumns: `3.5rem repeat(${configured + (showMore ? 1 : 0)}, minmax(min(82vw, 15rem), 1fr))`,
          }}
        >
          {/* Sticky header row */}
          <div className="sticky left-0 top-0 z-30 border-b border-ink bg-stock" />
          {instances.map((i) => (
            <StageHeader key={i.instance} inst={i} guildId={fleet.guild.id} />
          ))}
          {showMore ? <MoreHeader /> : null}

          {/* Time axis */}
          <div className="sticky left-0 z-20 border-r border-rule bg-stock" style={{ height }}>
            {ticks.map((t) => {
              const major = new Date(t).getMinutes() % 10 === 0;
              return (
                <span
                  key={t}
                  className={cx("clock absolute right-2 -translate-y-1/2 text-[12px]", major ? "text-ink" : "text-ink-3")}
                  style={{ top: px(t - origin) }}
                >
                  {fmtClock(t)}
                </span>
              );
            })}
          </div>

          {instances.map((i) => (
            <StageColumn
              key={i.instance}
              inst={i}
              origin={origin}
              now={now}
              height={height}
              control={control}
              guildName={fleet.guild.name}
              mine={Boolean(me?.voiceChannelId && i.playback?.voiceChannelId === me.voiceChannelId)}
            />
          ))}
          {showMore ? <MoreColumn height={height} /> : null}
        </div>

        {/* Hour rules and the NOW line span every stage */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-0" style={{ top: HEADER_H, height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className={cx("absolute left-14 right-0 border-t", new Date(t).getMinutes() % 10 === 0 ? "border-rule" : "border-rule-soft")}
              style={{ top: px(t - origin) }}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute left-0 right-0 z-[25]"
          style={{ top: HEADER_H, transform: `translateY(${nowY}px)`, transition: "transform 1s linear" }}
        >
          <div className="absolute left-14 right-0 h-[2px] -translate-y-1/2 bg-now" />
          <span className="clock sticky left-0 inline-block -translate-y-1/2 rounded-[3px] bg-now px-1.5 py-0.5 text-[15px] text-white shadow-[0_2px_6px_rgb(212_0_31/0.35)]">
            {fmtClock(now)}
          </span>
        </div>
      </div>

      <Strip guildId={fleet.guild.id} />
    </div>
  );
}

const HEADER_H = 104;

function StageHeader({ inst, guildId }: { inst: FleetInstance; guildId: string }) {
  const s = stage(inst.instance);
  const nav = useTransitionNav();
  const p = inst.playback;
  const status = !inst.inGuild
    ? "Not in this server"
    : !inst.online
      ? "Off air"
      : p?.isConnected
        ? `${p.voiceChannelName ?? "Voice"} · ${p.listeners ?? 0} listening`
        : "On the bench";
  return (
    <div className="sticky top-0 z-20 border-b border-ink bg-stock px-3 pb-2" style={{ height: HEADER_H }}>
      <div
        className={cx("mb-3 h-2", !inst.inGuild && "bg-[length:14px_8px]")}
        style={
          inst.inGuild
            ? { background: s.color }
            : { backgroundImage: `linear-gradient(to right, ${"#8a8378"} 60%, transparent 0)`, backgroundSize: "14px 8px" }
        }
      />
      <button
        type="button"
        onClick={() => nav(`/servers/${guildId}/player?bot=${inst.instance}`)}
        disabled={!inst.inGuild}
        className={cx("group flex max-w-full items-start gap-1 text-left", !inst.inGuild && "cursor-default")}
        style={{ viewTransitionName: `stage-${inst.instance}` } as React.CSSProperties}
      >
        <span className={cx("bill truncate text-[38px]", !inst.inGuild && "text-ink-3")}>{inst.name}</span>
        {inst.inGuild ? <ArrowUpRight size={18} className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" /> : null}
      </button>
      <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-semibold text-ink-2">
        {p?.isConnected ? <Volume2 size={14} className="shrink-0" style={{ color: s.color }} /> : null}
        <span className="truncate">{status}</span>
      </p>
    </div>
  );
}

function MoreHeader() {
  return (
    <div className="sticky top-0 z-20 border-b border-ink bg-stock px-3 pb-2" style={{ height: HEADER_H }}>
      <div className="mb-3 h-2" style={{ backgroundImage: "linear-gradient(to right, #b9b1a4 60%, transparent 0)", backgroundSize: "14px 8px" }} />
      <p className="bill text-[38px] text-ink-3">More stages</p>
      <p className="mt-1 text-[13px] font-semibold text-ink-3">Coming to Bypass</p>
    </div>
  );
}

type Control = (inst: number, cmd: Parameters<ReturnType<typeof useGuildLive>["send"]>[1], params?: Record<string, unknown>, label?: string) => Promise<unknown>;

function StageColumn({
  inst,
  origin,
  now,
  height,
  control,
  guildName,
  mine,
}: {
  inst: FleetInstance;
  origin: number;
  now: number;
  height: number;
  control: Control;
  guildName: string;
  mine: boolean;
}) {
  const s = stage(inst.instance);
  const p = inst.playback;
  const nowY = px(now - origin);

  // Remember the set that just finished so it can leave the bill.
  const prev = useRef<{ key: string; top: number; height: number; title: string } | null>(null);
  const [ghost, setGhost] = useState<{ key: string; top: number; height: number; title: string } | null>(null);
  const curKey = p?.currentTrack ? `${p.currentTrack.url}|${p.currentTrack.title}` : "";
  useEffect(() => {
    const before = prev.current;
    if (before && before.key !== curKey) {
      setGhost(before);
      const id = setTimeout(() => setGhost(null), 650);
      return () => clearTimeout(id);
    }
  }, [curKey]);

  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);

  if (!inst.inGuild) {
    return (
      <div className="relative z-[1] border-r border-rule px-3" style={{ height }}>
        <div className="absolute inset-x-3 inset-y-0 rounded-[2px] border-[1.5px] border-dashed border-ink/35" />
        <div className="sticky z-10 mx-1.5 mt-6 rounded-[4px] border-[1.5px] border-dashed border-ink/50 bg-stock p-4" style={{ top: HEADER_H + 24 }}>
          <p className="bill text-[30px]">Not in {guildName}</p>
          <p className="mt-2 text-[14px] leading-snug text-ink-2">
            Invite {inst.name} to run another voice channel at the same time. One <code className="font-semibold">/play</code> still covers every stage.
          </p>
          <a href={inst.inviteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-ink px-3.5 text-[13px] font-semibold text-stock hover:bg-ink-2">
            Invite {inst.name} <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    );
  }

  if (!inst.online) {
    return (
      <div className="hatch relative z-[1] border-r border-rule" style={{ height }}>
        <div className="sticky z-10 mx-3 mt-6 rounded-[4px] border border-ink/30 bg-stock p-4" style={{ top: HEADER_H + 24 }}>
          <p className="bill text-[30px] text-ink-2">Off air</p>
          <p className="mt-2 text-[14px] text-ink-2">{inst.name} isn&apos;t responding right now. Its stage comes back on its own when it reconnects.</p>
        </div>
      </div>
    );
  }

  if (!p?.currentTrack) {
    return (
      <div className="relative z-[1] border-r border-rule" style={{ height, background: `color-mix(in srgb, ${s.tint} 45%, transparent)` }}>
        <div
          className="absolute inset-x-3 rounded-[4px] border-2 bg-stock/90 p-4"
          style={{ top: Math.max(12, nowY + 16), borderColor: s.color }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.benchArt} alt="" width={480} height={320} className="-mt-1 mb-1 w-full" />
          <p className="bill text-[30px]">On the bench</p>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
            {p?.isConnected ? `Waiting in ${p.voiceChannelName}.` : "Idle."}
            {inst.binding.voiceChannelId ? " It has a home channel set in Settings." : " Send it to any voice channel with a song."}
          </p>
          <Button className="mt-3" size="sm" variant="stage" stageColor={s.color} stageOn={s.on} onClick={() => openAdd(inst.instance)}>
            <Play size={14} /> Start music here
          </Button>
        </div>
      </div>
    );
  }

  const start = currentStart(p, now);
  const curDur = trackMs(p.currentTrack);
  const curTop = px(start - origin);
  const curH = Math.max(px(curDur), 44);
  const playedH = Math.min(curH, Math.max(0, nowY - curTop));
  prev.current = { key: curKey, top: curTop, height: curH, title: p.currentTrack.title };

  let cursor = start + curDur;
  const upcoming = p.queue.map((t, idx) => {
    const top = px(cursor - origin);
    const h = px(trackMs(t));
    const at = cursor;
    cursor += trackMs(t);
    return { t, idx, top, h, at };
  });
  const endTop = px(cursor - origin);
  const paused = p.isPaused;
  const remaining = Math.max(0, curDur - livePosition(p, now));

  return (
    <div className="relative z-[1] border-r border-rule" style={{ height }}>
      {ghost ? (
        <div
          aria-hidden
          className="absolute inset-x-1.5 rounded-[3px] p-3"
          style={{ top: ghost.top, height: ghost.height, background: s.color, color: s.on, animation: "set-off 600ms cubic-bezier(0.7,0,0.84,0) forwards" }}
        >
          <p className="bill truncate text-[22px]">{ghost.title}</p>
        </div>
      ) : null}

      {/* Now playing set */}
      <article
        key={curKey}
        aria-label={`Now on ${inst.name}: ${p.currentTrack.title} by ${p.currentTrack.author}`}
        className="print-pull absolute inset-x-1.5 overflow-hidden rounded-[3px]"
        style={{ top: curTop, height: curH, background: s.color, color: s.on }}
      >
        <div aria-hidden className="hatch absolute inset-x-0 top-0 bg-ink/15" style={{ height: playedH }} />
        <div className="relative flex h-full flex-col p-3">
          <div className="flex items-start gap-2">
            <p className="bill line-clamp-2 min-w-0 flex-1 text-[24px]">{p.currentTrack.title}</p>
            <span className="clock shrink-0 text-[26px] leading-none" aria-label={`${fmtMs(remaining)} left`}>
              {paused ? "II" : `−${fmtMs(remaining)}`}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-semibold opacity-90">
            {p.currentTrack.author} · {p.currentTrack.duration}
            {mine ? " · your channel" : ""}
          </p>
          <div className="mt-auto flex items-center gap-1 pt-2" style={{ position: "sticky", bottom: 8 }}>
            <Transport inst={inst.instance} paused={paused} color={s.on} control={control} />
          </div>
        </div>
      </article>

      {/* Upcoming sets */}
      {upcoming.map(({ t, idx, top, h, at }) => (
        <UpcomingBlock
          key={`${t.url}|${t.title}|${idx}`}
          track={t}
          position={idx + 1}
          top={top}
          height={h}
          at={at}
          inst={inst.instance}
          control={control}
          dragging={drag?.from === idx + 1}
          dropBefore={drag?.over === idx + 1 && drag.from !== idx + 1}
          onDragStart={() => setDrag({ from: idx + 1, over: null })}
          onDragOver={() => setDrag((d) => (d ? { ...d, over: idx + 1 } : d))}
          onDrop={() => {
            if (drag && drag.from !== idx + 1) void control(inst.instance, "move", { from: drag.from, to: idx + 1 }, "move that song");
            setDrag(null);
          }}
          onDragEnd={() => setDrag(null)}
        />
      ))}

      {/* Queue end */}
      <div
        className="absolute inset-x-1.5 rounded-[3px] border-[1.5px] border-dashed p-3"
        style={{ top: endTop + 4, height: QUEUE_END_PX, borderColor: s.color }}
      >
        <p className="clock text-[34px] leading-none" style={{ color: s.color === "#f5b700" ? "#9a7300" : s.color }}>
          {fmtClock(cursor)}
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
          Queue ends. {p.autoplay ? "Autoplay is on, similar songs follow." : "Autoplay is off, the stage goes quiet."}
        </p>
        <Button size="sm" variant="outline" className="mt-2.5" onClick={() => openAdd(inst.instance)}>
          <Plus size={14} /> Add songs
        </Button>
      </div>
    </div>
  );
}

function Transport({ inst, paused, color, control }: { inst: number; paused: boolean; color: string; control: Control }) {
  const cls = "hover:bg-black/15 focus-visible:outline-current";
  return (
    <>
      <IconButton label="Previous" size={32} className={cls} style={{ color }} onClick={() => void control(inst, "previous", {}, "go back")}>
        <SkipBack size={16} fill="currentColor" />
      </IconButton>
      <IconButton
        label={paused ? "Resume" : "Pause"}
        size={32}
        className="bg-black/20 hover:bg-black/30"
        style={{ color }}
        onClick={() => void control(inst, paused ? "resume" : "pause", {}, paused ? "resume" : "pause")}
      >
        {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
      </IconButton>
      <IconButton label="Skip" size={32} className={cls} style={{ color }} onClick={() => void control(inst, "skip", {}, "skip")}>
        <SkipForward size={16} fill="currentColor" />
      </IconButton>
    </>
  );
}

function UpcomingBlock({
  track,
  position,
  top,
  height,
  at,
  inst,
  control,
  dragging,
  dropBefore,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  track: Track;
  position: number;
  top: number;
  height: number;
  at: number;
  inst: number;
  control: Control;
  dragging: boolean;
  dropBefore: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const s = stage(inst);
  const tall = height >= 52;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={cx(
        "print-pull group absolute inset-x-1.5 cursor-grab overflow-hidden rounded-[3px] transition-[opacity,transform] duration-200 active:cursor-grabbing",
        dragging && "scale-[0.98] opacity-40",
      )}
      style={{ top: top + 2, height: Math.max(height - 2, 22), background: s.color, color: s.on }}
    >
      {dropBefore ? <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-[3px] bg-ink" /> : null}
      <div className={cx("flex h-full gap-2 px-3", tall ? "flex-col py-2" : "items-center")}>
        <div className="flex min-w-0 items-start gap-2">
          <p className={cx("bill min-w-0 flex-1 truncate", tall ? "text-[20px]" : "text-[15px]")}>{track.title}</p>
          <span className="clock shrink-0 text-[12px] opacity-85">{fmtClock(at)}</span>
          <Menu
            label={`Actions for ${track.title}`}
            align="right"
            trigger={({ open, toggle, id }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={id}
                aria-label={`Actions for ${track.title}`}
                className="-mr-1 -mt-0.5 rounded-[3px] p-0.5 opacity-70 transition-opacity hover:bg-black/15 hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem onSelect={() => { close(); void control(inst, "skipto", { position }, "jump to that song"); }}>
                  <Play size={15} /> Play now
                </MenuItem>
                <MenuItem disabled={position === 1} onSelect={() => { close(); void control(inst, "move", { from: position, to: 1 }, "move that song"); }}>
                  <ListPlus size={15} /> Play next
                </MenuItem>
                <MenuItem danger onSelect={() => { close(); void control(inst, "remove", { position }, "remove that song"); }}>
                  <Trash2 size={15} /> Remove from queue
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
        {tall ? (
          <p className="truncate text-[12.5px] font-semibold opacity-90">
            {track.author} · {track.duration}
            {track.requestedBy ? ` · ${track.requestedBy.username}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MoreColumn({ height }: { height: number }) {
  return (
    <div className="relative z-[1] px-3" style={{ height }}>
      <div className="sticky z-10 mt-6 rounded-[4px] border-[1.5px] border-dashed border-ink/35 bg-stock p-4" style={{ top: HEADER_H + 24 }}>
        <p className="bill text-[28px] text-ink-2">Up to four stages, free</p>
        <p className="mt-2 text-[14px] leading-snug text-ink-2">
          Extra Bypass bots that each play in their own voice channel are on the way. This column fills in when they launch.
        </p>
      </div>
    </div>
  );
}

function Strip({ guildId }: { guildId: string }) {
  const { data } = useActivity(30);
  return (
    <div className="relative z-30 flex items-center gap-6 border-t-2 border-ink bg-ink px-4 py-2.5 text-stock sm:px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dash/crowd-strip.webp"
        alt=""
        width={768}
        height={256}
        className="pointer-events-none absolute bottom-full right-6 hidden h-16 w-auto opacity-90 md:block"
      />
      {data ? (
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <Stat value={fmtCount(data.totals.plays)} label="plays" />
          <Stat value={fmtListening(data.totals.listeningMs)} label="listened" />
          <Stat value={fmtCount(data.totals.requesters)} label="requesters" />
        </dl>
      ) : (
        <span className="text-sm text-stock/60">Loading the last 30 days…</span>
      )}
      <Link href={`/servers/${guildId}/activity`} className="ml-auto flex items-center gap-1 text-sm font-semibold text-stock/80 hover:text-stock">
        Last 30 days <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="clock text-[26px] leading-none">{value}</dd>
      <span aria-hidden className="text-[13px] text-stock/70">
        {label}
      </span>
    </div>
  );
}
