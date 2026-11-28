"use client";

/**
 * Dashboard NPS gate, mounted once in app/(dashboard)/layout.tsx. Records the
 * day, and after NPS_DELAY_MS of visible time shows the survey card (a lazy
 * chunk) to returning users. Never shown to the owner. localStorage access is
 * wrapped: private modes and blocked storage just mean no survey.
 */
import {
  localDay,
  NPS_DAYS_KEY,
  NPS_DELAY_MS,
  NPS_LAST_KEY,
  parseDays,
  parseLast,
  shouldShowNps,
  withVisit,
  type NpsAction,
} from "@/lib/feedback/nps";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const NpsCard = dynamic(() => import("./NpsCard"), { ssr: false });

function remember(action: NpsAction): void {
  try {
    localStorage.setItem(NPS_LAST_KEY, JSON.stringify({ at: Date.now(), action }));
  } catch {
    /* storage blocked: the survey may come back next visit */
  }
}

export default function NpsSurvey({ isOwner }: { isOwner: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOwner) return;
    let eligible = false;
    try {
      const days = withVisit(parseDays(localStorage.getItem(NPS_DAYS_KEY)), localDay(new Date()));
      localStorage.setItem(NPS_DAYS_KEY, JSON.stringify(days));
      eligible = shouldShowNps(days, parseLast(localStorage.getItem(NPS_LAST_KEY))?.at ?? null, Date.now());
    } catch {
      return;
    }
    if (!eligible) return;

    // Count only time the tab is visible.
    let elapsed = 0;
    let startedAt = document.visibilityState === "visible" ? Date.now() : 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setShow(true), Math.max(0, NPS_DELAY_MS - elapsed));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startedAt = Date.now();
        arm();
      } else {
        if (startedAt) elapsed += Date.now() - startedAt;
        startedAt = 0;
        clearTimeout(timer);
      }
    };
    if (startedAt) arm();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOwner]);

  if (!show) return null;
  return <NpsCard onAnswered={() => remember("answered")} onDismissed={() => remember("dismissed")} onClosed={() => setShow(false)} />;
}
