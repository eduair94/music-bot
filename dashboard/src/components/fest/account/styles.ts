/**
 * Server-safe class helpers for the account screens. `cx` and the button
 * classes in ../ui.tsx live in a client module, so server components that
 * need a link styled as a button use these instead (same tokens, same look).
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "ink" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  ink: "bg-ink text-stock hover:bg-ink-2",
  outline: "border border-ink text-ink bg-paper/60 hover:bg-ink hover:text-stock",
  ghost: "text-ink hover:bg-ink/[0.06]",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

/** Classes for an <a>/<Link> that looks like the bill's Button. */
export function btn(variant: Variant = "outline", size: Size = "md", extra?: string): string {
  return cx(
    "relative inline-flex select-none items-center justify-center rounded-[4px] font-semibold whitespace-nowrap",
    "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

/** Inline text link in running copy. */
export const textLink =
  "font-semibold text-ink underline decoration-ink/35 decoration-1 underline-offset-[3px] transition-colors hover:decoration-ink";
