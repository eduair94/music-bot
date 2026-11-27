"use client";

/**
 * The deck of one stage: the set on now (artwork + title, printed in when
 * the song changes while the last one leaves upward), position, transport,
 * volume, autoplay, stop, and effects. Space plays/pauses, ← → jump 10 s.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square, Volume1, Volume2, VolumeX, Lock } from "lucide-react";
import { fmtClock, livePosition, trackMs } from "@/lib/dash/format";
import { useTicker } from "@/lib/dash/live";
import { stage, type StageStyle } from "@/lib/dash/stages";
import type { FleetInstance, LiveAudio, LoopMode, Me, PlaybackState, Track } from "@/lib/dash/types";
import { cx, Slider, Switch } from "../ui";
import { SeekBar } from "./SeekBar";
import {
  ConfirmInline,
  Ctl,
  gateOf,
  GROUP_LABEL,
  LOCK_NOTE_ID,
  PLAYER_GROUPS,
  sourceLabel,
  trackKey,
  useControl,
  usePending,
  useReducedMotion,
  type Gate,
} from "./shared";

const EFFECTS: { name: string; label: string }[] = [
  { name: "bassboost", label: "Bass boost" },
  { name: "nightcore", label: "Nightcore" },
  { name: "vaporwave", label: "Vaporwave" },
  { name: "8d", label: "8D" },
  { name: "karaoke", label: "Karaoke" },
  { name: "tremolo", label: "Tremolo" },
  { name: "vibrato", label: "Vibrato" },
  { name: "lofi", label: "Lo-fi" },
];

const LOOP_NEXT: Record<LoopMode, LoopMode> = { off: "queue", queue: "track", track: "off" };
const LOOP_TEXT: Record<LoopMode, string> = { off: "Loop off", queue: "Loop queue", track: "Loop song" };

const EASE_OUT = "cubic-bezier(0.16,1,0.3,1)";
const EASE_IN = "cubic-bezier(0.7,0,0.84,0)";
/** The old set leaves first; the new one is printed as it clears. */
const OUT_MS = 320;

