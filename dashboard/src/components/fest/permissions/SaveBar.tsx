"use client";

/** Ink strip that rises from the bottom while there are unsaved changes. */
import { Button, cx } from "../ui";

export function SaveBar({
  dirty,
  saving,
  error,
  changes,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  error: string | null;
  changes: string[];
  onDiscard: () => void;
  onSave: () => void;
}) {
  const summary = changes.length > 3 ? `${changes.slice(0, 3).join(" · ")} · ${changes.length - 3} more` : changes.join(" · ");
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      inert={!dirty}
      className={cx(
        "fixed inset-x-0 bottom-0 z-[60] bg-ink text-stock shadow-[0_-10px_30px_-18px_rgb(21_21_21/0.6)]",
        "transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        dirty ? "visible translate-y-0" : "invisible translate-y-[110%]",
      )}
    >
      <div className="flex items-center gap-x-4 gap-y-2 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Unsaved changes</p>
          {error ? (
            <p role="alert" className="text-[13px] leading-snug text-[#ff8a7a]">
              Couldn&apos;t save: {error}
            </p>
          ) : summary ? (
            <p className="hidden truncate text-[13px] text-stock/70 sm:block">{summary}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="md" onClick={onDiscard} disabled={saving} className="text-stock hover:bg-stock/10">
          Discard
        </Button>
        <Button variant="outline" size="md" onClick={onSave} busy={saving} className="min-w-24 border-stock bg-stock text-ink hover:bg-paper hover:text-ink">
          {error ? "Try again" : "Save"}
        </Button>
      </div>
    </div>
  );
}
