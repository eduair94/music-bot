"use client";

/**
 * Web analytics loader, rendered by the root layout only when GA4 or Clarity
 * is configured. Owns consent (banner for EEA/UK/CH visitors), the first-touch
 * cookie, delegated click tracking and the page-group dimension. Kept small:
 * the banner is a separate chunk fetched only when it has to show.
 */

import { clickEvent } from "@/lib/analytics/clicks";
import {
  CLARITY_ID,
  CONSENT_OPEN_EVENT,
  GA_ID,
  isExcludedPath,
  pageGroup,
  type ConsentChoice,
} from "@/lib/analytics/config";
import { applyConsent, consentRequired, readConsent, saveConsent } from "@/lib/analytics/consent";
import { captureLanding, writeFirstTouch, type Landing } from "@/lib/analytics/firstTouch";
import { clarityScript, gtagInitScript } from "@/lib/analytics/scripts";
import { setTag, track } from "@/lib/analytics/track";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

// React.lazy rather than next/dynamic: the banner only ever renders after mount, and this keeps
// next/dynamic's loader out of every page.
const ConsentBanner = lazy(() => import("./ConsentBanner"));

export default function Analytics() {
  const pathname = usePathname() ?? "/";
  const excluded = isExcludedPath(pathname);
  const group = pageGroup(pathname);

  /** undefined until read on mount; null = no choice stored. */
  const [choice, setChoice] = useState<ConsentChoice | null | undefined>(undefined);
  /** Whether this visitor must opt in; null until known (only looked up without a stored choice). */
  const [required, setRequired] = useState<boolean | null>(null);
  /** "auto" = first-visit prompt, "manual" = opened from Cookie settings (takes focus, Escape closes). */
  const [banner, setBanner] = useState<"auto" | "manual" | null>(null);
  const landing = useRef<Landing | null>(null);

  useEffect(() => {
    landing.current = captureLanding();
    const stored = readConsent();
    setChoice(stored);
    if (stored === "granted") writeFirstTouch(landing.current);
    if (stored !== null) return;
    let live = true;
    void consentRequired().then((mustAsk) => {
      if (!live) return;
      setRequired(mustAsk);
      if (mustAsk) {
        // Google geolocates hits on its own; when our lookup says "ask first", hold GA until they answer.
        try {
          window.gtag?.("consent", "update", { analytics_storage: "denied" });
        } catch {
          /* ignore */
        }
        setBanner((open) => open ?? "auto");
      } else {
        writeFirstTouch(landing.current);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const open = () => setBanner("manual");
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.type === "auxclick" && event.button !== 1) return;
      const found = clickEvent(event.target, window.location);
      if (found) track(found.event, found.params);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  useEffect(() => {
    // Client-side navigation into an owner page: GA's documented kill switch stops its hits there.
    if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = excluded;
    try {
      window.gtag?.("set", { page_group: group, content_group: group });
    } catch {
      /* ignore */
    }
    setTag("page_group", group);
  }, [excluded, group]);

  const choose = useCallback((next: ConsentChoice) => {
    saveConsent(next);
    applyConsent(next);
    setChoice(next);
    setBanner(null);
    if (next === "granted") {
      writeFirstTouch(landing.current);
      track("consent_choice", { choice: next });
    }
  }, []);

  const closeBanner = useCallback(() => setBanner(null), []);

  // Clarity waits until we know whether to send "denied" first (a cached lookup, or one small request).
  const clarityReady = Boolean(CLARITY_ID) && !excluded && choice !== undefined && (choice !== null || required !== null);

  return (
    <>
      {GA_ID && !excluded ? (
        // Consent defaults + config, then it injects gtag.js (async, no <head> preload).
        <Script id="gtag-init" strategy="afterInteractive">
          {gtagInitScript(GA_ID, group)}
        </Script>
      ) : null}
      {clarityReady ? (
        <Script id="clarity-init" strategy="lazyOnload">
          {clarityScript(CLARITY_ID, group, choice === null && required === true)}
        </Script>
      ) : null}
      {banner ? (
        <Suspense fallback={null}>
          <ConsentBanner
            manual={banner === "manual"}
            onChoice={choose}
            onClose={banner === "manual" ? closeBanner : undefined}
          />
        </Suspense>
      ) : null}
    </>
  );
}
