"use client";

/**
 * Bill primitives: buttons, inputs, switch, select, slider, menu.
 * Standard controls in the festival-bill vocabulary: ink, printed stock,
 * 4px corners, stage colours only where they carry meaning.
 */
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "ink" | "outline" | "ghost" | "stage" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  ink: "bg-ink text-stock hover:bg-ink-2 disabled:bg-ink-3",
  outline: "border border-ink text-ink bg-paper/60 hover:bg-ink hover:text-stock",
  ghost: "text-ink hover:bg-ink/[0.06]",
  stage: "text-[var(--on)] bg-[var(--stage)] hover:brightness-95",
  danger: "border border-now text-now hover:bg-now hover:text-white",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  stageColor?: string;
  stageOn?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", busy, stageColor, stageOn, className, style, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      style={stageColor ? ({ "--stage": stageColor, "--on": stageOn ?? "#fff", ...style } as React.CSSProperties) : style}
      className={cx(
        "relative inline-flex select-none items-center justify-center rounded-[4px] font-semibold whitespace-nowrap",
        "transition-[background-color,color,transform,filter] duration-150 ease-out active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {busy ? <span className="absolute inset-x-2 bottom-1 h-[2px] origin-left animate-[print-pull_900ms_ease-in-out_infinite] bg-current" /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  size = 36,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[4px] transition-[background-color,transform] duration-150 active:scale-[0.94]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        "h-10 w-full rounded-[4px] border border-ink/30 bg-paper px-3 text-sm text-ink placeholder:text-ink-3",
        "transition-colors focus:border-ink focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative", className)}>
      <select
        className="h-10 w-full appearance-none rounded-[4px] border border-ink/30 bg-paper pl-3 pr-9 text-sm text-ink transition-colors focus:border-ink focus:outline-none"
        {...rest}
      >
        {children}
      </select>
      <svg aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  color = "#151515",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-ink transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ background: checked ? color : "transparent" }}
    >
      <span
        className="absolute left-[3px] h-4 w-4 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: checked ? "translateX(20px)" : "none", background: checked ? "#fbf8f2" : "#151515" }}
      />
    </button>
  );
}

/** Range input with a stage-coloured fill. */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  color = "#151515",
  label,
  disabled,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  color?: string;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      className={cx("fest-range h-6 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", className)}
      style={{ "--fill": `${pct}%`, "--stage": color } as React.CSSProperties}
    />
  );
}

/** Small popover menu anchored to a trigger; closes on outside click / Escape. */
export function Menu({
  trigger,
  children,
  align = "left",
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={cx(
            "absolute top-[calc(100%+6px)] z-50 min-w-56 overflow-hidden rounded-[4px] border border-ink bg-paper py-1 shadow-[0_12px_32px_-12px_rgb(21_21_21/0.35)]",
            "origin-top animate-[stub-in_220ms_cubic-bezier(0.16,1,0.3,1)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  onSelect,
  children,
  danger,
  disabled,
}: {
  onSelect: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
        "hover:bg-ink hover:text-stock disabled:pointer-events-none disabled:opacity-45",
        danger ? "text-now" : "text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Section heading on the bill: condensed caps with an optional rule colour. */
export function BillHeading({
  children,
  as: Tag = "h2",
  className,
  size = "md",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = { sm: "text-xl", md: "text-[28px]", lg: "text-[40px]", xl: "text-[56px] sm:text-[64px]" };
  return <Tag className={cx("bill text-balance", sizes[size], className)}>{children}</Tag>;
}

/** A labelled settings row: label + hint on the left, control on the right. */
export function FieldRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-rule py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-8">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[15px] font-semibold text-ink">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p> : null}
      </div>
      <div className="min-w-0 sm:justify-self-end sm:w-full">{children}</div>
    </div>
  );
}
