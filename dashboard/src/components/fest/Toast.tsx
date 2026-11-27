"use client";

/**
 * Ticket-stub toasts: each confirmation is a torn stub that slides in at the
 * bottom right and tears away. Errors carry the reason (e.g. which permission
 * rule blocked the action).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "ok" | "error" | "info";

interface Stub {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
  color?: string;
  leaving?: boolean;
}

interface ToastApi {
  push: (t: { tone?: Tone; title: string; detail?: string; color?: string }) => void;
}

const Ctx = createContext<ToastApi>({ push: () => {} });

export function useToast(): ToastApi {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [stubs, setStubs] = useState<Stub[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setStubs((s) => s.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setStubs((s) => s.filter((x) => x.id !== id)), 240);
  }, []);

  const push = useCallback<ToastApi["push"]>(
    ({ tone = "ok", title, detail, color }) => {
      const id = ++seq.current;
      setStubs((s) => [...s.slice(-2), { id, tone, title, detail, color }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6500 : 3200);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] right-4 z-[70] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      >
        {stubs.map((s) => (
          <div
            key={s.id}
            role={s.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto relative flex overflow-hidden rounded-[4px] border border-ink bg-paper shadow-[0_10px_28px_-14px_rgb(21_21_21/0.45)] ${s.leaving ? "stub-out" : "stub-in"}`}
          >
            <span
              aria-hidden
              className="w-3 shrink-0 border-r border-dashed border-ink/40"
              style={{ background: s.tone === "error" ? "#d4001f" : s.color ?? "#151515" }}
            />
            <div className="min-w-0 flex-1 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-ink">{s.title}</p>
              {s.detail ? <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{s.detail}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(s.id)}
              aria-label="Dismiss"
              className="px-3 text-ink-3 transition-colors hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
