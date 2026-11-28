/**
 * Queue-safe gtag / Clarity calls for code that can run before the loader's
 * bootstrap scripts (the dashboard identity, for one). Each installs the
 * vendor's own queue stub when missing, which the real tag replays on load.
 * No-ops when the tool is not configured, so nothing piles up unread.
 */

import { CLARITY_ID, GA_ID } from "./config";

export function queueGtag(...args: unknown[]): void {
  if (!GA_ID || typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        // gtag.js expects the arguments object itself, not an array.
        window.dataLayer!.push(arguments);
      };
    }
    window.gtag(...args);
  } catch {
    /* ignore */
  }
}

export function queueClarity(...args: unknown[]): void {
  if (!CLARITY_ID || typeof window === "undefined") return;
  try {
    if (!window.clarity) {
      const stub: ((...a: unknown[]) => void) & { q?: unknown[] } = function clarity() {
        (stub.q = stub.q || []).push(arguments);
      };
      window.clarity = stub;
    }
    window.clarity(...args);
  } catch {
    /* ignore */
  }
}
