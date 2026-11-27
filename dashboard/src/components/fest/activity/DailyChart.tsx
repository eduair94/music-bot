"use client";

/**
 * Plays per day, stacked by the bot that played them: each stage colour is
 * that bot's share of the day, Bypass at the base, a 2px gap of paper
 * between stages. Today is the outlined column. The columns rise once, from
 * the baseline, the first time the chart is seen; after that the chart is
 * static. Hover a day, or focus the chart and use the arrow keys, for the
 * exact counts per stage.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtCount, fmtListening } from "@/lib/dash/format";
import { stage, stageName } from "@/lib/dash/stages";
import type { Activity, InstanceSplit } from "@/lib/dash/types";
import { fmtDay, niceScale, Tip, todayKeys, useRoving, useWidth } from "./chart";
import { instancesIn, splitOf, StageLegend } from "./stages";

const PLOT_H = 196;
const PAD_T = 30;
const PAD_B = 30;
const PAD_L = 34;
const INK = "#151515";
/** Paper between stacked stages. */
const GAP = 2;
/** Today's outline sits this far outside its column. */
const RING = 3;

function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** One day's stage segments as pixel spans, Bypass first (at the base). */
function segments(split: InstanceSplit, y: (v: number) => number) {
  const list = instancesIn(split);
  const out: { instance: number; y: number; h: number }[] = [];
  let cum = 0;
  list.forEach((inst, k) => {
    const bottom = y(cum);
    cum += split[String(inst)] ?? 0;
    const top = y(cum);
    // Paper separates a stage from the one above it; the topmost keeps its full height.
    const gap = k < list.length - 1 ? GAP : 0;
    out.push({ instance: inst, y: top + gap, h: Math.max(1, bottom - top - gap) });
  });
  return out;
}

export function DailyChart({ daily, byInstance }: { daily: Activity["daily"]; byInstance?: InstanceSplit }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const n = daily.length;
  const today = useMemo(() => {
    const keys = todayKeys();
    for (let i = n - 1; i >= 0; i--) if (keys.includes(daily[i].date)) return i;
    return -1;
  }, [daily, n]);
  const peak = useMemo(() => daily.reduce((best, d, i) => (d.plays > (daily[best]?.plays ?? -1) ? i : best), 0), [daily]);
  const splits = useMemo(() => daily.map((d) => splitOf(d.byInstance, d.plays)), [daily]);
  // The stages that played in this period, in stage order; the legend lists only these.
  const periodSplit = useMemo(() => {
    if (instancesIn(byInstance).length) return byInstance!;
    const sum: InstanceSplit = {};
    for (const sp of splits) for (const [k, v] of Object.entries(sp)) sum[k] = (sum[k] ?? 0) + v;
    return sum;
  }, [byInstance, splits]);
  const present = instancesIn(periodSplit);
  const multi = present.length > 1;
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
  const aSplit = active !== null ? splits[active] : {};
  const aStages = instancesIn(aSplit);
  const dayName = (i: number) => (i === today ? "Today" : fmtDay(daily[i].date));
  const fade = (delay: number) => ({
    opacity: risen ? 1 : 0,
    transition: instant ? "none" : `opacity 220ms ease-out ${delay + 380}ms`,
  });

  return (
    <div ref={host}>
      <StageLegend split={periodSplit} className="mb-2" />
      <div
        ref={wrap}
        className="relative rounded-[4px] outline-offset-4"
        role="group"
        aria-label={`Plays per day${multi ? ", stacked by stage" : ""}. Use the arrow keys to read each day.`}
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
            const dim = active !== null && active !== i;
            const delay = n > 1 ? Math.round((i / (n - 1)) * 300) : 0;
            const segs = h > 0 ? segments(splits[i], y) : [];
            const x0 = cx(i) - barW / 2;
            const ringTop = h > 0 ? y(d.plays) - RING : y(0) - 14;
            return (
              <g key={d.date}>
                {segs.length ? (
                  <g
                    style={{
                      opacity: dim ? 0.4 : 1,
                      transformBox: "fill-box",
                      transformOrigin: "50% 100%",
                      transform: risen ? "scaleY(1)" : "scaleY(0)",
                      transition:
                        instant || !risen ? "opacity 150ms" : `transform 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity 150ms`,
                    }}
                  >
                    {segs.map((sg, k) =>
                      k === segs.length - 1 ? (
                        <path key={sg.instance} d={columnPath(x0, sg.y, barW, sg.h)} fill={stage(sg.instance).color} />
                      ) : (
                        <rect key={sg.instance} x={x0} y={sg.y} width={barW} height={sg.h} fill={stage(sg.instance).color} />
                      ),
                    )}
                  </g>
                ) : null}
                {isToday ? (
                  // Today is still filling in: an ink outline marks it, never a colour (colours are the bots).
                  <rect
                    x={x0 - RING}
                    y={ringTop}
                    width={barW + RING * 2}
                    height={y(0) - ringTop}
                    rx={4}
                    fill="none"
                    stroke={INK}
                    strokeWidth={1.5}
                    strokeDasharray={h > 0 ? undefined : "3 2"}
                    style={fade(delay)}
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
                    y={(isToday ? ringTop : y(d.plays)) - 7}
                    textAnchor="middle"
                    className="clock"
                    fontSize={13}
                    fill={INK}
                    style={fade(delay)}
                  >
                    {fmtCount(d.plays)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {a && active !== null ? (
          <Tip x={cx(active)} y={y(a.plays) - (active === today ? RING : 0)} width={width}>
            <p className="flex items-baseline gap-1.5">
              <span className="clock text-[22px] leading-none">{fmtCount(a.plays)}</span>
              <span className="text-[12px] text-stock/80">play{a.plays === 1 ? "" : "s"}</span>
            </p>
            {multi && aStages.length ? (
              <ul className="mt-1 space-y-0.5">
                {aStages.map((inst) => (
                  <li key={inst} className="flex items-center gap-1.5 text-[12px]">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: stage(inst).color }} />
                    <span className="text-stock/85">{stageName(inst)}</span>
                    <span className="clock ml-auto pl-3 text-[13px]">{fmtCount(aSplit[String(inst)] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-0.5 text-[12px] text-stock/75">
              {dayName(active)} · {fmtListening(a.listeningMs)}
            </p>
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {a && active !== null
            ? `${dayName(active)}: ${a.plays} plays${
                multi && aStages.length ? ` (${aStages.map((inst) => `${stageName(inst)} ${aSplit[String(inst)] ?? 0}`).join(", ")})` : ""
              }, ${fmtListening(a.listeningMs)} listened`
            : ""}
        </p>
      </div>

      <table className="sr-only">
        <caption>Plays per day{multi ? ", by stage" : ""}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Plays</th>
            {multi
              ? present.map((inst) => (
                  <th key={inst} scope="col">
                    {stageName(inst)}
                  </th>
                ))
              : null}
            <th scope="col">Listening</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d, i) => (
            <tr key={d.date}>
              <td>{fmtDay(d.date)}</td>
              <td>{d.plays}</td>
              {multi ? present.map((inst) => <td key={inst}>{splits[i][String(inst)] ?? 0}</td>) : null}
              <td>{fmtListening(d.listeningMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
