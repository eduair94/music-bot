"use client";

/**
 * Adding the extra stages. Discord authorizes one bot per consent screen, so
 * "add the missing stages" is a guided run: Discord opens in a popup for the
 * first missing bot, the bill is re-read every few seconds, and when that bot
 * shows up the same popup moves on to the next one. A blocked or closed popup
 * falls back to a button or a plain link, and any bot can be skipped.
 *
 * Invite links are used exactly as GET /fleet returns them (they pre-select
 * this server).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, X } from "lucide-react";
import { DEMO_INVITE_EVENT, isDemo } from "@/lib/dash/demo";
import { useGuildLive } from "@/lib/dash/live";
import { stage } from "@/lib/dash/stages";
import type { Fleet, FleetInstance } from "@/lib/dash/types";
import { Button, cx } from "./ui";

/** How often the bill is re-read while a run waits on Discord. */
const POLL_MS = 2800;
/** A closed Discord window may still have added the bot: give the bill this long to say so. */
const CLOSED_GRACE_MS = 4000;
/** Stop polling after this long without a new stage (the tab was left open). */
const GIVE_UP_MS = 12 * 60_000;
const WINDOW_NAME = "bypass-invite";

/** Stages this server can add now: the application exists, it isn't in, and it's free (or the server is Premium). */
export function invitableStages(fleet: Fleet | null): FleetInstance[] {
  if (!fleet) return [];
  return fleet.instances
    .filter((i) => !i.inGuild && Boolean(i.applicationId) && Boolean(i.inviteUrl) && (!i.premium || fleet.limits.premiumActive))
    .sort((a, b) => a.instance - b.instance);
}

/** "Bypass 2", "Bypass 2 and Bypass 3", "Bypass 2, Bypass 3 and Bypass 4". */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ── The Discord window ──────────────────────────────────────────────────────

/** What the run needs from the popup; a real Window fits. */
interface InviteWindow {
  closed: boolean;
  close(): void;
  location: { href: string };
}

function fireDemoInvite(instance: number) {
  window.dispatchEvent(new CustomEvent(DEMO_INVITE_EVENT, { detail: { instance } }));
}

