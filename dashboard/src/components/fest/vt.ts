"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

type DocWithVT = Document & { startViewTransition?: (cb: () => void | Promise<void>) => unknown };

/**
 * Client navigation wrapped in a View Transition when the browser supports it,
 * so elements sharing a `view-transition-name` morph between pages
 * (the stage on the bill becomes the player header).
 */
export function useTransitionNav() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      const doc = document as DocWithVT;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!doc.startViewTransition || reduce) {
        router.push(href);
        return;
      }
      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            router.push(href);
            // Let the next route paint before the snapshot is taken.
            setTimeout(resolve, 120);
          }),
      );
    },
    [router],
  );
}
