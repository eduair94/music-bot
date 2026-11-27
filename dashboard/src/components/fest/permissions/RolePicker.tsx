"use client";

/**
 * Role and member chips plus the pickers that add them. Role chips carry the
 * role's Discord colour as a dot; ids that no longer resolve get the dashed
 * outline the bill uses for anything absent.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Search, UserPlus, X } from "lucide-react";
import type { GuildRole } from "@/lib/dash/types";
import { cx } from "../ui";
import { roleColor, USER_ID } from "./model";

export function RoleDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

const chipBase = "inline-flex h-7 max-w-full items-center gap-1.5 rounded-[4px] pl-2 text-[13px] font-semibold text-ink";

export function RoleChip({
  id,
  role,
  onRemove,
  removeLabel,
}: {
  id: string;
  role?: GuildRole;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const name = role ? role.name : "Deleted role";
  return (
    <span
      className={cx(chipBase, onRemove ? "pr-0.5" : "pr-2", role ? "border border-ink/20 bg-paper" : "dashed border-ink/40 text-ink-3")}
      title={role ? `@${role.name}` : `Role ${id} no longer exists`}
    >
      <RoleDot color={roleColor(role)} />
      <span className="truncate">{role ? `@${name}` : name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove @${name}`}
          className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-ink hover:text-stock"
        >
          <X size={13} />
        </button>
      ) : null}
    </span>
  );
}

export function MemberChip({ id, name, onRemove }: { id: string; name?: string; onRemove?: () => void }) {
  return (
    <span className={cx(chipBase, "border border-ink/20 bg-paper", onRemove ? "pr-0.5" : "pr-2")} title={name ? `${name} · ${id}` : id}>
      {name ? <span className="truncate">@{name}</span> : <span className="clock truncate text-[13px] font-semibold tracking-wide">{id}</span>}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name ? `@${name}` : `member ${id}`}`}
          className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-ink hover:text-stock"
        >
          <X size={13} />
        </button>
      ) : null}
    </span>
  );
}

/** "Add role" button opening a searchable list of the server's roles. */
export function RolePicker({
  roles,
  exclude,
  onPick,
  label = "Add role",
  disabled,
  unavailable,
}: {
  roles: GuildRole[];
  exclude: string[];
  onPick: (id: string) => void;
  label?: string;
  disabled?: boolean;
  /** Shown instead of the list when roles could not be loaded. */
  unavailable?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roles.filter((r) => !exclude.includes(r.id) && (!needle || r.name.toLowerCase().includes(needle)));
  }, [roles, exclude, q]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    input.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const close = (refocus = true) => {
    setOpen(false);
    setQ("");
    if (refocus) trigger.current?.focus();
  };

  const pick = (id: string) => {
    onPick(id);
    close();
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cx(
          "inline-flex h-7 items-center gap-1 rounded-[4px] border border-dashed border-ink/45 px-2 text-[13px] font-semibold text-ink-2",
          "transition-colors hover:border-ink hover:bg-ink hover:text-stock disabled:pointer-events-none disabled:opacity-50",
          open && "border-ink bg-ink text-stock",
        )}
      >
        <Plus size={13} /> {label}
      </button>
      {open ? (
        <div className="stub-in absolute left-0 top-[calc(100%+6px)] z-50 w-64 max-w-[calc(100vw-48px)] overflow-hidden rounded-[4px] border border-ink bg-paper shadow-[0_12px_32px_-12px_rgb(21_21_21/0.35)]">
          {unavailable ? (
            <p className="px-3 py-3 text-[13px] text-ink-2">{unavailable}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-rule px-2.5">
                <Search size={14} className="shrink-0 text-ink-3" aria-hidden />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
                  aria-label="Find a role"
                  placeholder="Find a role"
                  className="h-9 w-full bg-transparent text-sm text-ink placeholder:text-ink-3"
                  style={{ outline: "none" }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) => Math.min(options.length - 1, a + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(0, a - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (options[active]) pick(options[active].id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                    } else if (e.key === "Tab") {
                      close(false);
                    }
                  }}
                />
              </div>
              <ul id={listId} role="listbox" aria-label="Roles" className="max-h-60 overflow-y-auto py-1">
                {options.length === 0 ? (
                  <li className="px-3 py-2 text-[13px] text-ink-3">{q ? "No role matches." : "Every role is already here."}</li>
                ) : (
                  options.map((r, i) => (
                    <li
                      key={r.id}
                      id={`${listId}-${r.id}`}
                      role="option"
                      aria-selected={i === active}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => pick(r.id)}
                      className={cx(
                        "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                        i === active ? "bg-ink text-stock" : "text-ink",
                      )}
                    >
                      <RoleDot color={roleColor(r)} className={i === active ? "ring-1 ring-stock/60" : undefined} />
                      <span className="truncate">@{r.name}</span>
                      {r.managed ? <span className={cx("ml-auto shrink-0 text-[11px]", i === active ? "text-stock/70" : "text-ink-3")}>App role</span> : null}
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Paste a Discord user id (or pick a recent requester) to add a member. */
export function MemberAdder({
  known,
  exclude,
  onAdd,
  disabled,
  label,
}: {
  known: { id: string; username: string }[];
  exclude: string[];
  onAdd: (id: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const errId = useId();
  const suggestions = known.filter((k) => !exclude.includes(k.id));

  const submit = () => {
    const raw = value.trim().replace(/^<@!?(\d+)>$/, "$1");
    const byName = known.find((k) => k.username.toLowerCase() === raw.replace(/^@/, "").toLowerCase());
    const id = byName?.id ?? raw;
    if (!USER_ID.test(id)) {
      setError("Paste a member's user ID: in Discord, turn on Developer Mode, right-click the member, Copy User ID.");
      return;
    }
    if (exclude.includes(id)) {
      setError("Already on this list.");
      return;
    }
    onAdd(id);
    setValue("");
    setError(null);
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          list={suggestions.length ? listId : undefined}
          inputMode="numeric"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          placeholder="Member user ID"
          className="h-7 w-full min-w-0 max-w-[14rem] rounded-[4px] border border-ink/30 bg-paper px-2 text-[13px] text-ink placeholder:text-ink-3 transition-colors focus:border-ink focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[4px] border border-dashed border-ink/45 px-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink hover:bg-ink hover:text-stock disabled:pointer-events-none disabled:opacity-45"
        >
          <UserPlus size={13} /> Add
        </button>
        {suggestions.length ? (
          <datalist id={listId}>
            {suggestions.map((k) => (
              <option key={k.id} value={k.id} label={`@${k.username}`} />
            ))}
          </datalist>
        ) : null}
      </div>
      {error ? (
        <p id={errId} role="alert" className="mt-1 max-w-[30rem] text-[12px] leading-snug text-now">
          {error}
        </p>
      ) : null}
    </div>
  );
}
