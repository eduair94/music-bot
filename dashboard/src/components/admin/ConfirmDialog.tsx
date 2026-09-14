"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

export function ConfirmDialog({
  title,
  description,
  confirmText,
  requireText,
  busy,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  confirmText: string;
  requireText?: string;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const armed = !requireText || typed.trim() === requireText;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-coal/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="console-panel rounded-xl p-6 w-full max-w-md border-clip/40">
        <div className="console-label text-clip!">Destructive action</div>
        <h3 id="confirm-title" className="font-display text-xl font-semibold text-cream mt-2">
          {title}
        </h3>
        <p className="text-sm text-dune mt-2 leading-relaxed">{description}</p>
        {requireText && (
          <label className="block mt-4">
            <span className="console-label">
              Type <span className="text-cream">{requireText}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-md bg-panel-raised border border-line-bright px-3 py-2 font-mono text-sm text-cream focus-amber"
            />
          </label>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button tone="clip" onClick={() => void onConfirm()} disabled={!armed || busy}>
            {busy ? "Working…" : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
