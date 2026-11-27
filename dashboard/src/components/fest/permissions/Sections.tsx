"use client";

/**
 * The quieter sections of the permission editor: DJ roles, house rules and
 * which voice channels each stage may serve. Standard controls; the stage
 * colours mark which bot a scope belongs to.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Volume2 } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, GuildMeta, GuildRole, PermissionConfig } from "@/lib/dash/types";
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

// ── Stages and channels ─────────────────────────────────────────────────────

export function StageChannels({
  config,
  readOnly,
  instances,
  meta,
  metaError,
  onChange,
}: {
  config: PermissionConfig;
  readOnly: boolean;
  instances: FleetInstance[];
  meta: GuildMeta | null;
  metaError: string | null;
  onChange: (instance: number, channels: string[]) => void;
}) {
  // Stages switched off "Any channel" before a channel is ticked.
  const [restricting, setRestricting] = useState<Set<number>>(() => new Set());

  const groups = useMemo(() => {
    const out = new Map<string, { id: string; name: string }[]>();
    for (const c of meta?.voiceChannels ?? []) {
      const k = c.parentName ?? "";
      out.set(k, [...(out.get(k) ?? []), c]);
    }
    return [...out.entries()];
  }, [meta]);
  const channelName = (id: string) => meta?.voiceChannels.find((c) => c.id === id)?.name;

  return (
    <section aria-labelledby="perm-stages" className="mt-16">
      <SectionHead id="perm-stages" title="Stages and channels">
        Which voice channels each bot may serve. A bot on any channel goes wherever it&apos;s called.
      </SectionHead>
      {!instances.length ? (
        <p className="dashed rounded-[4px] px-4 py-6 text-center text-[14px] text-ink-3">No bots on this server&apos;s bill yet.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {instances.map((inst) => {
            const s = stage(inst.instance);
            const key = String(inst.instance);
            const chosen = config.instanceChannels[key] ?? [];
            const any = chosen.length === 0 && !restricting.has(inst.instance);
            const home = inst.binding.voiceChannelId;
            const homeOutside = !any && home && chosen.length > 0 && !chosen.includes(home);
            const status = !inst.inGuild ? "Not in this server yet" : !inst.online ? "Off air" : inst.playback?.isConnected ? `In ${inst.playback.voiceChannelName ?? "voice"}` : "On the bench";
            return (
              <div key={inst.instance} className="min-w-0">
                <div
                  aria-hidden
                  className="h-2"
                  style={
                    inst.inGuild
                      ? { background: s.color }
                      : { backgroundImage: `linear-gradient(to right, ${s.color} 60%, transparent 0)`, backgroundSize: "14px 8px" }
                  }
                />
                <div className="mt-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={cx("bill truncate text-[30px]", !inst.inGuild && "text-ink-3")}>{inst.name}</h3>
                    <p className="mt-0.5 text-[13px] font-semibold text-ink-2">{status}</p>
                  </div>
                  <label className="mt-1 flex shrink-0 items-center gap-2 text-[13px] font-semibold text-ink">
                    Any channel
                    <Switch
                      label={`${inst.name} may serve any channel`}
                      checked={any}
                      disabled={readOnly}
                      color={s.color}
                      onChange={(v) => {
                        setRestricting((r) => {
                          const n = new Set(r);
                          if (v) n.delete(inst.instance);
                          else n.add(inst.instance);
                          return n;
                        });
                        if (v) onChange(inst.instance, []);
                      }}
                    />
                  </label>
                </div>

                {any ? (
                  <p className="dashed mt-3 rounded-[4px] px-3 py-2.5 text-[13px] text-ink-3">Serves any voice channel in the server.</p>
                ) : metaError || !meta ? (
                  <p className="mt-3 text-[13px] text-ink-3">{metaError ?? "Loading voice channels…"}</p>
                ) : (
                  <div className="mt-3">
                    {chosen.length === 0 ? (
                      <p className="mb-2 flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug text-now">
                        <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
                        Tick at least one channel. Until then {inst.name} serves any channel.
                      </p>
                    ) : null}
                    <fieldset disabled={readOnly} className="min-w-0">
                      <legend className="sr-only">Voice channels {inst.name} may serve</legend>
                      {groups.map(([parent, chans]) => (
                        <div key={parent || "none"} className="mb-1.5">
                          {parent ? <p className="pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">{parent}</p> : null}
                          <ul className="grid gap-x-3 lg:grid-cols-2">
                            {chans.map((c) => {
                              const on = chosen.includes(c.id);
                              return (
                                <li key={c.id}>
                                  <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-[3px] px-1 text-[14px] text-ink transition-colors hover:bg-ink/[0.05] has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => onChange(inst.instance, on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])}
                                      className="h-4 w-4 shrink-0 cursor-pointer disabled:cursor-default"
                                      style={{ accentColor: s.color }}
                                    />
                                    <Volume2 size={14} className="shrink-0 text-ink-3" aria-hidden />
                                    <span className="truncate">{c.name}</span>
                                    {c.id === home ? <span className="shrink-0 text-[11.5px] text-ink-3">home</span> : null}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </fieldset>
                    {homeOutside ? (
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-2">
                        Its home channel, {channelName(home!) ?? "set in Settings"}, is not on this list.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
