"use client";

/**
 * The stage's running order: what plays next and at what time on the wall
 * clock, like the sets on the bill. Drag to reorder, or use each row's menu
 * (also the keyboard and touch path). New songs are printed onto the list.
 */
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, ListPlus, ListX, MoreHorizontal, Play, Plus, Shuffle, Trash2 } from "lucide-react";
import { useTicker } from "@/lib/dash/live";
import { fmtClock, fmtMs, livePosition, trackMs } from "@/lib/dash/format";
import type { Me, PlaybackState, Track } from "@/lib/dash/types";
import { Button, cx, Menu, MenuItem } from "../ui";
import { ConfirmInline, gateOf, lockProps, openAdd, trackKey, useControl, usePending, useReducedMotion } from "./shared";

const EASE_OUT = "cubic-bezier(0.16,1,0.3,1)";
/** Row print: 240 ms, staggered by at most 60 ms, so a batch lands within 300 ms. */
const ROW_MS = 240;
const ROW_STEP = 12;
const ROW_MAX_DELAY = 60;

const COLS =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_3.25rem_2rem] md:grid-cols-[1rem_1.75rem_minmax(0,1fr)_minmax(0,7.5rem)_3.5rem_3.5rem_2rem] items-center gap-x-2.5 md:gap-x-3";

