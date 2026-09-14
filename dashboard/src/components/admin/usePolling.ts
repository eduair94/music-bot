"use client";

import { useCallback, useEffect, useState } from "react";

/** Fetch JSON now and every `intervalMs` while the tab is visible. `url = null` disables. */
export function usePolling<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    if (intervalMs <= 0) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs, tick]);

  return { data, error, loading, refresh };
}

/** POST an admin action and normalise the response. */
export async function postAction(url: string): Promise<{ ok: boolean; result?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}` };
    return { ok: body.ok !== false, result: body.result, error: body.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
