"use client";

/**
 * "Who can do what": every action group against the three wristbands.
 * Each row is a radio group; picking a wristband stamps the cell in that
 * band's ink, the impression spreading from where you pressed (from the
 * centre with the keyboard). Exceptions fold out under each row.
 */
import { useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { AlertTriangle, Ban, Check, ChevronDown } from "lucide-react";
import { GROUPS } from "@/lib/dash/types";
import type { Group, GroupRule, GuildRole, PermissionConfig, RuleMode } from "@/lib/dash/types";
import { cx } from "../ui";
import { GROUP_INFO, MODE, MODE_RANK, MODES, roleColor } from "./model";
import { MemberAdder, MemberChip, RoleChip, RoleDot, RolePicker } from "./RolePicker";

/**
 * A real rubber-stamp impression (worn edges, speckle, a dry corner, a
 * knocked-out frame line), stretched over the cell as an alpha mask so the
 * band colour prints through it and the label stays live text.
 */
const INK_MASK = "url(/dash/stamp-ink.webp)";

/** A hand-stamped impression never lands perfectly square. */
const TILT = [-1.6, 1.1, -0.6, 1.5, -1.2, 0.7, -1.8, 1.3, -0.9, 0.5];

/** One plate, four ways round, so neighbouring rows don't wear the same dry patch. */
const FLIP: [number, number][] = [
  [1, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
];

const ROW_COLS = "md:grid-cols-[minmax(12rem,1fr)_minmax(20rem,27rem)]";

/** Where the stamp was pressed, in % of the cell (50/50 from the keyboard). */
interface StampOrigin {
  n: number;
  x: number;
  y: number;
}

export interface MatrixProps {
  config: PermissionConfig;
  readOnly: boolean;
  roles: GuildRole[];
  roleById: Map<string, GuildRole>;
  rolesUnavailable: string | null;
  known: { id: string; username: string }[];
  onMode: (group: Group, mode: RuleMode) => void;
  onRule: (group: Group, patch: Partial<GroupRule>) => void;
}

export function StampMatrix(props: MatrixProps) {
  const { config } = props;
  const [open, setOpen] = useState<Set<Group>>(() => new Set());
  const [stamps, setStamps] = useState<Partial<Record<Group, StampOrigin>>>({});
  const seq = useRef(0);

  const stamp = (group: Group, mode: RuleMode, x = 50, y = 50) => {
    if (props.readOnly || config.groups[group].mode === mode) return;
    seq.current += 1;
    setStamps((s) => ({ ...s, [group]: { n: seq.current, x, y } }));
    props.onMode(group, mode);
  };

  const toggle = (g: Group) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <div>
      {/* Wristband legend doubles as the column header. */}
      <div className={cx("grid items-end gap-x-6 border-b-2 border-ink pb-3", ROW_COLS)}>
        <p className="hidden max-w-[36ch] items-start gap-2 pb-1 text-[13px] leading-snug text-ink-3 md:flex">
          <span aria-hidden className="mt-px flex h-[18px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border border-dashed border-ink/30">
            <Check size={12} strokeWidth={2.25} className="text-ink-3" />
          </span>
          <span>Also passes. Admins pass every rule, and DJs pass Everyone rules.</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <div key={m.mode} className="flex min-w-0 flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.band} alt="" width={96} height={64} className="h-14 w-[84px] object-cover sm:h-16 sm:w-24" />
              <span className="bill mt-1 text-[22px] sm:text-[26px]">{m.name}</span>
              <span className="mt-0.5 text-[11.5px] leading-tight text-ink-3 sm:text-[12px]">{m.who}</span>
            </div>
          ))}
        </div>
      </div>

      {config.djRoles.length === 0 ? (
        <p className="flex items-start gap-2 border-b border-rule py-2.5 text-[13px] text-ink-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-now" aria-hidden />
          No DJ roles yet, so rows stamped DJs are admins-only for now. Pick DJ roles below.
        </p>
      ) : null}

      <div>
        {GROUPS.map((g, i) => (
          <Row
            key={g}
            index={i}
            group={g}
            {...props}
            rule={config.groups[g]}
            origin={stamps[g]}
            expanded={open.has(g)}
            onToggle={() => toggle(g)}
            onStamp={(mode, x, y) => stamp(g, mode, x, y)}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  index,
  group,
  rule,
  origin,
  expanded,
  onToggle,
  onStamp,
  readOnly,
  roleById,
  ...rest
}: MatrixProps & {
  index: number;
  group: Group;
  rule: GroupRule;
  origin?: StampOrigin;
  expanded: boolean;
  onToggle: () => void;
  onStamp: (mode: RuleMode, x?: number, y?: number) => void;
}) {
  const info = GROUP_INFO[group];
  const labelId = useId();
  const panelId = useId();
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = MODE_RANK[rule.mode];
  const count = rule.allowRoles.length + rule.denyRoles.length + rule.allowUsers.length + rule.denyUsers.length;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (selected + keys[e.key] + MODES.length) % MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODES.length - 1;
    if (next === null) return;
    e.preventDefault();
    cells.current[next]?.focus();
    if (!readOnly) onStamp(MODES[next].mode);
  };

  const onCell = (mode: RuleMode) => (e: MouseEvent<HTMLButtonElement>) => {
    // Keyboard activation (detail 0) stamps from the centre.
    if (e.detail === 0) return onStamp(mode);
    const r = e.currentTarget.getBoundingClientRect();
    onStamp(mode, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };

  const summary = [
    ...rule.allowRoles.map((id) => ({ kind: "allow" as const, id, role: roleById.get(id) })),
    ...rule.denyRoles.map((id) => ({ kind: "deny" as const, id, role: roleById.get(id) })),
  ];
  const memberCount = rule.allowUsers.length + rule.denyUsers.length;

  return (
    <div className="border-b border-rule">
      <div className={cx("grid gap-x-6 gap-y-2.5 py-3.5", ROW_COLS, "md:items-center")}>
        <div className="min-w-0">
          <h3 id={labelId} className="text-[15px] font-semibold leading-snug text-ink">
            {info.name}
          </h3>
          <p className="text-[13px] leading-snug text-ink-3">{info.description}</p>
          {group === "settings" && rule.mode !== "admins" ? (
            <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug text-now">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
              {rule.mode === "everyone" ? "Anyone in the server could change these permissions." : "DJs could change these permissions."}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="-ml-1 inline-flex h-7 items-center gap-1 rounded-[4px] px-1 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-ink/[0.07] hover:text-ink"
            >
              <ChevronDown size={14} className={cx("transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]", !expanded && "-rotate-90")} aria-hidden />
              Exceptions
              {count ? <span className="clock ml-0.5 rounded-[3px] bg-ink px-1 text-[12px] leading-[18px] text-stock">{count}</span> : null}
            </button>
            {!expanded && count ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-ink-2">
                {summary.slice(0, 3).map((s) => (
                  <span key={`${s.kind}-${s.id}`} className="inline-flex min-w-0 items-center gap-1">
                    <span className={cx("font-semibold", s.kind === "deny" ? "text-now" : "text-ink-3")}>{s.kind === "allow" ? "Allow" : "Deny"}</span>
                    <RoleDot color={roleColor(s.role)} className="ml-0.5 h-2 w-2" />
                    <span className="truncate">{s.role ? `@${s.role.name}` : "Deleted role"}</span>
                  </span>
                ))}
                {summary.length > 3 ? <span>+{summary.length - 3} more</span> : null}
                {memberCount ? (
                  <span>
                    {summary.length ? "and " : ""}
                    {memberCount} member{memberCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>

        <div role="radiogroup" aria-labelledby={labelId} aria-readonly={readOnly || undefined} onKeyDown={onKey} className="grid grid-cols-3 gap-2">
          {MODES.map((m, mi) => {
            const checked = rule.mode === m.mode;
            const implied = mi > selected;
            return (
              <button
                key={m.mode}
                ref={(el) => {
                  cells.current[mi] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={m.name}
                aria-disabled={readOnly || undefined}
                tabIndex={checked ? 0 : -1}
                onClick={onCell(m.mode)}
                title={implied ? `${m.name} pass this too` : undefined}
                className={cx(
                  "group relative h-14 rounded-[4px] md:h-[60px]",
                  readOnly ? "cursor-default" : checked ? "cursor-default" : "cursor-pointer",
                )}
                style={{ "--c": m.color, "--t": m.tint } as React.CSSProperties}
              >
                <span
                  aria-hidden
                  className={cx(
                    "absolute inset-1.5 flex items-center justify-center rounded-[3px] border border-dashed border-ink/25 transition-[border-color,background-color] duration-150",
                    !readOnly && !checked && "group-hover:border-[var(--c)] group-hover:bg-[var(--t)]/60",
                  )}
                >
                  {checked ? null : implied ? (
                    <Check size={16} strokeWidth={2.25} className="text-ink-3/70" />
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3/80 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:group-focus-visible:opacity-100">
                      {m.name}
                    </span>
                  )}
                </span>
                {checked ? <Stamp key={origin?.n ?? 0} mode={m.mode} tilt={TILT[index % TILT.length]} flip={FLIP[index % FLIP.length]} origin={origin} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {expanded ? (
        <div id={panelId} className="mb-4 grid gap-x-8 gap-y-5 rounded-[4px] border border-rule bg-paper/70 px-4 py-4 sm:grid-cols-2">
          <ListEditor kind="allow" group={group} rule={rule} readOnly={readOnly} roleById={roleById} {...rest} />
          <ListEditor kind="deny" group={group} rule={rule} readOnly={readOnly} roleById={roleById} {...rest} />
          <p className="text-[12px] text-ink-3 sm:col-span-2">Deny beats allow. Admins always pass.</p>
        </div>
      ) : (
        <div id={panelId} hidden />
      )}
    </div>
  );
}

function Stamp({ mode, tilt, flip, origin }: { mode: RuleMode; tilt: number; flip: [number, number]; origin?: StampOrigin }) {
  const m = MODE[mode];
  const [fx, fy] = flip;
  // The ink layer is flipped, so mirror the press point into its coordinates.
  const x = origin ? (fx < 0 ? 100 - origin.x : origin.x) : 50;
  const y = origin ? (fy < 0 ? 100 - origin.y : origin.y) : 50;
  return (
    <span
      aria-hidden
      className={cx("absolute inset-1 flex items-center justify-center", origin && "stamp-in")}
      style={
        {
          background: m.color,
          color: m.on,
          transform: `rotate(${tilt}deg) scale(${fx}, ${fy})`,
          WebkitMaskImage: INK_MASK,
          maskImage: INK_MASK,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          "--sx": `${x.toFixed(1)}%`,
          "--sy": `${y.toFixed(1)}%`,
        } as React.CSSProperties
      }
    >
      <span className="bill relative inline-block text-[21px] leading-none md:text-[24px]" style={{ transform: `scale(${fx}, ${fy})` }}>
        {m.stamp}
      </span>
    </span>
  );
}

function ListEditor({
  kind,
  group,
  rule,
  readOnly,
  roles,
  roleById,
  rolesUnavailable,
  known,
  onRule,
}: MatrixProps & { kind: "allow" | "deny"; group: Group; rule: GroupRule }) {
  const roleKey = kind === "allow" ? "allowRoles" : "denyRoles";
  const userKey = kind === "allow" ? "allowUsers" : "denyUsers";
  const roleIds = rule[roleKey];
  const userIds = rule[userKey];
  const name = GROUP_INFO[group].name;
  const knownName = (id: string) => known.find((k) => k.id === id)?.username;
  const Icon = kind === "allow" ? Check : Ban;

  return (
    <div className="min-w-0">
      <h4 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink">
        <Icon size={14} aria-hidden /> {kind === "allow" ? "Allow" : "Deny"}
      </h4>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">
        {kind === "allow" ? "Always let these in, whatever the wristband says." : "Never let these in, even with the right wristband."}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {roleIds.map((id) => (
          <RoleChip
            key={id}
            id={id}
            role={roleById.get(id)}
            removeLabel={`Remove @${roleById.get(id)?.name ?? "deleted role"} from ${kind} for ${name}`}
            onRemove={readOnly ? undefined : () => onRule(group, { [roleKey]: roleIds.filter((r) => r !== id) })}
          />
        ))}
        {userIds.map((id) => (
          <MemberChip key={id} id={id} name={knownName(id)} onRemove={readOnly ? undefined : () => onRule(group, { [userKey]: userIds.filter((u) => u !== id) })} />
        ))}
        {readOnly ? (
          !roleIds.length && !userIds.length ? <span className="text-[13px] text-ink-3">Nobody</span> : null
        ) : (
          <RolePicker
            roles={roles}
            exclude={roleIds}
            unavailable={rolesUnavailable}
            onPick={(id) => onRule(group, { [roleKey]: [...roleIds, id] })}
          />
        )}
      </div>
      {readOnly ? null : (
        <div className="mt-2">
          <MemberAdder
            label={`Add a member to ${kind} for ${name}`}
            known={known}
            exclude={userIds}
            onAdd={(id) => onRule(group, { [userKey]: [...userIds, id] })}
          />
        </div>
      )}
    </div>
  );
}