export function QueueList({ instance, p, me }: { instance: number; p: PlaybackState; me: Me | null }) {
  const control = useControl(instance);
  const now = useTicker(1000);
  const reduce = useReducedMotion();
  const queueGate = gateOf(me, "queue");
  const skipGate = gateOf(me, "skip");
  const playGate = gateOf(me, "play");

  const [queue, setQueue, clearQueue] = usePending<Track[]>(p.queue);
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);

  // Stable keys (duplicates get an occurrence suffix) so a reorder is a move, not an arrival.
  const keyed = useMemo(() => {
    const seen = new Map<string, number>();
    return queue.map((t) => {
      const k = trackKey(t);
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return { t, key: `${k}#${n}` };
    });
  }, [queue]);

  // Arrival delays, fixed per row the first time it is seen.
  const delays = useRef(new Map<string, number>());
  const settled = useRef(new Set<string>());
  let batch = 0;
  for (const { key } of keyed) {
    if (!delays.current.has(key)) delays.current.set(key, Math.min(batch++ * ROW_STEP, ROW_MAX_DELAY));
  }

  // Wall-clock start of every queued song.
  const remaining = p.currentTrack ? Math.max(0, trackMs(p.currentTrack) - livePosition(p, now)) : 0;
  let cursor = now + remaining;
  const rows = keyed.map(({ t, key }, i) => {
    const at = cursor;
    cursor += trackMs(t);
    return { t, key, at, pos: i + 1 };
  });
  const total = cursor - (now + remaining);
  const truncated = p.queueSize > queue.length && queue.length > 0;

  const apply = async (next: Track[], command: Parameters<typeof control>[0], params: Record<string, unknown>, fail: string) => {
    setQueue(next);
    const r = await control(command, params, fail);
    if (!r.success) clearQueue();
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 1 || to > queue.length) return;
    const next = [...queue];
    const [t] = next.splice(from - 1, 1);
    next.splice(to - 1, 0, t);
    void apply(next, "move", { from, to }, "Couldn't move that song");
  };
  const remove = (position: number) =>
    void apply(queue.filter((_, i) => i !== position - 1), "remove", { position }, "Couldn't remove that song");

  const loopNote =
    p.loopMode === "track" ? "the current song is on repeat" : p.loopMode === "queue" ? "the queue loops" : null;

  return (
    <section aria-labelledby="queue-title">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <h2 id="queue-title" className="bill text-[36px] leading-[0.85] sm:text-[40px]">
          Queue
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {queue.length > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                {...lockProps(queueGate, queue.length < 2 && "Shuffle needs two or more songs")}
                className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-paper/60 aria-disabled:hover:text-ink"
                onClick={() => {
                  if (queueGate.ok && queue.length > 1) void control("shuffle", {}, "Couldn't shuffle");
                }}
              >
                <Shuffle size={14} /> Shuffle
              </Button>
              <ConfirmInline
                label="Clear"
                icon={<ListX size={14} />}
                question={`Clear ${queue.length} ${queue.length === 1 ? "song" : "songs"}?`}
                confirmLabel="Yes, clear"
                gate={queueGate}
                onConfirm={() => apply([], "clear", {}, "Couldn't clear the queue")}
              />
            </>
          ) : null}
          <Button
            variant="ink"
            size="sm"
            {...lockProps(playGate)}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-55"
            onClick={() => playGate.ok && openAdd(instance)}
          >
            <Plus size={14} /> Add songs
          </Button>
        </div>
      </div>

      {queue.length === 0 ? (
        <EmptyQueue instance={instance} autoplay={Boolean(p.autoplay)} loopNote={loopNote} gateOk={playGate.ok} />
      ) : (
        <>
          <div aria-hidden className={cx(COLS, "mt-4 border-b border-ink pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3")}>
            <span className="hidden md:block" />
            <span className="text-right">#</span>
            <span>Song</span>
            <span className="hidden text-right md:block">Requested by</span>
            <span className="text-right">Starts</span>
            <span className="hidden text-right md:block">Length</span>
            <span />
          </div>
          <ol aria-label={`Queue, ${queue.length} songs`}>
            {rows.map(({ t, key, at, pos }) => {
              const dragging = drag?.from === pos;
              const target = drag && drag.over === pos && drag.from !== pos ? (drag.from > pos ? "before" : "after") : null;
              const animate = !reduce && !settled.current.has(key);
              return (
                <li
                  key={key}
                  draggable={queueGate.ok}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(pos));
                    setDrag({ from: pos, over: null });
                  }}
                  onDragOver={(e) => {
                    if (!drag) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (drag.over !== pos) setDrag({ ...drag, over: pos });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag && drag.from !== pos) move(drag.from, pos);
                    setDrag(null);
                  }}
                  onDragEnd={() => setDrag(null)}
                  onAnimationEnd={(e) => {
                    if (e.target === e.currentTarget) settled.current.add(key);
                  }}
                  className={cx(
                    COLS,
                    "group relative border-b border-rule py-2.5 transition-[opacity,background-color] duration-150",
                    queueGate.ok && "cursor-grab active:cursor-grabbing",
                    dragging ? "opacity-35" : "hover:bg-paper/70",
                  )}
                  style={animate ? { animation: `print-pull ${ROW_MS}ms ${EASE_OUT} ${delays.current.get(key) ?? 0}ms backwards` } : undefined}
                >
                  {target ? (
                    <span aria-hidden className={cx("absolute inset-x-0 z-10 h-[3px] bg-ink", target === "before" ? "-top-[2px]" : "-bottom-[2px]")} />
                  ) : null}
                  <span aria-hidden className={cx("hidden text-ink-3 md:block", queueGate.ok ? "opacity-0 transition-opacity group-hover:opacity-100" : "opacity-0")}>
                    <GripVertical size={16} />
                  </span>
                  <span className="clock text-right text-[16px] text-ink-3">{pos}</span>
                  <div className="min-w-0">
                    <p className="bill truncate text-[19px] leading-[1.05]">{t.title}</p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-2">
                      {t.author}
                      <span className="md:hidden">
                        {" · "}
                        <span className="tabular-nums">{t.duration || fmtMs(trackMs(t))}</span>
                        {t.requestedBy ? ` · ${t.requestedBy.username}` : ""}
                      </span>
                    </p>
                  </div>
                  <span className="hidden truncate text-right text-[13px] text-ink-2 md:block">{t.requestedBy?.username ?? ""}</span>
                  <span className="clock text-right text-[16px]" title={`Starts at ${fmtClock(at)}`}>
                    {fmtClock(at)}
                  </span>
                  <span className="clock hidden text-right text-[16px] text-ink-3 md:block">{t.duration || fmtMs(trackMs(t))}</span>
                  <RowMenu
                    track={t}
                    position={pos}
                    last={pos === queue.length}
                    queueOk={queueGate.ok}
                    skipOk={skipGate.ok}
                    onPlayNow={() => void control("skipto", { position: pos }, "Couldn't jump to that song")}
                    onMove={move}
                    onRemove={() => remove(pos)}
                  />
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[14px] text-ink-2">
            <span>
              {p.queueSize > queue.length ? p.queueSize : queue.length} {queue.length === 1 && !truncated ? "song" : "songs"}
            </span>
            <span aria-hidden>·</span>
            <span className="clock text-[16px] text-ink">
              {fmtMs(total)}
              {truncated ? "+" : ""}
            </span>
            <span aria-hidden>·</span>
            {loopNote ? (
              <span>{loopNote.charAt(0).toUpperCase() + loopNote.slice(1)}</span>
            ) : (
              <span>
                {truncated ? "ends after" : "ends at"} <span className="clock text-[16px] text-ink">{fmtClock(cursor)}</span>
                {p.autoplay ? ", then autoplay" : ""}
              </span>
            )}
          </p>
          {truncated ? <p className="mt-1 text-[13px] text-ink-3">Showing the first {queue.length}.</p> : null}
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {drag?.over ? `Drop to move song ${drag.from} to position ${drag.over}` : ""}
      </span>
    </section>
  );
}

