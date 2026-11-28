/**
 * Consent state in the browser: the stored choice, whether this visitor has
 * to be asked (EEA/UK/CH), and applying a choice to gtag and Clarity.
 * Every storage access is guarded: blocked storage means "no choice yet".
 */

import { FIRST_TOUCH_COOKIE } from "../../../../shared/growth";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_KEY,
  GEO_KEY,
  GEO_MAX_AGE_MS,
  timeZoneRequiresConsent,
  type ConsentChoice,
} from "./config";

export function readConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* the choice still applies to this page view */
  }
}

/** Cookies analytics may have written; removed when a visitor rejects. */
function isAnalyticsCookie(name: string): boolean {
  return name === "_ga" || name.startsWith("_ga_") || name === "_clck" || name === "_clsk" || name === FIRST_TOUCH_COOKIE;
}

function clearAnalyticsCookies(): void {
  try {
    const names = document.cookie
      .split(";")
      .map((part) => part.trim().split("=")[0])
      .filter(isAnalyticsCookie);
    if (!names.length) return;
    // GA writes on the registrable domain (.example.com): try the host and each parent.
    const labels = window.location.hostname.split(".");
    const domains = [""];
    for (let i = 0; i < labels.length - 1; i++) domains.push(`; Domain=.${labels.slice(i).join(".")}`);
    for (const name of names) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  } catch {
    /* ignore */
  }
}

/** Tells gtag and Clarity (when loaded; their bootstraps read the stored choice otherwise) and notifies listeners. */
export function applyConsent(choice: ConsentChoice): void {
  try {
    window.gtag?.("consent", "update", { analytics_storage: choice });
  } catch {
    /* ignore */
  }
  try {
    window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: choice });
  } catch {
    /* ignore */
  }
  if (choice === "denied") clearAnalyticsCookies();
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: choice }));
  } catch {
    /* ignore */
  }
}

interface GeoCache {
  /** Country code, null when unknown. */
  c: string | null;
  /** Consent required; null when the country was unknown. */
  r: boolean | null;
  t: number;
}

function readGeoCache(): GeoCache | null {
  try {
    const raw = window.localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<GeoCache>;
    if (typeof value.t !== "number" || Date.now() - value.t > GEO_MAX_AGE_MS) return null;
    return { c: typeof value.c === "string" ? value.c : null, r: typeof value.r === "boolean" ? value.r : null, t: value.t };
  } catch {
    return null;
  }
}

function writeGeoCache(value: GeoCache): void {
  try {
    window.localStorage.setItem(GEO_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

async function lookUpRequired(): Promise<boolean> {
  let geo = readGeoCache();
  if (!geo) {
    try {
      const res = await fetch("/api/public/geo", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { country?: unknown; consentRequired?: unknown };
        geo = {
          c: typeof data.country === "string" ? data.country : null,
          r: typeof data.consentRequired === "boolean" ? data.consentRequired : null,
          t: Date.now(),
        };
        writeGeoCache(geo);
      }
    } catch {
      /* offline or blocked: fall back to the time zone, retry next visit */
    }
  }
  return geo?.r ?? timeZoneRequiresConsent(timeZone());
}

let required: Promise<boolean> | null = null;

/** Whether this visitor must opt in before analytics cookies (one lookup per page load, cached 30 days). */
export function consentRequired(): Promise<boolean> {
  required ??= lookUpRequired();
  return required;
}

/** Analytics with cookies/identifiers is allowed: accepted, or not asked for and not rejected. */
export async function analyticsAllowed(): Promise<boolean> {
  const choice = readConsent();
  if (choice) return choice === "granted";
  return !(await consentRequired());
}
