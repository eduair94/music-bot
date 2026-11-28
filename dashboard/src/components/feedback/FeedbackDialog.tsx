"use client";

/**
 * The feedback dialog (lazy chunk, see FeedbackTrigger). One component for
 * both worlds: `skin="studio"` on the dark landing, `skin="fest"` inside the
 * festival-bill dashboard. Native <dialog> with showModal(): the page behind
 * is inert, Esc closes, focus returns to the trigger on close.
 */
import { track } from "@/lib/analytics/track";
import {
  DIALOG_KINDS,
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  type DialogKind,
} from "@/lib/feedback/validate";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { SUPPORT_INVITE_URL } from "../../../../shared/links";
import type { FeedbackSkin } from "./FeedbackTrigger";

const COPY = {
  title: "Send feedback",
  lede: "Ideas, bugs and kind words go straight to the people who build Bypass.",
  kindLegend: "What is it?",
  kinds: { idea: "Idea", bug: "Bug", praise: "Praise", other: "Other" } satisfies Record<DialogKind, string>,
  messageLabel: {
    idea: "Your idea",
    bug: "What went wrong?",
    praise: "What do you like?",
    other: "Your message",
  } satisfies Record<DialogKind, string>,
  messagePlaceholder: {
    idea: "What would make Bypass better for your server?",
    bug: "What did you do, what happened, and what did you expect? The command or page helps.",
    praise: "A feature, a moment, anything.",
    other: "Questions, complaints, anything else.",
  } satisfies Record<DialogKind, string>,
  contactLabel: "Reply to (optional)",
  contactHint: "Discord username or email, if you want a reply",
  quoteLabel: "You can quote this on the Bypass website, without my username",
  submit: "Send feedback",
  sending: "Sending…",
  cancel: "Cancel",
  close: "Close",
  tooShort: `Write at least ${FEEDBACK_MESSAGE_MIN} characters.`,
  networkError: "Couldn't send that. Check your connection and try again.",
  doneTitle: "Thanks, it's in",
  doneBody: "We read every message. If you want to talk it through or need help now, the support server is the quickest way to reach us.",
  doneLink: "Join the support server",
  doneClose: "Done",
  newTab: " (opens in a new tab)",
};

interface Skin {
  dialog: string;
  title: string;
  lede: string;
  label: string;
  hint: string;
  segment: string;
  segmentOption: string;
  field: string;
  counter: string;
  error: string;
  primary: string;
  secondary: string;
  link: string;
  closeButton: string;
  rule: string;
}

const SKINS: Record<FeedbackSkin, Skin> = {
  studio: {
    dialog:
      "m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-line-strong bg-panel p-0 text-cream font-sans shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop:bg-[rgb(12_10_9/0.75)]",
    title: "font-display text-xl font-semibold tracking-tight text-cream",
    lede: "mt-1 text-sm leading-relaxed text-dune",
    label: "console-label block",
    hint: "mt-1 text-xs text-dust",
    segment: "mt-2 grid grid-cols-4 gap-1 rounded-lg border border-line bg-coal p-1",
    segmentOption:
      "cursor-pointer rounded-md px-2 py-1.5 text-center text-sm text-dune transition-colors hover:text-cream has-[:checked]:bg-panel-raised has-[:checked]:text-cream has-[:checked]:shadow-[inset_0_0_0_1px_var(--line-strong)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber",
    field:
      "mt-2 w-full rounded-lg border border-line bg-coal px-3 py-2 text-sm text-cream placeholder:text-dust transition-colors focus:border-line-strong",
    counter: "font-mono text-[11px] text-dust",
    error: "text-sm text-clip",
    primary:
      "inline-flex h-10 items-center justify-center rounded-lg bg-amber px-4 text-sm font-semibold text-coal transition-colors hover:bg-amber-hot disabled:cursor-not-allowed disabled:opacity-60",
    secondary: "inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm text-dune transition-colors hover:text-cream",
    link: "text-amber underline underline-offset-2 hover:text-amber-hot",
    closeButton: "rounded-md p-1.5 text-dust transition-colors hover:text-cream",
    rule: "border-line",
  },
  fest: {
    dialog:
      "m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[4px] border-2 border-ink bg-paper p-0 text-ink shadow-[0_24px_60px_-20px_rgb(21_21_21/0.55)] backdrop:bg-[rgb(21_21_21/0.45)]",
    title: "bill text-[34px]",
    lede: "mt-1.5 text-sm leading-relaxed text-ink-2",
    label: "block text-sm font-semibold text-ink",
    hint: "mt-1 text-xs text-ink-3",
    segment: "mt-2 grid grid-cols-4 overflow-hidden rounded-[4px] border border-ink",
    segmentOption:
      "cursor-pointer border-l border-ink px-2 py-2 text-center text-sm font-semibold text-ink transition-colors first:border-l-0 hover:bg-ink/[0.06] has-[:checked]:bg-ink has-[:checked]:text-stock has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-stock",
    field:
      "mt-2 w-full rounded-[4px] border border-ink/30 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-ink focus:outline-none",
    counter: "clock text-xs text-ink-3",
    error: "text-sm font-semibold text-now",
    primary:
      "inline-flex h-10 items-center justify-center rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-55",
    secondary: "inline-flex h-10 items-center justify-center rounded-[4px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.06]",
    link: "font-semibold text-ink underline underline-offset-2",
    closeButton: "rounded-[4px] p-1.5 text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink",
    rule: "border-rule",
  },
};

