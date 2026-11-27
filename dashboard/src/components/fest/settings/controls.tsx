"use client";

/**
 * Settings building blocks: the section frame with its Save/Discard footer,
 * number and percent fields, channel sets and add-to-list inputs. Standard
 * controls in the bill's vocabulary (ink, stock, 4px corners).
 */
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import { fmtClock } from "@/lib/dash/format";
import { Button, cx, Select, Slider, TextInput } from "../ui";

// ── Section frame ────────────────────────────────────────────────────────────

export function SectionFrame({
  id,
  title,
  intro,
  children,
  footer,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-section={id}
      className="scroll-mt-32 border-t-2 border-ink pt-6 first:border-t-0 first:pt-8 lg:scroll-mt-24 [&+section]:mt-16"
    >
      <h2 id={`${id}-title`} className="bill text-[34px] sm:text-[40px]">
        {title}
      </h2>
      {intro ? <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">{intro}</p> : null}
      <div className="mt-4 border-t border-rule">{children}</div>
      {footer}
    </section>
  );
}

/**
 * Per-section actions. Sticks to the bottom of the viewport while the section
 * has unsaved changes, so Save stays in reach on long sections and phones.
 * After a save, a SAVED stamp lands beside the buttons.
 */
export function SectionFooter({
  title,
  dirty,
  error,
  saving,
  savedAt,
  failed,
  onSave,
  onDiscard,
}: {
  title: string;
  dirty: number;
  error?: string;
  saving: boolean;
  savedAt?: number;
  failed?: string;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const live = dirty > 0;
  // A clean section ends on its last row; the bar appears once something changes.
  if (!live && !savedAt) return null;
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule py-3",
        live &&
          "sticky bottom-0 z-10 -mx-4 border-t-2 border-t-ink bg-stock px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_24px_-18px_rgb(21_21_21/0.45)] sm:mx-0 sm:px-0",
      )}
    >
      <div className="min-w-0 flex-1 text-[13px]" aria-live="polite">
        {error && live ? (
          <p className="flex items-start gap-1.5 font-semibold text-now">
            <AlertCircle size={15} className="mt-px shrink-0" aria-hidden />
            <span>Fix the field marked above to save.</span>
          </p>
        ) : failed && live ? (
          <p className="flex items-start gap-1.5 font-semibold text-now">
            <AlertCircle size={15} className="mt-px shrink-0" aria-hidden />
            <span>Not saved: {failed}</span>
          </p>
        ) : live ? (
          <p className="font-semibold text-ink">
            {dirty} unsaved change{dirty === 1 ? "" : "s"} in {title}
          </p>
        ) : savedAt ? (
          <span
            key={savedAt}
            className="stamp-in inline-flex -rotate-2 items-baseline gap-2 rounded-[3px] border-2 border-ink px-2 pb-0.5 pt-1 text-ink"
            style={{ "--sx": "100%", "--sy": "50%" } as React.CSSProperties}
          >
            <span className="bill text-[17px]">Saved</span>
            <span className="clock text-[13px]">{fmtClock(savedAt)}</span>
          </span>
        ) : null}
      </div>
      {live ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="ink" size="sm" busy={saving} disabled={Boolean(error)} onClick={onSave}>
            Save {title.toLowerCase()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Field helpers ────────────────────────────────────────────────────────────

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-now">
      <AlertCircle size={14} className="mt-[2px] shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export function NumberField({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  error,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 sm:justify-end">
        <div className="w-32 shrink-0">
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : ""}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
            className={cx(
              "clock text-right text-[18px] disabled:cursor-not-allowed disabled:opacity-55",
              error && "border-now focus:border-now",
            )}
          />
        </div>
        {suffix ? <span className="w-12 text-sm text-ink-2">{suffix}</span> : null}
      </div>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

/** Slider with a percent readout in clock numerals. */
export function PercentField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div id={id}>
      <div className="flex items-center gap-3">
        <Slider label={label} value={value} min={min} max={max} step={step} onChange={onChange} disabled={disabled} />
        <output className={cx("clock w-14 shrink-0 text-right text-[22px] leading-none", error && "text-now")} aria-hidden>
          {value}%
        </output>
      </div>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

// ── Channel sets ─────────────────────────────────────────────────────────────

export interface ChannelOption {
  id: string;
  name: string;
  group?: string;
}

function grouped(options: ChannelOption[]): [string, ChannelOption[]][] {
  const map = new Map<string, ChannelOption[]>();
  for (const o of options) {
    const g = o.group ?? "";
    map.set(g, [...(map.get(g) ?? []), o]);
  }
  return [...map.entries()];
}

export function ChannelOptions({ options }: { options: ChannelOption[] }) {
  const groups = grouped(options);
  if (groups.length === 1 && groups[0][0] === "") {
    return (
      <>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </>
    );
  }
  return (
    <>
      {groups.map(([g, opts]) => (
        <optgroup key={g || "none"} label={g || "No category"}>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Chips for the picked channels, plus a select that adds one. Empty means every channel. */
export function ChannelSet({
  id,
  options,
  value,
  onChange,
  disabled,
  prefix,
  emptyLabel,
  addLabel,
}: {
  id: string;
  options: ChannelOption[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  prefix: string;
  emptyLabel: string;
  addLabel: string;
}) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const remaining = options.filter((o) => !value.includes(o.id));
  return (
    <div>
      <ul
        className="flex flex-wrap gap-1.5"
        aria-label={`${addLabel.replace(/^Add /, "")}: ${value.length ? `${value.length} picked` : emptyLabel}`}
      >
        {value.length === 0 ? (
          <li className="dashed rounded-[4px] px-2.5 py-1 text-[13px] font-semibold text-ink-2">{emptyLabel}</li>
        ) : (
          value.map((cid) => {
            const name = byId.get(cid)?.name ?? `Deleted channel ${cid.slice(-4)}`;
            return (
              <li
                key={cid}
                className="inline-flex h-8 items-center gap-0.5 rounded-[4px] bg-ink pl-2.5 pr-0.5 text-[13px] font-semibold text-stock"
              >
                <span className="max-w-[12rem] truncate">
                  {prefix}
                  {name}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((v) => v !== cid))}
                  aria-label={`Remove ${prefix}${name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-stock/75 transition-colors hover:bg-stock/15 hover:text-stock disabled:hidden"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })
        )}
      </ul>
      <Select
        id={id}
        className="mt-2"
        value=""
        disabled={disabled || remaining.length === 0}
        aria-label={addLabel}
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
      >
        <option value="">{remaining.length ? `${addLabel}…` : "Every channel is picked"}</option>
        <ChannelOptions options={remaining} />
      </Select>
    </div>
  );
}

// ── Add-to-list input (commands, user IDs) ───────────────────────────────────

export function ListAdder({
  id,
  label,
  placeholder,
  button,
  parse,
  existing,
  onAdd,
  disabled,
  mono,
}: {
  id: string;
  label: string;
  placeholder: string;
  button: string;
  parse: (raw: string) => { value?: string; error?: string };
  existing: string[];
  onAdd: (v: string) => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hint = useId();
  const submit = () => {
    if (!raw.trim()) return;
    const r = parse(raw);
    if (r.error || !r.value) return setError(r.error ?? "That doesn't look right.");
    if (existing.includes(r.value)) return setError("Already on the list.");
    onAdd(r.value);
    setRaw("");
    setError(null);
  };
  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          id={id}
          value={raw}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? hint : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setRaw(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className={cx(
            mono && "clock text-[16px] placeholder:font-[family-name:var(--font-ui)] placeholder:text-sm placeholder:font-normal",
            "disabled:cursor-not-allowed disabled:opacity-55",
            error && "border-now focus:border-now",
          )}
        />
        <Button variant="outline" size="md" disabled={disabled || !raw.trim()} onClick={submit} className="shrink-0">
          <Plus size={15} /> {button}
        </Button>
      </div>
      <FieldError id={hint}>{error ?? undefined}</FieldError>
    </div>
  );
}

export function ChipList({
  items,
  emptyLabel,
  render,
  onRemove,
  disabled,
  label,
}: {
  items: string[];
  emptyLabel: string;
  render: (v: string) => ReactNode;
  onRemove: (v: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {items.length === 0 ? (
        <li className="dashed rounded-[4px] px-2.5 py-1 text-[13px] font-semibold text-ink-2">{emptyLabel}</li>
      ) : (
        items.map((v) => (
          <li
            key={v}
            className="inline-flex h-8 items-center gap-0.5 rounded-[4px] bg-ink pl-2.5 pr-0.5 text-[13px] font-semibold text-stock"
          >
            <span className="max-w-[14rem] truncate">{render(v)}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(v)}
              aria-label={`Remove ${v}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-stock/75 transition-colors hover:bg-stock/15 hover:text-stock disabled:hidden"
            >
              <X size={14} />
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
