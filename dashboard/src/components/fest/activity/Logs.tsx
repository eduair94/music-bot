"use client";

/**
 * Recently played (from play history, with the bot that played each song)
 * and the log of changes made from the dashboard (settings, permissions,
 * stage bindings).
 */
import { useState } from "react";
import { fmtAgo } from "@/lib/dash/format";
import type { AuditItem, HistoryItem } from "@/lib/dash/types";
import { Button } from "../ui";
import { StageChip } from "./stages";

const ROWS = 10;

function exact(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** `showBots` adds the bot that played each song (off when the server has one bot). */
export function RecentTable({ items, now, showBots = false }: { items: HistoryItem[]; now: number; showBots?: boolean }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-6 text-[14px] text-ink-2">Nothing has played here yet.</p>;
  const shown = all ? items : items.slice(0, ROWS);
  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[20rem] border-collapse text-left text-[14px] sm:min-w-[36rem]">
          <thead>
            <tr className="border-b border-ink text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              <th scope="col" className="w-20 py-2 pr-3 font-semibold sm:w-24">
                When
              </th>
              {showBots ? (
                <th scope="col" className="hidden w-[6.5rem] py-2 pr-3 font-semibold sm:table-cell">
                  Stage
                </th>
              ) : null}
              <th scope="col" className="py-2 pr-3 font-semibold">
                Song
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">
                Artist
              </th>
              <th scope="col" className="w-28 py-2 font-semibold sm:w-36">
                Requested by
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((h, i) => (
              <tr key={`${h.playedAt}|${i}`} className="border-b border-rule">
                <td className="clock whitespace-nowrap py-2.5 pr-3 text-[14px] text-ink-2">
                  <time dateTime={h.playedAt} title={exact(h.playedAt)}>
                    {fmtAgo(h.playedAt, now)}
                  </time>
                </td>
                {showBots ? (
                  <td className="hidden py-2.5 pr-3 sm:table-cell">
                    <StageChip instance={h.instance || 1} />
                  </td>
                ) : null}
                <td className="max-w-[10rem] py-2.5 pr-3 sm:max-w-[18rem]">
                  {h.url && h.url !== "#" && /^https?:\/\//.test(h.url) ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-semibold hover:underline hover:underline-offset-2"
                    >
                      {h.title}
                    </a>
                  ) : (
                    <span className="block truncate font-semibold">{h.title}</span>
                  )}
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2 sm:hidden">
                    {showBots ? <StageChip instance={h.instance || 1} /> : null}
                    <span className="truncate">{h.author}</span>
                  </span>
                </td>
                <td className="hidden max-w-[12rem] truncate py-2.5 pr-3 text-ink-2 sm:table-cell">{h.author}</td>
                <td className="py-2.5">
                  {h.autoplay || !h.requestedBy ? (
                    <span className="dashed inline-flex rounded-[3px] px-1.5 py-px text-[12px] font-semibold text-ink-2">Autoplay</span>
                  ) : (
                    <span className="font-semibold">{h.requestedBy.username}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > ROWS ? (
        <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </Button>
      ) : null}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  settings: "Settings",
  permissions: "Permissions",
  binding: "Stages",
  bindings: "Stages",
};

export function ChangeLog({ items, now }: { items: AuditItem[]; now: number }) {
  if (!items.length) {
    return (
      <p className="py-6 text-[14px] leading-relaxed text-ink-2">
        No changes from the dashboard yet. Edits to settings, permissions and stage home channels are listed here.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-rule">
      {items.slice(0, 20).map((a, i) => (
        <li key={`${a.ts}|${i}`} className="py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[14px]">
              <span className="font-semibold">{a.username}</span>
              <span className="ml-2 inline-flex rounded-[3px] border border-ink/30 px-1.5 text-[11.5px] font-semibold text-ink-2">
                {ACTION_LABEL[a.action] ?? a.action}
              </span>
            </p>
            <time dateTime={a.ts} title={exact(a.ts)} className="clock shrink-0 text-[13px] text-ink-3">
              {fmtAgo(a.ts, now)}
            </time>
          </div>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">{a.summary}</p>
        </li>
      ))}
    </ol>
  );
}
