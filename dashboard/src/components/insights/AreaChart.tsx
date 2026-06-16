"use client";

import { useId, useState } from "react";

export interface AreaPoint {
  label: string;
  value: number;
}

/**
 * Lightweight SVG area chart in the console aesthetic — amber stroke, gradient
 * fill, hover crosshair with a readout. No charting dependency.
 */
export function AreaChart({
  data,
  height = 260,
  valueFormat = (v) => v.toLocaleString(),
  accent = "#f8aa2a",
}: {
  data: AreaPoint[];
  height?: number;
  valueFormat?: (v: number) => string;
  accent?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const W = 1000;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-dust font-mono text-sm"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const x = (i: number) =>
    data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z`;

  // Label thinning so the axis never crowds
  const labelStep = Math.ceil(data.length / 8);

  const active = hover != null ? data[hover] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let nearest = 0;
          let best = Infinity;
          for (let i = 0; i < data.length; i++) {
            const d = Math.abs(x(i) - px);
            if (d < best) {
              best = d;
              nearest = i;
            }
          }
          setHover(nearest);
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline ticks */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH * f}
            y2={padT + innerH * f}
            stroke="#2b2520"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />

        {active && (
          <>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={padT}
              y2={padT + innerH}
              stroke={accent}
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(hover!)} cy={y(active.value)} r={4} fill={accent} />
          </>
        )}
      </svg>

      {/* x labels */}
      <div className="flex justify-between mt-1 px-1">
        {data.map((d, i) =>
          i % labelStep === 0 || i === data.length - 1 ? (
            <span key={i} className="font-mono text-[10px] text-dust">
              {d.label}
            </span>
          ) : null
        )}
      </div>

      {/* hover readout */}
      {active && (
        <div className="absolute top-0 left-0 console-panel rounded-md px-3 py-1.5 pointer-events-none">
          <div className="font-mono text-[10px] text-dust uppercase tracking-widest">
            {active.label}
          </div>
          <div className="stat-readout text-cream font-bold">{valueFormat(active.value)}</div>
        </div>
      )}
    </div>
  );
}
