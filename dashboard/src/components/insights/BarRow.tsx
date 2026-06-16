"use client";

/** Horizontal proportion bar used in leaderboards. */
export function BarRow({
  value,
  max,
  accent = "#f8aa2a",
}: {
  value: number;
  max: number;
  accent?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-panel-raised overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: accent }}
      />
    </div>
  );
}
