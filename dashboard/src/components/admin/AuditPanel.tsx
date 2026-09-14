"use client";

import { relTime } from "@/lib/admin/format";
import type { AuditEntry } from "@/types/admin";
import { Chip, Panel, Unavailable } from "./ui";

const cell = "px-3 py-2 border-b border-line/60";

export function AuditPanel({ entries, error }: { entries: AuditEntry[]; error: string | null }) {
  if (error) return <Unavailable what={`Audit log (${error})`} />;
  return (
    <Panel className="p-0 overflow-hidden">
      {entries.length === 0 ? (
        <p className="p-4 text-xs text-dust font-mono">No owner actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left">
                {["When", "Actor", "Action", "Target", "Outcome"].map((h) => (
                  <th key={h} className="console-label font-normal px-3 py-2 border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.ts}-${i}`}>
                  <td className={`${cell} font-mono text-xs text-dune whitespace-nowrap`} title={e.ts}>
                    {relTime(e.ts)}
                  </td>
                  <td className={`${cell} text-cream`}>{e.actorName}</td>
                  <td className={cell}>
                    <span className="kbd">{e.action}</span>
                  </td>
                  <td className={`${cell} text-dune`}>
                    {e.targetName || e.targetGuildId || "—"}
                    {e.targetName && e.targetGuildId && (
                      <span className="font-mono text-[11px] text-dust"> · {e.targetGuildId}</span>
                    )}
                  </td>
                  <td className={cell}>
                    <Chip tone={e.ok ? "signal" : "clip"}>{e.ok ? "ok" : "failed"}</Chip>
                    <span className="ml-2 text-xs text-dune">{e.ok ? e.result : e.error}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