export function PlayerDeck({ inst, p, me }: { inst: FleetInstance; p: PlaybackState; me: Me | null }) {
  const s = stage(inst.instance);
  const control = useControl(inst.instance);
  const track = p.currentTrack as Track;
  const duration = trackMs(track);

  const gates = useMemo(
    () => ({
      playback: gateOf(me, "playback"),
      skip: gateOf(me, "skip"),
      queue: gateOf(me, "queue"),
      volume: gateOf(me, "volume"),
      effects: gateOf(me, "effects"),
      loop: gateOf(me, "loop_autoplay"),
      stop: gateOf(me, "stop_leave"),
    }),
    [me],
  );

  // ── Pause / resume (answers at once, then follows the bot) ──
  const [paused, setPaused, clearPaused] = usePending(p.isPaused);
  const togglePlay = useCallback(async () => {
    const next = !paused;
    setPaused(next);
    const r = await control(next ? "pause" : "resume", {}, next ? "Couldn't pause" : "Couldn't resume");
    if (!r.success) clearPaused();
  }, [paused, setPaused, clearPaused, control]);

  // ── Seek: hold the requested position until the bot reports a new one ──
  const posSig = `${trackKey(track)}|${p.currentPosition}|${p.positionAt}`;
  const [seek, setSeek] = useState<{ pos: number; at: number; base: string } | null>(null);
  useEffect(() => {
    if (seek && seek.base !== posSig) setSeek(null);
  }, [posSig, seek]);
  useEffect(() => {
    if (!seek) return;
    const id = setTimeout(() => setSeek(null), 5000);
    return () => clearTimeout(id);
  }, [seek]);

  const running = p.isPlaying && !paused;
  const positionAt = useCallback(
    (now: number) => {
      if (seek) {
        const v = seek.pos + (running ? Math.max(0, now - seek.at) : 0);
        return duration > 0 ? Math.min(v, duration) : v;
      }
      return livePosition(p, now);
    },
    [seek, running, duration, p],
  );

  const seekTo = useCallback(
    async (ms: number) => {
      if (duration <= 0) return;
      const pos = Math.round(Math.min(Math.max(0, ms), Math.max(0, duration - 1000)));
      setSeek({ pos, at: Date.now(), base: posSig });
      const r = await control("seek", { position: pos }, "Couldn't seek");
      if (!r.success) setSeek(null);
    },
    [duration, posSig, control],
  );

  // ── Keyboard: Space = play/pause, ← → = 10 s, when not typing ──
  const keys = useRef({ togglePlay, seekTo, positionAt, gates });
  keys.current = { togglePlay, seekTo, positionAt, gates };
  useEffect(() => {
    // Controls clicked with the mouse keep focus; Space should still mean play/pause then.
    let pointerFocus: Element | null = null;
    let swallowUp = false;
    const isSpace = (e: KeyboardEvent) => e.key === " " || e.code === "Space";
    const onPointerDown = (e: PointerEvent) => {
      pointerFocus = (e.target as Element | null)?.closest?.("button,a,[role]") ?? null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") pointerFocus = null;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      const k = keys.current;
      if (isSpace(e)) {
        const interactive = tag === "BUTTON" || tag === "A" || Boolean(t?.getAttribute?.("role"));
        if (interactive && !(pointerFocus && pointerFocus === t)) return;
        e.preventDefault();
        swallowUp = true;
        if (!e.repeat && k.gates.playback.ok) void k.togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (t?.closest('[role="tablist"],[role="menu"],[role="slider"],[role="group"]')) return;
        e.preventDefault();
        if (k.gates.playback.ok) void k.seekTo(k.positionAt(Date.now()) + (e.key === "ArrowRight" ? 10_000 : -10_000));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (swallowUp && isSpace(e)) {
        e.preventDefault();
        swallowUp = false;
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  // ── Loop / autoplay / effects ──
  const [loop, setLoop, clearLoop] = usePending<LoopMode>(p.loopMode ?? "off");
  const cycleLoop = async () => {
    const next = LOOP_NEXT[loop];
    setLoop(next);
    const r = await control("loop", { loopMode: next }, "Couldn't change loop");
    if (!r.success) clearLoop();
  };

  const [autoplay, setAutoplay, clearAutoplay] = usePending<boolean>(Boolean(p.autoplay));
  const toggleAutoplay = async (v: boolean) => {
    setAutoplay(v);
    const r = await control("autoplay", { enabled: v }, v ? "Couldn't turn autoplay on" : "Couldn't turn autoplay off");
    if (!r.success) clearAutoplay();
  };

  const [filters, setFilters, clearFilters] = usePending<string[]>(p.filters ?? []);
  const toggleFilter = async (name: string) => {
    const on = !filters.includes(name);
    setFilters(on ? [...filters, name] : filters.filter((f) => f !== name));
    const r = await control("filter", { name, enabled: on }, "Couldn't change effects");
    if (!r.success) clearFilters();
  };

  return (
    <div className="space-y-6">
      <NowPlaying track={track} s={s} instanceName={inst.name}>
        <SetTimes duration={duration} positionAt={positionAt} />
      </NowPlaying>

      <SeekBar
        duration={duration}
        positionAt={positionAt}
        onSeek={(ms) => void seekTo(ms)}
        color={s.color}
        gate={gates.playback}
        paused={paused}
        title={track.title}
      />

      {/* Transport */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Ctl label="Previous" gate={gates.playback} size={48} className="text-ink hover:bg-ink/[0.07]" onPress={() => void control("previous", {}, "Couldn't go back")}>
          <SkipBack size={22} fill="currentColor" />
        </Ctl>
        <Ctl
          label={paused ? "Resume" : "Pause"}
          gate={gates.playback}
          size={60}
          aria-keyshortcuts="Space"
          className="bg-ink text-stock hover:bg-ink-2 aria-disabled:hover:bg-ink"
          onPress={() => void togglePlay()}
        >
          {paused ? <Play size={26} fill="currentColor" className="translate-x-[1px]" /> : <Pause size={26} fill="currentColor" />}
        </Ctl>
        <Ctl label="Skip" gate={gates.skip} size={48} className="text-ink hover:bg-ink/[0.07]" onPress={() => void control("skip", {}, "Couldn't skip")}>
          <SkipForward size={22} fill="currentColor" />
        </Ctl>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Ctl
            label="Shuffle the queue"
            gate={gates.queue}
            unavailable={p.queue.length < 2 && "Shuffle needs two or more songs in the queue"}
            size={null}
            className="h-10 gap-1.5 border border-ink/25 px-2.5 text-[13px] font-semibold text-ink hover:border-ink aria-disabled:hover:border-ink/25"
            onPress={() => void control("shuffle", {}, "Couldn't shuffle")}
          >
            <Shuffle size={17} />
            <span className="hidden sm:inline">Shuffle</span>
          </Ctl>
          <Ctl
            label={`${LOOP_TEXT[loop]}. Change to ${LOOP_TEXT[LOOP_NEXT[loop]].toLowerCase()}`}
            gate={gates.loop}
            size={null}
            className={cx("h-10 gap-1.5 border px-2.5 text-[13px] font-semibold", loop === "off" && "border-ink/25 text-ink hover:border-ink aria-disabled:hover:border-ink/25")}
            style={loop === "off" ? undefined : { background: s.color, borderColor: s.color, color: s.on }}
            onPress={() => void cycleLoop()}
          >
            {loop === "track" ? <Repeat1 size={17} /> : <Repeat size={17} />}
            <span>{LOOP_TEXT[loop]}</span>
          </Ctl>
        </div>
      </div>

      <Mixer p={p} s={s} gate={gates.volume} control={control} />
      <Signal audio={p.audio} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3" title={gates.loop.ok ? undefined : gates.loop.reason}>
          <Switch checked={autoplay} onChange={(v) => void toggleAutoplay(v)} label="Autoplay" disabled={!gates.loop.ok} color={s.color} />
          <div className="leading-tight">
            <p className="text-[14px] font-semibold">Autoplay</p>
            <p className="text-[12.5px] text-ink-2">Similar songs when the queue runs out</p>
          </div>
        </div>
        <div className="ml-auto">
          <ConfirmInline
            label="Stop"
            icon={<Square size={13} fill="currentColor" />}
            question="Stop and leave?"
            confirmLabel="Yes, stop"
            gate={gates.stop}
            onConfirm={() => control("stop", {}, "Couldn't stop")}
          />
        </div>
      </div>

      <Effects s={s} filters={filters} gate={gates.effects} onToggle={(n) => void toggleFilter(n)} />

      <LockNote me={me} />

      <p className="hidden text-[12.5px] text-ink-3 md:block">
        <Kbd>Space</Kbd> play or pause · <Kbd>←</Kbd> <Kbd>→</Kbd> jump 10 s · <Kbd>/</Kbd> add a song
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[3px] border border-ink/25 bg-paper/60 px-1.5 font-[inherit] text-[11.5px] text-ink-2">{children}</kbd>;
}

// ── Now playing: artwork + title, printed in on every new song ──────────────

function titleSize(title: string): string {
  if (title.length <= 18) return "text-[34px] sm:text-[44px] lg:text-[36px] xl:text-[50px]";
  if (title.length <= 34) return "text-[30px] sm:text-[38px] lg:text-[32px] xl:text-[42px]";
  return "text-[26px] sm:text-[30px] lg:text-[27px] xl:text-[34px]";
}

function NowPlaying({ track, s, instanceName, children }: { track: Track; s: StageStyle; instanceName: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const key = trackKey(track);
  const last = useRef<Track | null>(null);
  const [ghost, setGhost] = useState<Track | null>(null);

  // The delay is fixed per song so re-renders never restart the print.
  const entry = useRef<{ key: string; delay: number } | null>(null);
  if (entry.current?.key !== key) entry.current = { key, delay: entry.current ? OUT_MS - 40 : 0 };

  useEffect(() => {
    const before = last.current;
    last.current = track;
    if (!before || trackKey(before) === key || reduce) return;
    setGhost(before);
    const id = setTimeout(() => setGhost(null), OUT_MS + 40);
    return () => clearTimeout(id);
    // Only a new song (not a new object for the same song) swaps the block.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <section aria-label={`Now playing on ${instanceName}`} className="relative">
      <TrackBlock
        key={key}
        track={track}
        s={s}
        style={reduce ? undefined : { animation: `print-pull 620ms ${EASE_OUT} ${entry.current.delay}ms backwards` }}
      >
        {children}
      </TrackBlock>
      {ghost ? (
        <TrackBlock
          track={ghost}
          s={s}
          inert
          className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-stock"
          style={{ animation: `set-off ${OUT_MS}ms ${EASE_IN} forwards` }}
        />
      ) : null}
    </section>
  );
}

function TrackBlock({
  track,
  s,
  className,
  style,
  inert,
  children,
}: {
  track: Track;
  s: StageStyle;
  className?: string;
  style?: CSSProperties;
  inert?: boolean;
  children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const art = track.thumbnail && !broken ? track.thumbnail : null;
  const link = /^https?:\/\//i.test(track.url) ? track.url : null;
  const source = sourceLabel(track.source);
  return (
    <div aria-hidden={inert || undefined} inert={inert || undefined} className={cx("flex items-start gap-4 sm:gap-5", className)} style={style}>
      <div
        className="relative aspect-square w-[7.25rem] shrink-0 overflow-hidden rounded-[4px] sm:w-[10.5rem] lg:w-[8.5rem] xl:w-[12.5rem]"
        style={{ background: s.tint }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" width={400} height={400} onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.benchArt} alt="" width={960} height={640} className="absolute bottom-[6%] left-1/2 w-[128%] max-w-none -translate-x-1/2" />
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset ring-ink/15" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className={cx("bill -m-1 line-clamp-4 p-1 text-balance break-words", titleSize(track.title))}>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="decoration-2 underline-offset-4 hover:underline">
              {track.title}
            </a>
          ) : (
            track.title
          )}
        </h2>
        <p className="mt-2 truncate text-[16px] font-semibold sm:text-[17px]">{track.author}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
          {track.requestedBy ? (
            <>
              Requested by <span className="font-semibold text-ink">{track.requestedBy.username}</span>
            </>
          ) : null}
          {track.requestedBy && source ? " · " : null}
          {source}
        </p>
        {children}
      </div>
    </div>
  );
}

/** The set's slot on the wall clock, like a time on the bill. */
function SetTimes({ duration, positionAt }: { duration: number; positionAt: (now: number) => number }) {
  const now = useTicker(1000);
  const start = now - positionAt(now);
  return (
    <p className="clock mt-3 text-[20px] leading-none sm:mt-4 sm:text-[24px]">
      {duration > 0 ? (
        <>
          {fmtClock(start)}
          <span className="px-1 text-ink-3">–</span>
          {fmtClock(start + duration)}
        </>
      ) : (
        <>On since {fmtClock(start)}</>
      )}
    </p>
  );
}

// ── Volume ───────────────────────────────────────────────────────────────────

function Mixer({
  p,
  s,
  gate,
  control,
}: {
  p: PlaybackState;
  s: StageStyle;
  gate: Gate;
  control: ReturnType<typeof useControl>;
}) {
  const [vol, setVol] = useState(p.volume);
  const editing = useRef(false);
  const sent = useRef(p.volume);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing.current) setVol(p.volume);
    sent.current = p.volume;
  }, [p.volume]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = (v: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (v === sent.current) {
      editing.current = false;
      return;
    }
    sent.current = v;
    void control("volume", { volume: v }, "Couldn't change the volume").then((r) => {
      editing.current = false;
      if (!r.success) setVol(p.volume);
    });
  };

  const Icon = vol === 0 ? VolumeX : vol < 50 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-3" title={gate.ok ? undefined : gate.reason}>
      <Icon size={20} className="shrink-0 text-ink-2" aria-hidden />
      <Slider
        label="Volume"
        value={vol}
        min={0}
        max={100}
        color="#151515"
        disabled={!gate.ok}
        className="min-w-0 flex-1"
        onChange={(v) => {
          editing.current = true;
          setVol(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v), 300);
        }}
        onCommit={commit}
      />
      <span className="clock w-9 shrink-0 text-right text-[18px] leading-none" aria-hidden>
        {vol}
      </span>
    </div>
  );
}

// ── Signal ───────────────────────────────────────────────────────────────────

/** What the bot really sends into the channel, and what holds it back if anything does. */
function Signal({ audio }: { audio?: LiveAudio }) {
  if (!audio) return null;
  const held = audio.kbps < audio.tierKbps;
  return (
    <p className="-mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px] leading-snug text-ink-2">
      <span className="clock text-[15px] leading-none text-ink">Opus {audio.kbps} kbps</span>
      <span>
        {held
          ? `This session could send ${audio.tierKbps} kbps; the voice channel${audio.channelKbps ? ` is set to ${audio.channelKbps} kbps and` : ""} holds it back. Raise the channel's bitrate in Discord to hear more.`
          : audio.tierKbps > 128
            ? "Hi-Fi: Premium, a vote or a support-server boost is on this session."
            : "Standard quality. Premium, a vote or a support-server boost raises the session's bitrate."}
      </span>
    </p>
  );
}

// ── Effects ──────────────────────────────────────────────────────────────────

function Effects({ s, filters, gate, onToggle }: { s: StageStyle; filters: string[]; gate: Gate; onToggle: (name: string) => void }) {
  const on = EFFECTS.filter((e) => filters.includes(e.name)).length;
  return (
    <section aria-labelledby="fx-title" className="border-t border-rule pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="fx-title" className="bill text-[26px]">
          Effects
        </h2>
        <span className="text-[13px] text-ink-2">{on === 0 ? "None on" : `${on} on`}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {EFFECTS.map((fx) => {
          const active = filters.includes(fx.name);
          return (
            <Ctl
              key={fx.name}
              label={fx.label}
              aria-pressed={active}
              gate={gate}
              size={null}
              onPress={() => onToggle(fx.name)}
              title={gate.ok ? `${active ? "Turn off" : "Turn on"} ${fx.label}` : gate.reason}
              className={cx(
                "h-10 min-w-0 border px-1.5 text-[13px] font-semibold",
                !active && "border-ink/25 bg-paper/60 text-ink hover:border-ink aria-disabled:hover:border-ink/25",
              )}
              style={active ? { background: s.color, borderColor: s.color, color: s.on } : undefined}
            >
              <span className="truncate">{fx.label}</span>
            </Ctl>
          );
        })}
      </div>
    </section>
  );
}

// ── Permissions: one note, saying what is locked and why ─────────────────────

function LockNote({ me }: { me: Me | null }) {
  const byReason = new Map<string, string[]>();
  for (const g of PLAYER_GROUPS) {
    const gate = gateOf(me, g);
    if (gate.ok) continue;
    const reason = gate.reason ?? "";
    byReason.set(reason, [...(byReason.get(reason) ?? []), GROUP_LABEL[g]]);
  }
  if (byReason.size === 0) return null;
  return (
    <div id={LOCK_NOTE_ID} className="flex gap-2.5 rounded-[4px] border-[1.5px] border-dashed border-ink/40 px-3 py-2.5 text-[13px] leading-snug text-ink-2">
      <Lock size={14} className="mt-0.5 shrink-0 text-ink" aria-hidden />
      <div className="space-y-1">
        {[...byReason].map(([reason, labels]) => (
          <p key={reason}>
            <span className="font-semibold text-ink">{labels.join(", ")}</span>
            {reason ? `: ${reason}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}
