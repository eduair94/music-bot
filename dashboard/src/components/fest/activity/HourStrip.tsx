"use client";

/**
 * Plays by hour of day as one strip of 24 cells. Heat is ink at five
 * opacity steps; an hour with no plays is a dashed empty cell. The busiest
 * hour carries a label.
 */
import { fmtCount } from "@/lib/dash/format";
import { cx } from "../ui";
import { fmtHour, Tip, useRoving, useWidth } from "./chart";

const STEPS = [0.12, 0.28, 0.48, 0.7, 0.92];
const CELL_H = 56;
const PEAK_H = 26;

function level(v: number, max: number): number {
  if (v <= 0 || max <= 0) return -1;
  return Math.min(STEPS.length - 1, Math.ceil((v / max) * STEPS.length) - 1);
}

export function HourStrip({ hours }: { hours: number[] }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const cells = Array.from({ length: 24 }, (_, h) => hours[h] ?? 0);
  const max = Math.max(...cells);
  const peak = max > 0 ? cells.indexOf(max) : -1;
  const { active, setActive, focusProps } = useRoving(24, () => (peak >= 0 ? peak : 0));
  const cellW = width / 24;
  const labelStep = width < 560 ? 6 : 3;

  return (
    <div>
      <div
        ref={wrap}
        role="group"
        aria-label="Plays by hour of day. Use the arrow keys to read each hour."
        className="relative rounded-[4px] outline-offset-4"
        style={{ paddingTop: PEAK_H }}
        {...focusProps}
      >
        {peak >= 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: Math.min(Math.max(cellW * peak + cellW / 2, 40), width - 40) }}
          >
            <span className="clock whitespace-nowrap text-[12px] leading-none text-ink">Peak {fmtHour(peak)}</span>
            <span className="mt-1 h-2.5 w-px bg-ink" />
          </div>
        ) : null}

        <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {cells.map((v, h) => {
            const l = level(v, max);
            return (
              <div
                key={h}
                onPointerEnter={() => setActive(h)}
                onPointerLeave={() => setActive(null)}
                className={cx(
                  "rounded-[3px] transition-[outline-color] duration-150",
                  l < 0 && "border border-dashed border-ink/25",
                  active === h ? "outline outline-2 outline-offset-1 outline-ink" : "outline-transparent",
                )}
                style={{ height: CELL_H, background: l < 0 ? "transparent" : `rgb(21 21 21 / ${STEPS[l]})` }}
              />
            );
          })}
        </div>

        <div aria-hidden className="relative mt-2 h-4">
          {cells.map((_, h) =>
            h % labelStep === 0 ? (
              <span key={h} className="clock absolute -translate-x-1/2 text-[11.5px] text-ink-3" style={{ left: cellW * h + cellW / 2 }}>
                {fmtHour(h).slice(0, 2)}
              </span>
            ) : null,
          )}
        </div>

        {active !== null ? (
          <Tip x={cellW * active + cellW / 2} y={PEAK_H} width={width}>
            <p className="flex items-baseline gap-1.5">
              <span className="clock text-[22px] leading-none">{fmtCount(cells[active])}</span>
              <span className="text-[12px] text-stock/80">play{cells[active] === 1 ? "" : "s"}</span>
            </p>
            <p className="clock mt-0.5 text-[12px] text-stock/75">
              {fmtHour(active)}–{fmtHour((active + 1) % 24)}
            </p>
          </Tip>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {active !== null ? `${fmtHour(active)} to ${fmtHour((active + 1) % 24)}: ${cells[active]} plays` : ""}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-3" aria-hidden>
        <span>Fewer</span>
        <span className="h-3 w-4 rounded-[2px] border border-dashed border-ink/25" />
        {STEPS.map((a) => (
          <span key={a} className="h-3 w-4 rounded-[2px]" style={{ background: `rgb(21 21 21 / ${a})` }} />
        ))}
        <span>More plays</span>
      </div>

      <table className="sr-only">
        <caption>Plays by hour of day</caption>
        <tbody>
          {cells.map((v, h) => (
            <tr key={h}>
              <th scope="row">{fmtHour(h)}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
