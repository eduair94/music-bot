"use client";

/**
 * Signed-in identity for GA4 and Clarity: a salted hash of the Discord id
 * (computed on the server), never the id, name or email. Sent only when
 * analytics is allowed for this visitor. The owner's browsers are marked
 * internal (bp_internal) so their visits are excluded from reports.
 */

import { CONSENT_CHANGE_EVENT, INTERNAL_KEY } from "@/lib/analytics/config";
import { analyticsAllowed } from "@/lib/analytics/consent";
import { queueClarity, queueGtag } from "@/lib/analytics/vendors";
import { useEffect } from "react";

export default function AnalyticsIdentity({ userHash, isOwner }: { userHash: string | null; isOwner: boolean }) {
  useEffect(() => {
    if (isOwner) {
      try {
        window.localStorage.setItem(INTERNAL_KEY, "1");
      } catch {
        /* ignore */
      }
      queueGtag("set", { traffic_type: "internal" });
      queueClarity("set", "internal", "1");
    }
    if (!userHash) return;

    let sent = false;
    const identify = () => {
      if (sent) return;
      sent = true;
      queueGtag("set", { user_id: userHash });
      queueGtag("set", "user_properties", { logged_in: "yes" });
      queueClarity("identify", userHash);
    };
    let live = true;
    void analyticsAllowed().then((ok) => {
      if (live && ok) identify();
    });
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "granted") identify();
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => {
      live = false;
      window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    };
  }, [userHash, isOwner]);

  return null;
}
