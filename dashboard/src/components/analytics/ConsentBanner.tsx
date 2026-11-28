"use client";

/**
 * Cookie consent prompt for visitors who must opt in (EEA, UK, Switzerland),
 * and the "Cookie settings" dialog for everyone. Reject sits beside Accept with
 * the same size and weight. Fixed to the viewport, so it never moves the page.
 * Lives in the root layout: neutral dark card, readable on the landing's coal
 * and on the dashboard's light stock alike.
 */

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { ConsentChoice } from "@/lib/analytics/config";

const COPY = {
  title: "Cookies",
  body: "We use Google Analytics and Microsoft Clarity to see which pages help people find and use Bypass. They only set cookies if you accept.",
  details: "Cookie details",
  accept: "Accept",
  reject: "Reject",
};

const buttonClass =
  "h-11 rounded-md border border-line-strong bg-coal px-4 text-sm font-semibold text-cream transition-colors hover:border-cream";

export default function ConsentBanner({
  manual,
  onChoice,
  onClose,
}: {
  /** Opened from "Cookie settings": the dialog takes focus and hands it back when closed. */
  manual: boolean;
  onChoice: (choice: ConsentChoice) => void;
  /** Escape closes without changing anything (offered when opened from Cookie settings). */
  onClose?: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!manual) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [manual]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[75] mx-auto max-w-md rounded-lg border border-line-strong bg-panel-raised p-5 font-sans text-cream shadow-[0_6px_24px_rgb(0_0_0/0.35)] sm:inset-x-auto sm:left-6 sm:mx-0 sm:w-[26rem] focus:outline-none"
    >
      <h2 id={`${id}-title`} className="font-display text-lg font-semibold tracking-tight">
        {COPY.title}
      </h2>
      <p id={`${id}-body`} className="mt-2 text-sm leading-relaxed text-dune">
        {COPY.body}{" "}
        <Link href="/privacy#cookies" prefetch={false} className="text-cream underline underline-offset-2 hover:text-amber">
          {COPY.details}
        </Link>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onChoice("denied")} className={buttonClass}>
          {COPY.reject}
        </button>
        <button type="button" onClick={() => onChoice("granted")} className={buttonClass}>
          {COPY.accept}
        </button>
      </div>
    </div>
  );
}
