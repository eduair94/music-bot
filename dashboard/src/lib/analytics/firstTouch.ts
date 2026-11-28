/**
 * First-touch cookie (`bp_ft`): where a visitor originally came from, read by
 * `/invite` when a click carries no ref. Captured on the first page of a
 * visit, written only once analytics is allowed (maybe later, on accept).
 */

import { FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE_S, serializeFirstTouch, sourceFromVisit } from "../../../../shared/growth";

export interface Landing {
  search: string;
  referrer: string;
  path: string;
  t: number;
}

/** The page this visit started on (call once, on the first page load). */
export function captureLanding(): Landing {
  return {
    search: window.location.search,
    referrer: document.referrer,
    path: window.location.pathname,
    t: Date.now(),
  };
}

function hasFirstTouch(): boolean {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${FIRST_TOUCH_COOKIE}=`));
}

/** Writes `bp_ft` unless the visitor already has one. Caller checks consent. */
export function writeFirstTouch(landing: Landing | null): void {
  if (!landing) return;
  try {
    if (hasFirstTouch()) return;
    const value = serializeFirstTouch({
      ...sourceFromVisit(new URLSearchParams(landing.search), landing.referrer, window.location.hostname),
      l: landing.path.slice(0, 80),
      t: landing.t,
    });
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${FIRST_TOUCH_COOKIE}=${value}; Max-Age=${FIRST_TOUCH_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked */
  }
}
