"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tone } from "./ui";

export interface ToastState {
  message: string;
  tone: Tone;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const show = useCallback((message: string, tone: Tone = "signal") => setToast({ message, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  return { toast, show };
}

export function ToastView({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const color =
    toast.tone === "clip"
      ? "border-clip/60 text-clip"
      : toast.tone === "amber"
        ? "border-amber/60 text-amber"
        : "border-signal/60 text-signal";
  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 console-panel rounded-lg px-4 py-3 font-mono text-sm ${color}`}
    >
      {toast.message}
    </div>
  );
}
