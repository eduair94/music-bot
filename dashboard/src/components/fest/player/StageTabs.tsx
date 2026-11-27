"use client";

/** One tab per bot in the server: its stage colour, name, and where it is playing. */
import { useEffect, useRef } from "react";
import { Headphones, Volume2 } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, Me } from "@/lib/dash/types";
import { cx } from "../ui";

export const PANEL_ID = "stage-panel";
export const tabId = (n: number) => `stage-tab-${n}`;

function where(i: FleetInstance): string {
  if (!i.inGuild) return "Not in this server";
  if (!i.online) return "Off air";
  if (i.playback?.isConnected) return i.playback.voiceChannelName ?? "Voice";
  return "Idle";
}

export function StageTabs({
  instances,
  selected,
  onSelect,
  me,
  className,
}: {
  instances: FleetInstance[];
  selected: number;
  onSelect: (n: number) => void;
  me: Me | null;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLButtonElement>());

  // Keep the selected stage in view when the row scrolls (phones).
  useEffect(() => {
    const el = refs.current.get(selected);
    const sc = list.current;
    if (!el || !sc) return;
    if (el.offsetLeft < sc.scrollLeft || el.offsetLeft + el.offsetWidth > sc.scrollLeft + sc.clientWidth) {
      sc.scrollTo({ left: Math.max(0, el.offsetLeft - 16) });
    }
  }, [selected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = instances.findIndex((i) => i.instance === selected);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % instances.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + instances.length) % instances.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = instances.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const n = instances[next].instance;
    onSelect(n);
    refs.current.get(n)?.focus();
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Stages"
      onKeyDown={onKeyDown}
      className={cx("relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6", className)}
    >
      {instances.map((i) => {
        const s = stage(i.instance);
        const active = i.instance === selected;
        const live = Boolean(i.playback?.isConnected);
        const yours = Boolean(live && me?.voiceChannelId && i.playback?.voiceChannelId === me.voiceChannelId);
        return (
          <button
            key={i.instance}
            ref={(el) => {
              if (el) refs.current.set(i.instance, el);
              else refs.current.delete(i.instance);
            }}
            type="button"
            role="tab"
            id={tabId(i.instance)}
            aria-selected={active}
            aria-controls={PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(i.instance)}
            className={cx(
              "flex min-w-[9.75rem] shrink-0 items-center gap-2.5 rounded-[4px] border px-3 py-2 text-left transition-colors duration-150",
              active ? "border-ink bg-paper" : "border-rule hover:border-ink/60 hover:bg-paper/50",
            )}
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-[2px]"
              style={i.inGuild ? { background: s.color } : { border: "1.5px dashed #8a8378" }}
            />
            <span className="min-w-0">
              <span className={cx("bill block whitespace-nowrap text-[21px] leading-none", !i.inGuild && "text-ink-3")}>{i.name}</span>
              <span className={cx("mt-1 flex items-center gap-1 text-[12.5px] font-semibold", active ? "text-ink-2" : "text-ink-3")}>
                {live ? <Volume2 size={13} className="shrink-0" style={{ color: s.color === "#f5b700" ? "#9a7300" : s.color }} aria-hidden /> : null}
                <span className="max-w-[9rem] truncate">{where(i)}</span>
                {yours ? (
                  <>
                    <Headphones size={13} className="ml-0.5 shrink-0 text-ink" aria-hidden />
                    <span className="sr-only">, you are in this channel</span>
                  </>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