function popupFeatures(): string {
  const w = 500;
  const h = 780;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  return `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
}

/**
 * Open (or reuse) the Discord window on an invite. Call it from a click:
 * browsers block popups without one. null = the browser blocked it. The demo
 * server opens nothing and has the bot "join" a few seconds later instead
 * (`?popup=blocked` previews a blocked popup).
 */
export function openInviteWindow(url: string, instance: number, demo: boolean): InviteWindow | null {
  if (demo) {
    if (new URLSearchParams(window.location.search).get("popup") === "blocked") return null;
    fireDemoInvite(instance);
    return {
      closed: false,
      close() {
        this.closed = true;
      },
      location: { href: url },
    };
  }
  // No "noopener": the run keeps the handle to see the window close and to move it to the next bot.
  const win = window.open(url, WINDOW_NAME, popupFeatures());
  win?.focus();
  return win;
}

/** Point a still-open Discord window at the next invite (no click needed for a window we opened). */
function moveWindow(win: InviteWindow | null, inst: FleetInstance, demo: boolean): boolean {
  if (!win || win.closed) return false;
  try {
    win.location.href = inst.inviteUrl;
    if (demo) fireDemoInvite(inst.instance);
    return true;
  } catch {
    return false;
  }
}

// ── The run ─────────────────────────────────────────────────────────────────

/**
 * waiting: Discord is open on the current bot. ready: the previous bot is in
 * but the window is gone, so the next one needs a click. blocked: the popup
 * was blocked; a plain link takes over.
 */
type Phase = "waiting" | "ready" | "blocked";

interface Run {
  /** Instance numbers in the order they are added. */
  queue: number[];
  /** The bot being added now; null once every bot is in or skipped. */
  current: number | null;
  added: number[];
  skipped: number[];
  phase: Phase;
  /** The run has a handle on the Discord window (not the case after the plain-link fallback). */
  tracked: boolean;
  /** When the Discord window was seen closed, if it was. */
  closedAt: number | null;
  /** Last start, arrival or skip (for the give-up timer). */
  progressAt: number;
}

export interface StageInviteFlow {
  /** The demo server: no real Discord window opens. */
  demo: boolean;
  /** Stages that can be added right now, in order. */
  invitable: FleetInstance[];
  run: Run | null;
  now: number;
  instanceOf: (n: number) => FleetInstance | undefined;
  /** Start a run over every invitable stage, or only the given ones. Call from a click. */
  start: (only?: number[]) => void;
  /** Open Discord again on the current bot. Call from a click. */
  reopen: () => void;
  /** The plain-link fallback was followed: Discord is open in a tab the run can't see. */
  openedByLink: () => void;
  skip: () => void;
  stop: () => void;
  /** Start checking again after the run gave up. */
  resume: () => void;
}

export function useStageInvites(): StageInviteFlow {
  const { fleet, guildId, refresh } = useGuildLive();
  const demo = isDemo(guildId);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const win = useRef<InviteWindow | null>(null);

  const invitable = useMemo(() => invitableStages(fleet), [fleet]);
  const byId = useMemo(() => new Map((fleet?.instances ?? []).map((i) => [i.instance, i])), [fleet]);
  const instanceOf = useCallback((n: number) => byId.get(n), [byId]);

  /** Where a run goes once `current` is in or skipped. */
  const advance = useCallback(
    (r: Run): Run => {
      const handled = new Set([...r.added, ...r.skipped]);
      const next = r.queue.find((n) => !handled.has(n) && !byId.get(n)?.inGuild) ?? null;
      const t = Date.now();
      if (next === null) {
        win.current?.close();
        win.current = null;
        return { ...r, current: null, closedAt: null, progressAt: t };
      }
      const moved = moveWindow(win.current, byId.get(next)!, demo);
      if (!moved) win.current = null;
      return { ...r, current: next, phase: moved ? "waiting" : "ready", tracked: moved, closedAt: null, progressAt: t };
    },
    [byId, demo],
  );

  const start = useCallback(
    (only?: number[]) => {
      const ids = new Set(invitable.map((i) => i.instance));
      const queue = (only ?? [...ids]).filter((n) => ids.has(n));
      if (!queue.length) return;
      const first = byId.get(queue[0])!;
      const w = openInviteWindow(first.inviteUrl, first.instance, demo);
      win.current = w;
      setRun({ queue, current: queue[0], added: [], skipped: [], phase: w ? "waiting" : "blocked", tracked: Boolean(w), closedAt: null, progressAt: Date.now() });
    },
    [byId, demo, invitable],
  );

  const reopen = useCallback(() => {
    if (!run || run.current === null) return;
    const inst = byId.get(run.current);
    if (!inst) return;
    const w = openInviteWindow(inst.inviteUrl, inst.instance, demo);
    win.current = w;
    setRun({ ...run, phase: w ? "waiting" : "blocked", tracked: Boolean(w), closedAt: null, progressAt: Date.now() });
  }, [byId, demo, run]);

  const openedByLink = useCallback(() => {
    win.current = null;
    if (demo && run?.current) fireDemoInvite(run.current);
    setRun((r) => (r ? { ...r, phase: "waiting", tracked: false, closedAt: null, progressAt: Date.now() } : r));
  }, [demo, run]);

  const skip = useCallback(() => {
    if (!run || run.current === null) return;
    setRun(advance({ ...run, skipped: [...run.skipped, run.current] }));
  }, [advance, run]);

  const stop = useCallback(() => {
    // The Discord window is left alone: the member may be halfway through it.
    win.current = null;
    setRun(null);
  }, []);

  const resume = useCallback(() => {
    setRun((r) => (r ? { ...r, progressAt: Date.now() } : r));
    setNow(Date.now());
    void refresh();
  }, [refresh]);

  // A bot in the queue showed up (from this run, or added some other way): tick it off, move on.
  useEffect(() => {
    if (!run || run.current === null) return;
    const handled = new Set([...run.added, ...run.skipped]);
    const arrivedNow = run.queue.filter((n) => !handled.has(n) && byId.get(n)?.inGuild);
    if (!arrivedNow.length) return;
    const withAdded = { ...run, added: [...run.added, ...arrivedNow] };
    setRun(arrivedNow.includes(run.current) ? advance(withAdded) : withAdded);
  }, [advance, byId, run]);

  // While waiting on Discord: re-read the bill, notice the window closing, give up after a long quiet spell.
  const stalled = Boolean(run && run.current !== null && now - run.progressAt > GIVE_UP_MS);
  const active = Boolean(run && run.current !== null && !stalled);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setNow(Date.now());
      const w = win.current;
      if (w?.closed) {
        win.current = null;
        setRun((r) => (r && r.current !== null ? { ...r, tracked: false, closedAt: Date.now() } : r));
      }
      void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    // Coming back from the Discord tab (phones open one): check straight away.
    const onBack = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [active, refresh]);

  return { demo, invitable, run, now, instanceOf, start, reopen, openedByLink, skip, stop, resume };
}

// ── Banner ──────────────────────────────────────────────────────────────────

const dismissKey = (guildId: string) => `fest:stage-invites-dismissed:${guildId}`;

function readDismissed(guildId: string): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(dismissKey(guildId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/**
 * Above the bill: a prompt to add the free stages that aren't in the server
 * (managers only, dismissible per server until another stage goes missing),
 * replaced by the run while one is going. Right after Bypass itself was
 * added (`arrived`, or `?setup=1` from the server list) it asks outright.
 */
export function StageInvites({ flow }: { flow: StageInviteFlow }) {
  const { fleet, me, arrived, guildId } = useGuildLive();
  const [dismissed, setDismissed] = useState<number[] | null>(null);
  const [setup, setSetup] = useState(false);
  /** The "Bypass just arrived" prompt was answered (started or dismissed). */
  const [welcomed, setWelcomed] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed(guildId));
    setSetup(new URLSearchParams(window.location.search).get("setup") === "1");
  }, [guildId]);

  const missing = flow.invitable;

  const answerWelcome = () => {
    setWelcomed(true);
    if (!setup) return;
    setSetup(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("setup");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  /** Hide the prompt for the stages missing now; it comes back when another one goes missing. */
  const settle = () => {
    const ids = missing.map((i) => i.instance);
    try {
      window.localStorage.setItem(dismissKey(guildId), JSON.stringify(ids));
    } catch {
      /* storage blocked: hidden for this visit only */
    }
    setDismissed(ids);
    answerWelcome();
  };

  if (!fleet) return null;
  if (flow.run) {
    return (
      <InviteRun
        flow={flow}
        guildName={fleet.guild.name}
        onClose={() => {
          settle();
          flow.stop();
        }}
      />
    );
  }
  if (!me?.isAdmin || !missing.length || dismissed === null) return null;

  const welcome = (arrived || setup) && !welcomed;
  if (!welcome && missing.every((i) => dismissed.includes(i.instance))) return null;

  const names = missing.map((i) => i.name);
  const inServer = fleet.instances.filter((i) => i.inGuild).length;
  const channels = inServer + missing.length;
  const one = missing.length === 1;
  const title = welcome ? "Bypass is on the bill" : one ? "1 empty stage" : `${missing.length} empty stages`;
  const body = welcome
    ? `Add ${nameList(names)} too and ${fleet.guild.name} can play music in up to ${channels} voice channels at once. Discord adds one bot at a time; this walks you through ${one ? "it" : "each one"}.`
    : `${nameList(names)} ${one ? "isn't" : "aren't"} in ${fleet.guild.name} yet. Each extra Bypass plays in its own voice channel, at the same time as the others.`;

  return (
    <section
      aria-label="Missing stages"
      className="relative mx-4 mb-3 grid gap-x-6 gap-y-3 rounded-[4px] border-[1.5px] border-dashed border-ink/50 bg-paper/50 p-3.5 pr-11 sm:mx-6 sm:p-4 sm:pr-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    >
      <div className="min-w-0">
        <h2 className="bill text-[26px] sm:text-[28px]">{title}</h2>
        <p className="mt-1.5 max-w-[68ch] text-[14px] leading-snug text-ink-2">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ul className="flex flex-wrap gap-2" aria-label="Not in this server">
          {missing.map((i) => (
            <li key={i.instance}>
              <StageTicket inst={i} state="pending" compact />
            </li>
          ))}
        </ul>
        <Button
          variant="ink"
          onClick={() => {
            answerWelcome();
            flow.start();
          }}
          className="max-sm:w-full"
        >
          {one ? `Add ${missing[0].name}` : "Add the missing stages"} <ArrowUpRight size={15} aria-hidden />
        </Button>
      </div>
      <button
        type="button"
        onClick={settle}
        aria-label={welcome ? "Not now" : "Hide until another stage is missing"}
        title={welcome ? "Not now" : "Hide"}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <X size={16} aria-hidden />
      </button>
    </section>
  );
}

// ── The run panel ───────────────────────────────────────────────────────────

type TicketState = "pending" | "current" | "added" | "skipped";

/** One bot as a slip on the bill: dashed grey rule while it's missing, its stage colour printed in once it's in. */
function StageTicket({
  inst,
  state,
  compact,
  live = false,
}: {
  inst: FleetInstance;
  state: TicketState;
  compact?: boolean;
  /** The current bot's Discord window is open (otherwise it waits on a click). */
  live?: boolean;
}) {
  const s = stage(inst.instance);
  const added = state === "added";
  const label = { pending: "Not in yet", current: live ? "In Discord now" : "Up next", added: "In the server", skipped: "Skipped" }[state];
  return (
    <div
      aria-current={state === "current" ? "step" : undefined}
      className={cx(
        "min-w-0 overflow-hidden rounded-[3px] bg-stock",
        compact ? "w-[7.5rem] px-2.5 pb-2" : "px-3 pb-2.5",
        state === "current" ? "border-2 border-ink" : added ? "border border-transparent" : "border border-ink/25",
        state === "skipped" && "hatch",
      )}
    >
      <div
        aria-hidden
        className={cx(compact ? "-mx-2.5" : "-mx-3", "mb-2 h-1.5", added && "print-pull")}
        style={
          added
            ? { background: s.color }
            : { backgroundImage: "linear-gradient(to right, #8a8378 60%, transparent 0)", backgroundSize: "12px 6px" }
        }
      />
      <p className={cx("bill flex items-center gap-1.5 truncate", compact ? "text-[19px]" : "text-[24px]", !added && state !== "current" && "text-ink-3")}>
        <span className="truncate">{inst.name}</span>
        {added ? <Check size={compact ? 15 : 18} strokeWidth={3} aria-hidden className="shrink-0 text-ink" /> : null}
      </p>
      {compact ? null : (
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
          {state === "current" && live ? <span aria-hidden className="now-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ink" /> : null}
          {label}
        </p>
      )}
      {compact ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

function InviteRun({ flow, guildName, onClose }: { flow: StageInviteFlow; guildName: string; onClose: () => void }) {
  const run = flow.run!;
  const total = run.queue.length;
  const cur = run.current !== null ? flow.instanceOf(run.current) : undefined;
  const done = run.current === null;
  const stalled = !done && flow.now - run.progressAt > GIVE_UP_MS;
  const closed = !done && run.closedAt !== null && run.phase === "waiting";
  const checking = closed && flow.now - run.closedAt! < CLOSED_GRACE_MS;
  const lastAdded = run.added.length ? flow.instanceOf(run.added[run.added.length - 1]) : undefined;
  const step = done ? total : run.queue.indexOf(run.current!) + 1;

  const ticketState = (n: number): TicketState =>
    run.added.includes(n) ? "added" : run.skipped.includes(n) ? "skipped" : n === run.current ? "current" : "pending";

  const addedNames = run.added.map((n) => flow.instanceOf(n)?.name ?? `Bypass ${n}`);
  const skippedNames = run.skipped.map((n) => flow.instanceOf(n)?.name ?? `Bypass ${n}`);

  let status: string;
  if (done) {
    status = run.added.length
      ? `${nameList(addedNames)} ${run.added.length === 1 ? "is" : "are"} in ${guildName}. One /play still covers every stage.`
      : `Nothing was added to ${guildName}.`;
    if (run.skipped.length) status += ` ${nameList(skippedNames)} ${run.skipped.length === 1 ? "was" : "were"} skipped; invite ${run.skipped.length === 1 ? "it" : "them"} from the bill any time.`;
  } else if (stalled) {
    status = `Stopped checking for ${cur?.name} after a long wait. Check again once it's authorized, or skip it.`;
  } else if (run.phase === "blocked") {
    status = `Your browser blocked the Discord window. Open it with the button, authorize ${cur?.name}, and this page moves on by itself.`;
  } else if (run.phase === "ready") {
    status = `${lastAdded ? `${lastAdded.name} is in. ` : ""}Next: ${cur?.name}.`;
  } else if (checking) {
    status = `The Discord window closed. Checking whether ${cur?.name} is in…`;
  } else if (closed) {
    status = `The Discord window closed before ${cur?.name} arrived.`;
  } else {
    status = `Authorize ${cur?.name} in the Discord ${run.tracked ? "window" : "tab"}. This page moves on by itself once it's in ${guildName}.`;
  }

  return (
    <section aria-labelledby="stage-run-title" className="mx-4 mb-3 rounded-[4px] border-[1.5px] border-ink bg-paper/60 p-3.5 sm:mx-6 sm:p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="stage-run-title" className="bill text-[26px] sm:text-[28px]">
          {done
            ? run.added.length === total
              ? total === 1
                ? `${addedNames[0]} added`
                : "All stages added"
              : `${run.added.length} of ${total} added`
            : total === 1
              ? `Adding ${cur?.name}`
              : "Adding stages"}
        </h2>
        {!done && total > 1 ? (
          <p className="text-[14px] font-semibold text-ink-2">
            <span className="max-sm:hidden">{cur?.name} · </span>
            <span className="clock text-[17px] text-ink">{step}</span> of <span className="clock text-[17px] text-ink">{total}</span>
          </p>
        ) : null}
        <Button variant={done ? "ink" : "ghost"} size="sm" className="ml-auto" onClick={onClose}>
          {done ? (
            "Done"
          ) : (
            <>
              <X size={14} aria-hidden /> Stop
            </>
          )}
        </Button>
      </div>

      <ol className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Stages to add">
        {run.queue.map((n) => {
          const inst = flow.instanceOf(n);
          return inst ? (
            <li key={n} className="min-w-0 sm:w-[11rem]">
              <StageTicket inst={inst} state={ticketState(n)} live={run.phase === "waiting" && !closed && !stalled} />
            </li>
          ) : null;
        })}
      </ol>

      <p aria-live="polite" className="mt-3 max-w-[72ch] text-[14px] leading-snug text-ink-2">
        {status}
      </p>

      {!done && cur ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {run.phase === "blocked" ? (
            <a
              href={cur.inviteUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (flow.demo) e.preventDefault();
                flow.openedByLink();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-ink px-3 text-[13px] font-semibold text-stock transition-colors hover:bg-ink-2"
            >
              Open Discord for {cur.name} <ArrowUpRight size={14} aria-hidden />
            </a>
          ) : stalled ? (
            <Button size="sm" variant="ink" onClick={flow.resume}>
              Check again
            </Button>
          ) : run.phase === "ready" || (closed && !checking) ? (
            <Button size="sm" variant="ink" onClick={flow.reopen}>
              {run.phase === "ready" ? `Open Discord for ${cur.name}` : "Open Discord again"} <ArrowUpRight size={14} aria-hidden />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={flow.reopen}>
              Open Discord again <ArrowUpRight size={14} aria-hidden />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={flow.skip}>
            Skip {cur.name}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
