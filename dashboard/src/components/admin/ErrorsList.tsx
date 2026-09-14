"use client";

import { relTime } from "@/lib/admin/format";
import type { RecentError } from "@/types/admin";
import { Chip, Label, Panel } from "./ui";

export function ErrorsList({ errors }: { errors: RecentError[] }) {
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <Label>Recent errors</Label>
        <Label>{errors.length === 0 ? "clean" : `last ${errors.length}`}</Label>
      </div>
      {errors.length === 0 ? (
        <p className="text-sm text-dune font-mono">No errors recorded.</p>
      ) : (
        <ul className="divide-y divide-line">
          {errors.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="py-2 flex flex-wrap gap-x-3 gap-y-1 items-baseline text-sm">
              <span className="font-mono text-[11px] text-dust w-16 shrink-0" title={e.ts}>
                {relTime(e.ts)}
              </span>
              <Chip tone="clip">{e.kind === "error" ? (e.scope ?? "error") : e.kind}</Chip>
              {e.guildName && <span className="text-dune text-xs">{e.guildName}</span>}
              {e.command && <span className="kbd">/{e.command}</span>}
              {e.track && <span className="text-dune text-xs truncate max-w-[240px]">{e.track}</span>}
              <span className="text-cream break-all">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
