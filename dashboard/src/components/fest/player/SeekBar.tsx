"use client";

/**
 * Scrubbable position of the current set. Dragging previews the time under
 * the thumb; the seek is sent once, on release. Arrow keys jump 10 s.
 */
import { useRef, useState } from "react";
import { useTicker } from "@/lib/dash/live";
import { fmtMs } from "@/lib/dash/format";
import { cx } from "../ui";
import { LOCK_NOTE_ID, type Gate } from "./shared";

const STEP = 10_000;

export function SeekBar({
  duration,
  positionAt,
  onSeek,
  color,
  gate,
  paused,
  title,
}: {
  duration: number;
  /** Interpolated position (ms) at a given wall-clock time. */
  positionAt: (now: number) => number;
  onSeek: (ms: number) => void;
  color: string;
  gate: Gate;
  paused: boolean;
  title: string;
}) {
  const now = useTicker(250);
  const bar = useRef<HTMLDivElement>(null);
  const dragRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const live = duration <= 0;
  const locked = !gate.ok || live;
  const pos = drag ?? (live ? positionAt(now) : Math.min(positionAt(now), duration));
  const pct = live ? 0 : Math.min(100, Math.max(0, (pos / duration) * 100));

  const at = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration);
  };
  const setDragValue = (v: number | null) => {
    dragRef.current = v;
    setDrag(v);
  };
  const jump = (ms: number) => onSeek(Math.min(Math.max(0, ms), Math.max(0, duration - 1000)));

  return (
    <div>
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label={`Position in ${title}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(pos / 1000)}
        aria-valuetext={live ? "Live stream" : `${fmtMs(pos)} of ${fmtMs(duration)}`}
        aria-disabled={locked || undefined}
        aria-describedby={gate.ok ? undefined : LOCK_NOTE_ID}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        title={!gate.ok ? gate.reason : live ? "Live stream, there is nothing to seek" : undefined}
        onPointerDown={(e) => {
          if (locked || e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragValue(at(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragRef.current === null) return;
          setDragValue(at(e.clientX));
        }}
        onPointerUp={() => {
          const v = dragRef.current;
          if (v === null) return;
          setDragValue(null);
          jump(v);
        }}
        onPointerCancel={() => setDragValue(null)}
        onKeyDown={(e) => {
          if (locked) return;
          const base = positionAt(Date.now());
          let next: number | null = null;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") next = base + STEP;
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = base - STEP;
          else if (e.key === "PageUp") next = base + 3 * STEP;
          else if (e.key === "PageDown") next = base - 3 * STEP;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = duration;
          if (next === null) return;
          e.preventDefault();
          e.stopPropagation();
          jump(next);
        }}
        className={cx("relative h-8 touch-none select-none", locked ? "cursor-not-allowed" : "cursor-pointer")}
      >
        <div className={cx("absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-[2px] bg-ink/[0.13]", locked && "opacity-60")}>
          <div className="h-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        {live ? null : (
          <span
            aria-hidden
            className="absolute top-1/2 h-4 w-4 rounded-[3px] border-2 border-paper bg-ink shadow-[0_1px_3px_rgb(21_21_21/0.35)] transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: `${pct}%`, transform: `translate(-50%, -50%) scale(${drag !== null ? 1.5 : 1})` }}
          />
        )}
        {drag !== null ? (
          <span
            aria-hidden
            className="clock pointer-events-none absolute bottom-[calc(100%+2px)] -translate-x-1/2 rounded-[3px] bg-ink px-1.5 py-0.5 text-[15px] leading-none text-stock"
            style={{ left: `clamp(1.25rem, ${pct}%, calc(100% - 1.25rem))` }}
          >
            {fmtMs(drag)}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="clock text-[18px] leading-none">
          {fmtMs(pos)}
          {paused ? <span className="ml-2 text-[13px] tracking-wide text-ink-2">PAUSED</span> : null}
        </span>
        <span className="clock text-[18px] leading-none text-ink-3">{live ? "LIVE" : fmtMs(duration)}</span>
      </div>
    </div>
  );
}