function RowMenu({
  track,
  position,
  last,
  queueOk,
  skipOk,
  onPlayNow,
  onMove,
  onRemove,
}: {
  track: Track;
  position: number;
  last: boolean;
  queueOk: boolean;
  skipOk: boolean;
  onPlayNow: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="justify-self-end" onDragStart={(e) => e.stopPropagation()}>
      <Menu
        label={`Actions for ${track.title}`}
        align="right"
        trigger={({ open, toggle, id }) => (
          <button
            type="button"
            onClick={toggle}
            draggable={false}
            aria-expanded={open}
            aria-controls={id}
            aria-haspopup="menu"
            aria-label={`Actions for ${track.title}`}
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-[4px] transition-colors hover:bg-ink/[0.08]",
              open ? "bg-ink text-stock hover:bg-ink" : "text-ink-2",
            )}
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem disabled={!skipOk} onSelect={() => { close(); onPlayNow(); }}>
              <Play size={15} /> Play now
            </MenuItem>
            <MenuItem disabled={!queueOk || position === 1} onSelect={() => { close(); onMove(position, 1); }}>
              <ListPlus size={15} /> Play next
            </MenuItem>
            <MenuItem disabled={!queueOk || position === 1} onSelect={() => { close(); onMove(position, position - 1); }}>
              <ArrowUp size={15} /> Move up
            </MenuItem>
            <MenuItem disabled={!queueOk || last} onSelect={() => { close(); onMove(position, position + 1); }}>
              <ArrowDown size={15} /> Move down
            </MenuItem>
            <div className="my-1 border-t border-rule" />
            <MenuItem danger disabled={!queueOk} onSelect={() => { close(); onRemove(); }}>
              <Trash2 size={15} /> Remove from queue
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}

function EmptyQueue({ instance, autoplay, loopNote, gateOk }: { instance: number; autoplay: boolean; loopNote: string | null; gateOk: boolean }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-5 rounded-[4px] border-[1.5px] border-dashed border-ink/40 px-6 py-7 text-center sm:flex-row sm:text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dash/setlist.webp" alt="" width={640} height={640} className="h-32 w-32 shrink-0 -rotate-3 object-contain" />
      <div>
        <p className="bill text-[30px]">Nothing up next</p>
        <p className="mt-1.5 max-w-[42ch] text-[14px] leading-snug text-ink-2">
          {loopNote === "the current song is on repeat"
            ? "The current song is on repeat until loop is turned off."
            : loopNote
              ? "Loop is on, so this song comes round again."
              : autoplay
              ? "Autoplay picks a similar song when this one ends."
              : "The stage goes quiet when this song ends."}
        </p>
        <Button className="mt-4" variant="ink" size="sm" disabled={!gateOk} onClick={() => openAdd(instance)}>
          <Plus size={14} /> Add songs
        </Button>
      </div>
    </div>
  );
}
