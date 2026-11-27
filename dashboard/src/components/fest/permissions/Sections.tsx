"use client";

/**
 * The quieter sections of the permission editor: DJ roles and house rules.
 * Standard controls. (Which voice channels each stage may serve lives in
 * Settings › Stages, next to its home channel.)
 */
import type { ReactNode } from "react";
import type { GuildRole, PermissionConfig } from "@/lib/dash/types";
import { cx, FieldRow, Slider, Switch } from "../ui";
import { clampPct } from "./model";
import { RoleChip, RolePicker } from "./RolePicker";

export function SectionHead({ id, title, children, art }: { id: string; title: string; children?: ReactNode; art?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end gap-4">
      {art}
      <div className="min-w-0">
        <h2 id={id} className="bill text-balance text-[34px] sm:text-[40px]">
          {title}
        </h2>
        {children ? <div className="mt-1.5 max-w-[68ch] text-[14px] leading-snug text-ink-2">{children}</div> : null}
      </div>
    </div>
  );
}

// ── DJ roles ────────────────────────────────────────────────────────────────

export function DjRoles({
  config,
  readOnly,
  roles,
  roleById,
  rolesUnavailable,
  onChange,
}: {
  config: PermissionConfig;
  readOnly: boolean;
  roles: GuildRole[];
  roleById: Map<string, GuildRole>;
  rolesUnavailable: string | null;
  onChange: (ids: string[]) => void;
}) {
  const ids = config.djRoles;
  return (
    <section aria-labelledby="perm-dj" className="mt-16">
      <SectionHead
        id="perm-dj"
        title="DJ roles"
        art={
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/dash/band-blue.webp" alt="" width={72} height={72} className="-mb-2 hidden h-[72px] w-[72px] shrink-0 object-cover sm:block" />
        }
      >
        DJs and admins pass &ldquo;DJs&rdquo; rules. Admins are members with Manage Server or the admin role.
      </SectionHead>
      <div className="flex flex-wrap items-center gap-1.5 border-y border-rule py-3.5">
        {ids.map((id) => (
          <RoleChip
            key={id}
            id={id}
            role={roleById.get(id)}
            removeLabel={`Remove @${roleById.get(id)?.name ?? "deleted role"} from DJ roles`}
            onRemove={readOnly ? undefined : () => onChange(ids.filter((r) => r !== id))}
          />
        ))}
        {!ids.length ? <span className="mr-2 text-[13px] text-ink-3">No DJ roles. Only admins pass DJs rules.</span> : null}
        {readOnly ? null : (
          <RolePicker label="Add DJ role" roles={roles} exclude={ids} unavailable={rolesUnavailable} onPick={(id) => onChange([...ids, id])} />
        )}
      </div>
    </section>
  );
}

// ── House rules ─────────────────────────────────────────────────────────────

export function HouseRules({
  config,
  readOnly,
  onChange,
}: {
  config: PermissionConfig;
  readOnly: boolean;
  onChange: (o: PermissionConfig["options"]) => void;
}) {
  const o = config.options;
  return (
    <section aria-labelledby="perm-house" className="mt-16">
      <SectionHead id="perm-house" title="House rules">
        Exceptions that apply across the board, on top of the wristbands.
      </SectionHead>
      <div className="border-y border-rule">
        <FieldRow label="Requesters can skip or remove their own songs" hint="Works even where Skip or Reorder and remove need a DJ.">
          <div className="flex justify-end">
            <Switch
              label="Requesters can skip or remove their own songs"
              checked={o.requesterCanSkipOwn}
              disabled={readOnly}
              onChange={(v) => onChange({ ...o, requesterCanSkipOwn: v })}
            />
          </div>
        </FieldRow>
        <FieldRow label="Alone with the bot counts as DJ" hint="A member who is the only listener in the bot's voice channel passes DJs rules.">
          <div className="flex justify-end">
            <Switch label="Alone with the bot counts as DJ" checked={o.aloneIsDj} disabled={readOnly} onChange={(v) => onChange({ ...o, aloneIsDj: v })} />
          </div>
        </FieldRow>
        <FieldRow
          label="Vote to skip"
          hint={
            o.voteSkip.enabled
              ? `Members who can't skip start a vote. The song skips once ${o.voteSkip.percentage}% of the listeners agree.`
              : "Members who can't skip can start a vote instead."
          }
        >
          <div className="flex items-center justify-end gap-3">
            <Slider
              label="Share of listeners needed to skip"
              min={10}
              max={100}
              step={5}
              value={o.voteSkip.percentage}
              disabled={readOnly || !o.voteSkip.enabled}
              onChange={(v) => onChange({ ...o, voteSkip: { ...o.voteSkip, percentage: clampPct(v) } })}
              className="min-w-0 flex-1"
            />
            <output className={cx("clock w-12 shrink-0 text-right text-[19px]", !o.voteSkip.enabled && "text-ink-3")}>{o.voteSkip.percentage}%</output>
            <Switch
              label="Vote to skip"
              checked={o.voteSkip.enabled}
              disabled={readOnly}
              onChange={(v) => onChange({ ...o, voteSkip: { ...o.voteSkip, enabled: v } })}
            />
          </div>
        </FieldRow>
      </div>
    </section>
  );
}
