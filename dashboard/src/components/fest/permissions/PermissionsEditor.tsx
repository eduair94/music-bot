"use client";

/**
 * Permissions: who may do what, as festival wristbands. Edits collect in a
 * draft; a bottom strip saves or discards them. Members without the
 * Dashboard settings permission see the same screen read-only, with who
 * can change it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { isDemo } from "@/lib/dash/demo";
import { useGuildMeta, useGuildSave, usePermissions } from "@/lib/dash/hooks";
import { useGuildLive } from "@/lib/dash/live";
import { GROUPS } from "@/lib/dash/types";
import type { Group, GroupRule, PermissionConfig, RuleMode } from "@/lib/dash/types";
import { useToast } from "../Toast";
import { Button } from "../ui";
import { MemberCheck } from "./MemberCheck";
import type { CheckSubject } from "./MemberCheck";
import { configKey, describeChanges, normalize, pickableRoles, whoCanChange } from "./model";
import { SaveBar } from "./SaveBar";
import { DjRoles, HouseRules, SectionHead, StageChannels } from "./Sections";
import { StampMatrix } from "./StampMatrix";

type SaveResult = { ok?: boolean; config?: PermissionConfig } | PermissionConfig | null;

export function PermissionsEditor() {
  const { guildId, fleet, me } = useGuildLive();
  const perms = usePermissions();
  const meta = useGuildMeta();
  const save = useGuildSave();
  const toast = useToast();

  // Demo only: ?view=member previews the read-only screen a non-admin gets.
  const [memberView, setMemberView] = useState(false);
  useEffect(() => {
    if (isDemo(guildId)) setMemberView(new URLSearchParams(window.location.search).get("view") === "member");
  }, [guildId]);

  const base = useMemo(() => (perms.data ? normalize(perms.data) : null), [perms.data]);
  const [draft, setDraft] = useState<PermissionConfig | null>(base);
  const lastBase = useRef<PermissionConfig | null>(base);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // Adopt fresh server rules (another admin saved) unless mid-edit.
  useEffect(() => {
    if (!base) return;
    setDraft((d) => (!d || !lastBase.current || configKey(d) === configKey(lastBase.current) ? base : d));
    lastBase.current = base;
  }, [base]);

  const canEdit = Boolean(me?.groups.settings?.ok) && !memberView;
  const readOnly = !canEdit;
  const dirty = Boolean(base && draft && configKey(base) !== configKey(draft));
  const changes = useMemo(() => (base && draft && dirty ? describeChanges(base, draft) : []), [base, draft, dirty]);

  const roles = useMemo(() => pickableRoles(meta.data?.roles ?? [], guildId), [meta.data, guildId]);
  const roleById = useMemo(() => new Map((meta.data?.roles ?? []).map((r) => [r.id, r])), [meta.data]);
  const rolesUnavailable = meta.error ? "Couldn't load this server's roles. Reload the page to try again." : !meta.data ? "Loading roles…" : null;

  // Members we can name: whoever requested something on the bill, and you.
  const known = useMemo(() => {
    const m = new Map<string, string>();
    if (me) m.set(me.userId, me.username);
    for (const i of fleet?.instances ?? []) {
      const p = i.playback;
      for (const t of [p?.currentTrack, ...(p?.queue ?? [])]) if (t?.requestedBy) m.set(t.requestedBy.id, t.requestedBy.username);
    }
    return [...m.entries()].map(([id, username]) => ({ id, username }));
  }, [fleet, me]);

  const [subject, setSubject] = useState<CheckSubject>("everyone");
  const subjectTouched = useRef(false);
  useEffect(() => {
    if (!subjectTouched.current && me && readOnly) setSubject("me");
  }, [me, readOnly]);

  const edit = useCallback((fn: (c: PermissionConfig) => PermissionConfig) => {
    setSaveError(null);
    setDraft((d) => (d ? fn(d) : d));
  }, []);
  const onMode = useCallback(
    (g: Group, mode: RuleMode) => edit((c) => ({ ...c, groups: { ...c.groups, [g]: { ...c.groups[g], mode } } })),
    [edit],
  );
  const onRule = useCallback(
    (g: Group, patch: Partial<GroupRule>) => edit((c) => ({ ...c, groups: { ...c.groups, [g]: { ...c.groups[g], ...patch } } })),
    [edit],
  );

  const discard = useCallback(() => {
    if (!base) return;
    setDraft(base);
    setSaveError(null);
    setResetKey((k) => k + 1);
  }, [base]);

  const commit = useCallback(async () => {
    if (!draft || !base || saving || readOnly) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await save<SaveResult>("permissions", "PUT", draft);
      if (res && "ok" in res && res.ok === false) throw new Error("the server did not accept these rules");
      const fromServer = res && "config" in res && res.config ? res.config : res && "groups" in res ? res : draft;
      const next = normalize(fromServer as PermissionConfig);
      const what = describeChanges(base, next);
      lastBase.current = next;
      perms.setData(next);
      setDraft(next);
      setResetKey((k) => k + 1);
      toast.push({
        title: "Permissions saved",
        detail: what.length ? `${what.slice(0, 3).join(" · ")}${what.length > 3 ? ` · ${what.length - 3} more` : ""}` : undefined,
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setSaving(false);
    }
  }, [draft, base, saving, readOnly, save, perms, toast]);

  // Ctrl/Cmd+S saves; leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void commit();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, commit]);

  const roleName = (id: string) => roleById.get(id)?.name ?? "deleted role";
  const counts = draft
    ? GROUPS.reduce((acc, g) => ({ ...acc, [draft.groups[g].mode]: (acc[draft.groups[g].mode] ?? 0) + 1 }), {} as Partial<Record<RuleMode, number>>)
    : {};

  return (
    <div className="px-4 pb-32 sm:px-6">
      {/* Title row */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-3 pt-4">
        <h1 className="bill text-[52px] leading-[0.85] sm:text-[60px]">Permissions</h1>
        {draft ? (
          readOnly ? (
            <p className="flex items-center gap-1.5 pb-1 text-[15px] text-ink-2">
              <Lock size={15} className="shrink-0" aria-hidden />
              {me ? `Read-only. ${whoCanChange(base ?? draft, roleName)}` : "Checking your access…"}
            </p>
          ) : (
            <p className="pb-1 text-[15px] text-ink-2">
              {fleet?.guild.name ? `${fleet.guild.name} · ` : ""}
              {counts.everyone ?? 0} open to everyone · {counts.dj ?? 0} for DJs · {counts.admins ?? 0} admins only
            </p>
          )
        ) : null}
      </div>

      {!draft ? (
        perms.error ? (
          <div className="mt-6 max-w-xl border-t-2 border-ink pt-5">
            <p className="text-[15px] text-ink-2">Couldn&apos;t load this server&apos;s permissions: {perms.error}.</p>
            <Button variant="ink" className="mt-4" onClick={() => void perms.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <div aria-busy="true" aria-label="Loading permissions" className="mt-4 grid gap-10 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-8">
              <div className="h-28 animate-pulse rounded-[4px] bg-ink/[0.07]" />
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-[4px] bg-ink/[0.05]" style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
            <div className="hidden h-96 animate-pulse rounded-[4px] bg-ink/[0.05] xl:col-span-4 xl:block" />
          </div>
        )
      ) : (
        <div className="grid gap-x-12 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <section aria-labelledby="perm-who" className="mt-6">
              <SectionHead id="perm-who" title="Who can do what">
                {readOnly
                  ? "The wristband each action needs. Exceptions let specific roles and members in, or keep them out."
                  : "Stamp the wristband each action needs. Exceptions let specific roles and members in, or keep them out."}
              </SectionHead>
              <StampMatrix
                config={draft}
                readOnly={readOnly}
                roles={roles}
                roleById={roleById}
                rolesUnavailable={rolesUnavailable}
                known={known}
                onMode={onMode}
                onRule={onRule}
              />
            </section>

            <DjRoles
              config={draft}
              readOnly={readOnly}
              roles={roles}
              roleById={roleById}
              rolesUnavailable={rolesUnavailable}
              onChange={(djRoles) => edit((c) => ({ ...c, djRoles }))}
            />

            <HouseRules config={draft} readOnly={readOnly} onChange={(options) => edit((c) => ({ ...c, options }))} />

            <StageChannels
              key={resetKey}
              config={draft}
              readOnly={readOnly}
              instances={fleet?.instances ?? []}
              meta={meta.data}
              metaError={meta.error ? "Couldn't load the voice channels. Reload the page to try again." : null}
              onChange={(instance, channels) =>
                edit((c) => ({ ...c, instanceChannels: { ...c.instanceChannels, [String(instance)]: channels } }))
              }
            />
          </div>

          <aside className="min-w-0 xl:col-span-4">
            <div className="xl:sticky xl:top-[calc(4rem+26px)] xl:mt-6 xl:max-h-[calc(100dvh-4rem-40px)] xl:overflow-y-auto xl:pb-4">
              <MemberCheck
                config={draft}
                roles={roles}
                roleById={roleById}
                me={me}
                dirty={dirty}
                subject={subject}
                onSubject={(s) => {
                  subjectTouched.current = true;
                  setSubject(s);
                }}
              />
            </div>
          </aside>
        </div>
      )}

      <SaveBar dirty={dirty && !readOnly} saving={saving} error={saveError} changes={changes} onDiscard={discard} onSave={() => void commit()} />
    </div>
  );
}
