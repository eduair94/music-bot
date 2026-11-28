"use client";

/**
 * The NPS card itself (lazy chunk, see NpsSurvey): a small non-modal card in
 * the bottom-left corner, clear of the toast stack on the right. Score →
 * optional reason → a follow-up that depends on the answer.
 */
import { track } from "@/lib/analytics/track";
import { npsBandOf, type NpsBand } from "@/lib/feedback/nps";
import { FEEDBACK_MESSAGE_MAX } from "@/lib/feedback/validate";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SUPPORT_INVITE_URL, TOPGG_URL } from "../../../../shared/links";

const COPY = {
  question: "How likely are you to recommend Bypass to a friend?",
  low: "Not likely",
  high: "Very likely",
  scoreLabel: (n: number) => `${n} out of 10`,
  dismiss: "Dismiss survey",
  reasonLabel: "What's the main reason?",
  reasonHint: "Optional",
  send: "Send",
  sending: "Sending…",
  skip: "Skip",
  failed: "Couldn't send that. Try again, or skip.",
  close: "Close",
  thanks: {
    promoter: "Thanks! Would you leave a quick review on top.gg?",
    passive: "Thanks, that helps us decide what to work on next.",
    detractor: "Sorry to hear it. Tell us more in the support server and we'll look into it.",
  } satisfies Record<NpsBand, string>,
  review: "Review on top.gg",
  support: "Open the support server",
  later: "Maybe later",
  newTab: " (opens in a new tab)",
};

type Step = "ask" | "reason" | "thanks";

export default function NpsCard({
  onAnswered,
  onDismissed,
  onClosed,
}: {
  onAnswered: () => void;
  onDismissed: () => void;
  onClosed: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const id = useId();
  const [step, setStep] = useState<Step>("ask");
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("nps_shown");
  }, []);

  // The button that was pressed disappears with each step: keep focus in the card.
  useEffect(() => {
    if (step === "reason") reasonRef.current?.focus();
    if (step === "thanks") thanksRef.current?.focus();
  }, [step]);

  const pick = (n: number) => {
    setScore(n);
    onAnswered();
    setStep("reason");
  };

  const dismiss = () => {
    track("nps_dismiss");
    onDismissed();
    onClosed();
  };

  /** Sends the answer; `thenClose` (the card closed mid-way) skips the follow-up step. */
  const send = async (withReason: boolean, thenClose = false) => {
    if (score === null || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "nps",
          score,
          message: withReason ? reason.trim() : "",
          source: "dashboard",
          context: pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("nps_submit", { score });
      if (thenClose) return onClosed();
      setStep("thanks");
    } catch {
      if (thenClose) return onClosed();
      setError(COPY.failed);
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    // Closing after picking a score still sends the score.
    if (step === "reason" && !error) return void send(false, true);
    onClosed();
  };

  const band = score === null ? null : npsBandOf(score);
  const questionId = `${id}-q`;

  return (
    <section
      aria-labelledby={questionId}
      onKeyDown={(e) => {
        if (e.key === "Escape") (step === "ask" ? dismiss : close)();
      }}
      className="stub-in fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-4 right-4 z-50 rounded-[4px] border-2 border-ink bg-paper p-4 text-ink shadow-[0_18px_44px_-18px_rgb(21_21_21/0.5)] sm:right-auto sm:w-[384px]"
    >
      <button
        type="button"
        onClick={step === "ask" ? dismiss : close}
        aria-label={step === "ask" ? COPY.dismiss : COPY.close}
        className="absolute right-2 top-2 cursor-pointer rounded-[4px] p-2 text-ink-3 transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {step === "ask" ? (
        <>
          <p id={questionId} className="pr-8 text-[15px] font-semibold leading-snug">
            {COPY.question}
          </p>
          <div role="group" aria-labelledby={questionId} className="mt-3 grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => pick(n)}
                aria-label={COPY.scoreLabel(n)}
                className="clock h-9 cursor-pointer rounded-[3px] border border-ink/30 text-sm transition-colors hover:border-ink hover:bg-ink hover:text-stock"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-3" aria-hidden="true">
            <span>{COPY.low}</span>
            <span>{COPY.high}</span>
          </div>
        </>
      ) : null}

      {step === "reason" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(true);
          }}
        >
          <label id={questionId} htmlFor={`${id}-reason`} className="block pr-8 text-[15px] font-semibold leading-snug">
            {COPY.reasonLabel} <span className="text-xs font-normal text-ink-3">{COPY.reasonHint}</span>
          </label>
          <textarea
            ref={reasonRef}
            id={`${id}-reason`}
            rows={3}
            maxLength={FEEDBACK_MESSAGE_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 w-full resize-none rounded-[4px] border border-ink/30 bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-ink focus:outline-none"
          />
          {error ? (
            <p role="alert" className="mt-1 text-[13px] font-semibold text-now">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => (error ? onClosed() : void send(false))}
              disabled={sending}
              className="h-9 cursor-pointer rounded-[4px] px-3 text-sm font-semibold transition-colors hover:bg-ink/[0.06] disabled:opacity-55"
            >
              {COPY.skip}
            </button>
            <button
              type="submit"
              disabled={sending || !reason.trim()}
              className="h-9 cursor-pointer rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {sending ? COPY.sending : COPY.send}
            </button>
          </div>
        </form>
      ) : null}

      {step === "thanks" && band ? (
        <div role="status" ref={thanksRef} tabIndex={-1} className="outline-none">
          <p id={questionId} className="pr-8 text-[15px] font-semibold leading-snug">
            {COPY.thanks[band]}
          </p>
          {band === "promoter" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={TOPGG_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track("review_prompt_click");
                  onClosed();
                }}
                className="inline-flex h-9 items-center rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2"
              >
                {COPY.review}
                <span className="sr-only">{COPY.newTab}</span>
              </a>
              <button
                type="button"
                onClick={onClosed}
                className="h-9 cursor-pointer rounded-[4px] px-3 text-sm font-semibold transition-colors hover:bg-ink/[0.06]"
              >
                {COPY.later}
              </button>
            </div>
          ) : null}
          {band === "detractor" ? (
            <a
              href={SUPPORT_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("support_click", { location: "nps" })}
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-2"
            >
              {COPY.support}
              <span className="sr-only">{COPY.newTab}</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
