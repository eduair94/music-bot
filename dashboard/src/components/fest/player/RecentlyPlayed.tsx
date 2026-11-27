"use client";

/** The last songs played in the server, each one tap away from playing again on this stage. */
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useHistory } from "@/lib/dash/hooks";
import { fmtAgo } from "@/lib/dash/format";
import { stage } from "@/lib/dash/stages";
import type { HistoryItem, Me } from "@/lib/dash/types";
import { useToast } from "../Toast";
import { Button } from "../ui";
import { gateOf, lockProps, playQuery, useControl } from "./shared";

export function RecentlyPlayed({
  instance,
  name,
  me,
  voiceChannelId,
  className,
}: {
  instance: number;
  name: string;
  me: Me | null;
  /** Where an idle stage should open when a song is replayed. */
  voiceChannelId?: string | null;
  className?: string;
}) {
  const { data, error, loading, reload } = useHistory();
  const control = useControl(instance);
  const toast = useToast();
  const gate = gateOf(me, "play");
  const [busy, setBusy] = useState<number | null>(null);
  const items = (data?.items ?? []).slice(0, 8);

  const again = async (it: HistoryItem, idx: number) => {
    if (!gate.ok) return;
    setBusy(idx);
    const r = await control(
      "play",
      { query: playQuery(it), ...(voiceChannelId ? { voiceChannelId } : {}) },
      "Couldn't play that again",
    );
    setBusy(null);
    if (r.success) toast.push({ title: `${it.title} → ${name}`, detail: r.message, color: stage(instance).color });
  };

  return (
    <section aria-labelledby="recent-title" className={className}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="recent-title" className="bill text-[28px] sm:text-[32px]">
          Recently played
        </h2>
        <span className="text-[13px] text-ink-3">on every stage</span>
      </div>

      {error && !data ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-[14px] text-ink-2">
          <span>Couldn&apos;t load recent songs. {error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : loading && !data ? (
        <ul aria-busy="true" aria-label="Loading recent songs" className="mt-3 border-t border-rule">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-rule py-3">
              <span className="h-3.5 w-1/2 rounded-[2px] bg-ink/[0.07]" />
              <span className="ml-auto h-3.5 w-16 rounded-[2px] bg-ink/[0.07]" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="mt-3 border-t border-rule pt-3 text-[14px] text-ink-2">No songs played in this server yet.</p>
      ) : (
        <ul className="mt-3 border-t border-rule">
          {items.map((it, idx) => (
            <li key={`${it.playedAt}-${idx}`} className="flex items-center gap-3 border-b border-rule py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{it.title}</p>
                <p className="truncate text-[13px] text-ink-2">
                  {it.author}
                  {it.autoplay ? " · autoplay" : it.requestedBy ? ` · ${it.requestedBy.username}` : ""}
                </p>
              </div>
              <time dateTime={it.playedAt} className="hidden shrink-0 text-[13px] text-ink-3 sm:block">
                {fmtAgo(it.playedAt)}
              </time>
              <Button
                size="sm"
                variant="outline"
                busy={busy === idx}
                {...lockProps(gate)}
                aria-label={`Play ${it.title} again on ${name}`}
                className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-paper/60 aria-disabled:hover:text-ink"
                onClick={() => void again(it, idx)}
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Play again</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
