"use client";

/**
 * Small chart kit for the Activity screen: element width, a clean y scale,
 * day labels, and the ink tooltip shared by the bar chart and the hour strip.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Width of an element, kept current with ResizeObserver. */
export function useWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean ticks from 0 to just above `max` (0 / 10 / 20 / 30…). */
export function niceScale(max: number, target = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const rough = max / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v));
  return { top, ticks };
}

/** "2026-11-27" → a local Date at noon (avoids the UTC-midnight day shift). */
export function dayDate(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return dayDate(key).toLocaleDateString(undefined, opts);
}

/** Local and UTC keys for today, so the series' last day matches either way it was bucketed. */
export function todayKeys(now = Date.now()): string[] {
  const d = new Date(now);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [local, d.toISOString().slice(0, 10)];
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Ink tooltip: the value leads, the label follows. Positioned in the parent's box. */
export function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const half = 74;
  const left = Math.min(Math.max(x, half), Math.max(half, width - half));
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 w-max max-w-[11rem] -translate-x-1/2 -translate-y-full rounded-[4px] bg-ink px-2.5 py-1.5 text-stock shadow-[0_8px_20px_-10px_rgb(21_21_21/0.6)]"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

/** Arrow-key navigation over n marks for a single focusable chart. */
export function useRoving(n: number, initial: () => number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    const cur = active ?? initial();
    let next = cur;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(n - 1, cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") return setActive(null);
    else return;
    e.preventDefault();
    setActive(next);
  };
  return {
    active,
    setActive,
    focusProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => setActive((a) => a ?? initial()),
      onBlur: () => setActive(null),
    },
  };
}
