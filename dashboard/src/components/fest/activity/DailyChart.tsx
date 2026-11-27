"use client";

/**
 * Plays per day: ink columns on one baseline, today in the NOW red. The
 * columns rise once, from the baseline, the first time the chart is seen;
 * after that the chart is static. Hover a day, or focus the chart and use
 * the arrow keys, for the exact count.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtCount, fmtListening } from "@/lib/dash/format";
import type { Activity } from "@/lib/dash/types";
import { fmtDay, niceScale, Tip, todayKeys, useRoving, useWidth } from "./chart";

const PLOT_H = 196;
const PAD_T = 26;
const PAD_B = 30;
const PAD_L = 34;
const INK = "#151515";
const INK_HOVER = "#4a463f";
const NOW = "#d4001f";
const NOW_HOVER = "#a80019";

function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function DailyChart({ daily }: { daily: Activity["daily"] }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const n = daily.length;
  const today = useMemo(() => {
    const keys = todayKeys();
    for (let i = n - 1; i >= 0; i--) if (keys.includes(daily[i].date)) return i;
    return -1;
  }, [daily, n]);
  const peak = useMemo(() => daily.reduce((best, d, i) => (d.plays > (daily[best]?.plays ?? -1) ? i : best), 0), [daily]);
  const { top, ticks } = niceScale(Math.max(...daily.map((d) => d.plays), 0));

  const plotW = Math.max(120, width - PAD_L);
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(3, Math.min(24, slot * 0.68));
  const y = (v: number) => PAD_T + PLOT_H - (v / top) * PLOT_H;
  const cx = (i: number) => PAD_L + slot * i + slot / 2;

  // First view: columns rise from the baseline, staggered over at most 300 ms.
  const [risen, setRisen] = useState(false);
  const [instant, setInstant] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInstant(true);
      setRisen(true);
      return;
    }
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRisen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { active, setActive, focusProps } = useRoving(n, () => (today >= 0 ? today : n - 1));
  const labelEvery = n <= 10 ? 1 : 7;
  const showLabel = (i: number) => (today >= 0 ? (today - i) % labelEvery === 0 && i <= today : (n - 1 - i) % labelEvery === 0);
  const a = active !== null ? daily[active] : null;

  return (
    <div ref={host}>
      <div
        ref={wrap}
        className="relative rounded-[4px] outline-offset-4"
        role="group"
        aria-label="Plays per day. Use the arrow keys to read each day."
        {...focusProps}
      >
        <svg width={width} height={PAD_T + PLOT_H + PAD_B} className="block overflow-visible" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={width}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? INK : "#e0d8ca"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={PAD_L - 8} y={y(t)} dy="0.32em" textAnchor="end" className="clock" fontSize={11} fill="#6b665d">
                {fmtCount(t)}
              </text>
            </g>
          ))}

          {daily.map((d, i) => {
            const h = Math.max(0, PLOT_H - (y(d.plays) - PAD_T));
            const isToday = i === today;
            const on = active === i;
            const delay = n > 1 ? Math.round((i / (n - 1)) * 300) : 0;
            return (
              <g key={d.date}>
                {h > 0 ? (
                  <path
                    d={columnPath(cx(i) - barW / 2, y(d.plays), barW, h)}
                    fill={isToday ? (on ? NOW_HOVER : NOW) : on ? INK_HOVER : INK}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "50% 100%",
                      transform: risen ? "scaleY(1)" : "scaleY(0)",
                      transition: instant || !risen ? "fill 150ms" : `transform 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, fill 150ms`,
                    }}
                  />
                ) : null}
                {/* Hit area: the whole day slot, taller than the mark. */}
                <rect
                  x={PAD_L + slot * i}
                  y={PAD_T}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                />
                {showLabel(i) ? (
                  <text
                    x={i === n - 1 && cx(i) + 22 > width ? width : cx(i)}
                    y={PAD_T + PLOT_H + 18}
                    textAnchor={i === n - 1 && cx(i) + 22 > width ? "end" : "middle"}
                    className="clock"
                    fontSize={11.5}
                    fill={isToday ? INK : "#6b665d"}
                    fontWeight={isToday ? 800 : 700}
                  >
                    {isToday
                      ? "Today"
                      : fmtDay(d.date, n <= 10 ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" })}
                  </text>
                ) : null}
                {(isToday || i === peak) && d.plays > 0 ? (
                  <text
                    x={cx(i)}
                    y={y(d.plays) - 7}
                    textAnchor="middle"
                    className="clock"
                    fontSize={13}
                    fill={INK}
                    style={{ opacity: risen ? 1 : 0, transition: instant ? "none" : `opacity 220ms ease-out ${delay + 380}ms` }}
                  >
                    {fmtCount(d.plays)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {a && active !== null ? (
          <Tip x={cx(active)} y={y(a.plays)} width={width}>
            <p className="flex items-baseline gap-1.5">
              <span className="clock text-[22px] leading-none">{fmtCount(a.plays)}</span>
              <span className="text-[12px] text-stock/80">play{a.plays === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-0.5 text-[12px] text-stock/75">
              {active === today ? "Today" : fmtDay(a.date)} · {fmtListening(a.listeningMs)}
            </p>
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {a ? `${active === today ? "Today" : fmtDay(a.date)}: ${a.plays} plays, ${fmtListening(a.listeningMs)} listened` : ""}
        </p>
      </div>

      <table className="sr-only">
        <caption>Plays per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Plays</th>
            <th scope="col">Listening</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <td>{fmtDay(d.date)}</td>
              <td>{d.plays}</td>
              <td>{fmtListening(d.listeningMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
