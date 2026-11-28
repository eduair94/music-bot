"use client";

import { ANALYTICS_ENABLED, CONSENT_OPEN_EVENT } from "@/lib/analytics/config";

const LABEL = "Cookie settings";

/** Reopens the consent dialog. Renders nothing when no analytics tool is configured. */
export default function CookieSettingsButton({ className }: { className?: string }) {
  if (!ANALYTICS_ENABLED) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))} className={className}>
      {LABEL}
    </button>
  );
}