type Phase = "form" | "sending" | "done";

export default function FeedbackDialog({
  skin,
  open,
  seq,
  kind: requestedKind,
  context,
  onClose,
}: {
  skin: FeedbackSkin;
  open: boolean;
  /** Increments on every open request, so a repeated request re-applies `kind`. */
  seq: number;
  kind?: DialogKind;
  context?: string;
  onClose: () => void;
}) {
  const s = SKINS[skin];
  const source = skin === "fest" ? "dashboard" : "site";
  const ref = useRef<HTMLDialogElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const pressedOnBackdrop = useRef(false);
  const id = useId();

  const [kind, setKind] = useState<DialogKind>(requestedKind ?? "idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [quoteOk, setQuoteOk] = useState(false);
  const [website, setWebsite] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);

  // Open / close the native dialog with the host's state.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (requestedKind && DIALOG_KINDS.includes(requestedKind)) setKind(requestedKind);
      dialog.showModal();
      messageRef.current?.focus();
      track("feedback_open", { source });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, seq, requestedKind, source]);

  const handleClosed = () => {
    // Keep a draft for the next open; start fresh after a successful send.
    if (phase === "done") {
      setMessage("");
      setContact("");
      setQuoteOk(false);
      setPhase("form");
    }
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (phase === "sending") return;
    const text = message.trim();
    if (text.length < FEEDBACK_MESSAGE_MIN) {
      setError(COPY.tooShort);
      messageRef.current?.focus();
      return;
    }
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: text,
          contact: contact.trim() || undefined,
          quoteOk: kind === "praise" ? quoteOk : undefined,
          context: context ?? window.location.pathname,
          source,
          website,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        setError(body.error || COPY.networkError);
        setPhase("form");
        return;
      }
      track("feedback_submit", { kind, source });
      setPhase("done");
    } catch {
      setError(COPY.networkError);
      setPhase("form");
    }
  };

  const remaining = FEEDBACK_MESSAGE_MAX - message.length;
  const titleId = `${id}-title`;
  const ledeId = `${id}-lede`;
  const errorId = `${id}-error`;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={ledeId}
      className={s.dialog}
      onClose={handleClosed}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself (the content fills it with padding).
        if (pressedOnBackdrop.current && e.target === e.currentTarget) ref.current?.close();
        pressedOnBackdrop.current = false;
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className={s.title}>
              {phase === "done" ? COPY.doneTitle : COPY.title}
            </h2>
            <p id={ledeId} className={s.lede}>
              {phase === "done" ? COPY.doneBody : COPY.lede}
            </p>
          </div>
          <button type="button" aria-label={COPY.close} className={`shrink-0 cursor-pointer ${s.closeButton}`} onClick={() => ref.current?.close()}>
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        {phase === "done" ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <a
              href={SUPPORT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={s.link}
              onClick={() => track("support_click", { location: "feedback_dialog" })}
            >
              {COPY.doneLink}
              <span className="sr-only">{COPY.newTab}</span>
            </a>
            <button type="button" className={`cursor-pointer ${s.primary}`} onClick={() => ref.current?.close()}>
              {COPY.doneClose}
            </button>
          </div>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={submit} noValidate>
            <fieldset>
              <legend className={s.label}>{COPY.kindLegend}</legend>
              <div className={s.segment}>
                {DIALOG_KINDS.map((k) => (
                  <label key={k} className={s.segmentOption}>
                    <input
                      type="radio"
                      name={`${id}-kind`}
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      className="sr-only"
                    />
                    {COPY.kinds[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`${id}-message`} className={s.label}>
                  {COPY.messageLabel[kind]}
                </label>
                <span className={s.counter} aria-live="polite">
                  {remaining < 200 ? `${remaining} left` : `${message.length} / ${FEEDBACK_MESSAGE_MAX}`}
                </span>
              </div>
              <textarea
                ref={messageRef}
                id={`${id}-message`}
                name="message"
                required
                rows={5}
                maxLength={FEEDBACK_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={COPY.messagePlaceholder[kind]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={`${s.field} min-h-28 resize-y`}
              />
            </div>

            <div>
              <label htmlFor={`${id}-contact`} className={s.label}>
                {COPY.contactLabel}
              </label>
              <input
                id={`${id}-contact`}
                name="contact"
                type="text"
                autoComplete="off"
                maxLength={FEEDBACK_CONTACT_MAX}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                aria-describedby={`${id}-contact-hint`}
                className={`${s.field} h-10`}
              />
              <p id={`${id}-contact-hint`} className={s.hint}>
                {COPY.contactHint}
              </p>
            </div>

            {kind === "praise" ? (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={quoteOk}
                  onChange={(e) => setQuoteOk(e.target.checked)}
                  className={skin === "fest" ? "h-4 w-4 accent-[#151515]" : "h-4 w-4 accent-[#f8aa2a]"}
                />
                {COPY.quoteLabel}
              </label>
            ) : null}

            {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
            <div aria-hidden="true" className="sr-only">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            {error ? (
              <p id={errorId} role="alert" className={s.error}>
                {error}
              </p>
            ) : null}

            <div className={`flex items-center justify-end gap-2 border-t pt-4 ${s.rule}`}>
              <button type="button" className={`cursor-pointer ${s.secondary}`} onClick={() => ref.current?.close()}>
                {COPY.cancel}
              </button>
              <button type="submit" className={`cursor-pointer ${s.primary}`} disabled={phase === "sending"}>
                {phase === "sending" ? COPY.sending : COPY.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
