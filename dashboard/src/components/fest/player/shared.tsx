"use client";

/**
 * Player plumbing shared by the deck, queue and history: permission gates,
 * a command sender that reports failures as toasts, short-lived optimistic
 * values, reduced-motion detection, and the inline "are you sure" control.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useGuildLive } from "@/lib/dash/live";
import type { CommandName, CommandResult, Group, Me, Track } from "@/lib/dash/types";
import { useToast } from "../Toast";
import { Button, cx } from "../ui";

export const LOCK_NOTE_ID = "player-locks";

export type PlayerGroup = "play" | "playback" | "skip" | "queue" | "volume" | "effects" | "loop_autoplay" | "stop_leave";

export const PLAYER_GROUPS: PlayerGroup[] = ["playback", "skip", "queue", "volume", "effects", "loop_autoplay", "stop_leave", "play"];

export const GROUP_LABEL: Record<PlayerGroup, string> = {
  play: "Adding songs",
  playback: "Pause and seek",
  skip: "Skip",
  queue: "Queue changes",
  volume: "Volume",
  effects: "Effects",
  loop_autoplay: "Loop and autoplay",
  stop_leave: "Stop",
};

export interface Gate {
  ok: boolean;
  reason?: string;
}

export const OPEN: Gate = { ok: true };

/** What the member may do, from /me. Unknown yet = allowed; the server still decides. */
export function gateOf(me: Me | null, group: Group): Gate {
  const g = me?.groups?.[group];
  if (!g || g.ok) return OPEN;
  return { ok: false, reason: g.reason || "Your roles don't allow this on this server." };
}

/** Props that mark a standard Button as locked without hiding why (tooltip + note). */
export function lockProps(gate: Gate, unavailable?: string | false | null) {
  const off = !gate.ok || Boolean(unavailable);
  return {
    "aria-disabled": off || undefined,
    "aria-describedby": gate.ok ? undefined : LOCK_NOTE_ID,
    title: gate.ok ? (unavailable || undefined) : gate.reason,
  } as const;
}

export function openAdd(instance?: number) {
  window.dispatchEvent(new CustomEvent("fest:add-song", { detail: { instance } }));
}

export function trackKey(t: Pick<Track, "url" | "title">): string {
  return `${t.url}|${t.title}`;
}

/** What to send to `play` to hear a song again: its link, else a search. */
export function playQuery(t: { url: string; title: string; author: string }): string {
  return /^https?:\/\//i.test(t.url) ? t.url : `${t.title} ${t.author}`;
}

const SOURCES: Record<string, string> = {
  youtube: "YouTube",
  youtube_music: "YouTube Music",
  youtubemusic: "YouTube Music",
  ytmusic: "YouTube Music",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music",
  applemusic: "Apple Music",
  deezer: "Deezer",
  attachment: "Audio file",
  file: "Audio file",
  arbitrary: "Link",
};

export function sourceLabel(source?: string): string | null {
  if (!source) return null;
  return SOURCES[source.toLowerCase()] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

/** Send a command to one stage; a refusal becomes an error toast carrying the reason. */
export function useControl(instance: number) {
  const { send } = useGuildLive();
  const toast = useToast();
  return useCallback(
    async (command: CommandName, params: Record<string, unknown> = {}, failTitle = "That didn't work"): Promise<CommandResult> => {
      let r: CommandResult;
      try {
        r = await send(instance, command, params);
      } catch (e) {
        r = { success: false, error: e instanceof Error ? e.message : "Network error" };
      }
      if (!r.success) {
        toast.push({
          tone: "error",
          title: failTitle,
          detail: r.reason || r.error || r.message || "The bot didn't take the command. Try again in a moment.",
        });
      }
      return r;
    },
    [send, instance, toast],
  );
}

/**
 * A local value shown until the server reports a different one (or `ttl`
 * passes), so controls answer at once while the bot catches up.
 */
export function usePending<T>(server: T, ttl = 5000): [T, (v: T) => void, () => void] {
  const sig = JSON.stringify(server ?? null);
  const [pending, setPending] = useState<{ value: T; base: string } | null>(null);

  useEffect(() => {
    if (pending && pending.base !== sig) setPending(null);
  }, [sig, pending]);

  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), ttl);
    return () => clearTimeout(id);
  }, [pending, ttl]);

  const set = useCallback((value: T) => setPending({ value, base: sig }), [sig]);
  const clear = useCallback(() => setPending(null), []);
  return [pending ? pending.value : server, set, clear];
}

const RM = "(prefers-reduced-motion: reduce)";
const subscribeRM = (cb: () => void) => {
  const m = window.matchMedia(RM);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia(RM).matches,
    () => false,
  );
}

interface CtlProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled"> {
  label: string;
  gate?: Gate;
  /** Why the control does nothing right now (e.g. nothing to shuffle). */
  unavailable?: string | false | null;
  onPress: () => void;
  /** Square size in px; null for a wide button sized by its content. */
  size?: number | null;
}

/**
 * A transport control. Locked controls stay focusable and keep their
 * tooltip, so anyone can find out why they can't use them.
 */
export function Ctl({ label, gate = OPEN, unavailable, onPress, size = 44, className, style, children, ...rest }: CtlProps) {
  const off = !gate.ok || Boolean(unavailable);
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={off || undefined}
      aria-describedby={gate.ok ? undefined : LOCK_NOTE_ID}
      title={!gate.ok ? gate.reason : unavailable || label}
      onClick={() => {
        if (!off) onPress();
      }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[4px] transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.94]",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:active:scale-100",
        className,
      )}
      style={size ? { width: size, height: size, ...style } : style}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Destructive action confirmed in place: the button turns into
 * "Question? Yes / Cancel" instead of opening a modal.
 */
export function ConfirmInline({
  label,
  icon,
  question,
  confirmLabel,
  onConfirm,
  gate = OPEN,
  unavailable,
  size = "sm",
}: {
  label: string;
  icon?: ReactNode;
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  gate?: Gate;
  unavailable?: string | false | null;
  size?: "sm" | "md";
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);

  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (restore.current) {
      restore.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  // An unanswered question folds back after a while.
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(false), 8000);
    return () => clearTimeout(id);
  }, [asking]);

  const off = !gate.ok || Boolean(unavailable);

  if (!asking) {
    return (
      <Button
        ref={triggerRef}
        variant="outline"
        size={size}
        {...lockProps(gate, unavailable)}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-paper/60 aria-disabled:hover:text-ink"
        onClick={() => {
          if (!off) setAsking(true);
        }}
      >
        {icon}
        {label}
      </Button>
    );
  }

  const cancel = () => {
    restore.current = true;
    setAsking(false);
  };

  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          cancel();
        }
      }}
      className="flex items-center gap-1.5"
    >
      <span className="whitespace-nowrap pr-1 text-[13.5px] font-semibold text-ink">{question}</span>
      <Button
        variant="danger"
        size={size}
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button ref={cancelRef} variant="ghost" size={size} onClick={cancel}>
        Cancel
      </Button>
    </div>
  );
}
