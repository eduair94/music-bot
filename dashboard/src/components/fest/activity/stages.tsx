"use client";

/**
 * Which bot played what. Stage colours carry the instance (Bypass red,
 * Bypass 2 blue, Bypass 3 yellow…) through the Activity charts and lists;
 * sources and everything else stay in ink.
 */
import { fmtCount } from "@/lib/dash/format";
import { stage, stageName } from "@/lib/dash/stages";
import type { InstanceSplit } from "@/lib/dash/types";
import { cx } from "../ui";

/** Instances with plays in a split, in stage order (colour follows the bot, never its rank). */
export function instancesIn(split: InstanceSplit | undefined): number[] {
  return Object.entries(split ?? {})
    .filter(([, plays]) => plays > 0)
    .map(([key]) => Number(key))
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
}

/** A day's split, or all of it on Bypass when the API predates splits. */
export function splitOf(split: InstanceSplit | undefined, plays: number): InstanceSplit {
  return split && Object.keys(split).length ? split : plays > 0 ? { "1": plays } : {};
}

/** The bot's name on a block of its stage colour. */
export function StageChip({ instance, title, className }: { instance: number; title?: string; className?: string }) {
  const s = stage(instance);
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-[3px] px-1.5 text-[11.5px] font-bold leading-none",
        className,
      )}
      style={{ background: s.color, color: s.on }}
    >
      {stageName(instance)}
    </span>
  );
}

/** Stage swatches with each bot's plays: the key for the stacked chart. */
export function StageLegend({ split, className }: { split: InstanceSplit; className?: string }) {
  const list = instancesIn(split);
  if (!list.length) return null;
  return (
    <ul className={cx("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)} aria-label="Plays by stage">
      {list.map((n) => (
        <li key={n} className="flex items-center gap-1.5 text-[13.5px]">
          <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: stage(n).color }} />
          <span className="font-semibold">{stageName(n)}</span>
          <span className="clock text-[14px] text-ink-2">{fmtCount(split[String(n)] ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}
