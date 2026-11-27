"use client";

/**
 * Server settings, one section per concern with its own Save/Discard. Only
 * the fields that changed are sent (PATCH /settings); stage home channels go
 * through PUT /fleet/bindings and the channels each stage may serve through
 * PUT /permissions (stageChannels.ts). Members without the Settings
 * permission see every value read-only and who can change it.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGuildMeta, useGuildSave, useSettings } from "@/lib/dash/hooks";
import { useGuildLive } from "@/lib/dash/live";
import { Button, cx } from "../ui";
import { useToast } from "../Toast";
import { SectionFooter, SectionFrame } from "./controls";
import { list, outgoing, same, SECTIONS, validate } from "./model";
import type { Doc, SectionDef, SectionId } from "./model";
import { ChannelFields, CommandFields, LookFields, PlaybackFields, SafetyFields, StageRows, VoiceFields } from "./sections";
import { useStageChannels } from "./stageChannels";

const INTRO: Record<SectionId, string> = {
  playback: "Limits every bot in this server follows. Default volume applies when a bot starts its next queue.",
  voice: "When Bypass leaves a voice channel, and whether it stays around the clock.",
  channels: "Where members can use Bypass, and where it keeps its log.",
  stages:
    "Each bot is a stage with its own colour across the dashboard. Give a bot a home channel and it takes the music there; without one, the first free bot answers. A bot can also be kept to a list of channels.",
  look: "The language Bypass replies in and the colour of its messages.",
  commands: "Turn off commands you don't want members to use.",
  safety: "Members who can't use Bypass here.",
};

export function SettingsScreen() {
  const { fleet, me, refresh } = useGuildLive();
  const settings = useSettings();
  const meta = useGuildMeta();
  const save = useGuildSave();
  const toast = useToast();

  const readOnly = !me?.groups?.settings?.ok;
  const base = useMemo<Doc>(() => settings.data ?? {}, [settings.data]);

  // Draft: only touched keys live here; untouched keys follow the saved document.
  const [edits, setEdits] = useState<Doc>({});
  const get = useCallback((k: string) => (k in edits ? edits[k] : base[k]), [edits, base]);
  const set = useCallback((k: string, v: unknown) => setEdits((e) => ({ ...e, [k]: v })), []);
  const changedKeys = useCallback((sec: SectionDef) => sec.keys.filter((k) => k in edits && !same(k, edits[k], base[k])), [edits, base]);

  // Stage home channels: saved values from the fleet, overridden by what we saved here.
  const instances = useMemo(() => fleet?.instances ?? [], [fleet]);
  const [savedBindings, setSavedBindings] = useState<Record<number, string | null>>({});
  const [bindingEdits, setBindingEdits] = useState<Record<number, string | null>>({});
  const savedBinding = useCallback(
    (n: number) => (n in savedBindings ? savedBindings[n] : instances.find((i) => i.instance === n)?.binding.voiceChannelId ?? null),
    [instances, savedBindings],
  );
  const binding = useCallback((n: number) => (n in bindingEdits ? bindingEdits[n] : savedBinding(n)), [bindingEdits, savedBinding]);
  const changedBindings = instances.filter((i) => i.instance in bindingEdits && bindingEdits[i.instance] !== savedBinding(i.instance));
  const bindingErrors = useMemo(() => {
    const out: Record<number, string> = {};
    const seen = new Map<string, number>();
    for (const i of instances) {
      const v = binding(i.instance);
      if (!v || !i.inGuild) continue;
      const other = seen.get(v);
      if (other !== undefined) {
        // Flag the row that was just changed, naming the bot that already has the channel.
        const [flag, keep] = i.instance in bindingEdits || !(other in bindingEdits) ? [i.instance, other] : [other, i.instance];
        const name = meta.data?.voiceChannels.find((c) => c.id === v)?.name ?? "That channel";
        out[flag] = `${name} is already home to ${instances.find((x) => x.instance === keep)?.name}. A channel has one home bot.`;
      } else seen.set(v, i.instance);
    }
    return out;
  }, [instances, binding, bindingEdits, meta.data]);

  // Channels each stage may serve (permission config), saved with the home channels.
  const homeTouched = useCallback(
    (n: number) => n in bindingEdits && bindingEdits[n] !== savedBinding(n),
    [bindingEdits, savedBinding],
  );
  const scope = useStageChannels(instances, binding, homeTouched, save);

  const [saving, setSaving] = useState<SectionId | null>(null);
  const [savedAt, setSavedAt] = useState<Partial<Record<SectionId, number>>>({});
  const [failed, setFailed] = useState<Partial<Record<SectionId, string>>>({});

  const dirtyCount = (id: SectionId): number => {
    if (id === "stages") return changedBindings.length + scope.changed.length;
    const sec = SECTIONS.find((s) => s.id === id)!;
    return changedKeys(sec).length;
  };
  const errorsFor = (id: SectionId): Record<string, string> => (id === "stages" ? {} : validate(id, get));
  const dirtySections = SECTIONS.filter((s) => dirtyCount(s.id) > 0);

  // Warn before leaving the page with unsaved sections.
  const anyDirty = dirtySections.length > 0;
  useEffect(() => {
    if (!anyDirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [anyDirty]);

  const discard = (sec: SectionDef) => {
    if (sec.id === "stages") {
      setBindingEdits({});
      scope.discard();
    } else
      setEdits((e) => {
        const next = { ...e };
        for (const k of sec.keys) delete next[k];
        return next;
      });
    setFailed((f) => ({ ...f, [sec.id]: undefined }));
  };

  const saveSection = async (sec: SectionDef) => {
    setSaving(sec.id);
    setFailed((f) => ({ ...f, [sec.id]: undefined }));
    try {
      if (sec.id === "stages") {
        // Lists first: a list that now carries the new home channel is harmless
        // if the home change then fails, the reverse strands the bot.
        await scope.save();
        const done: Record<number, string | null> = {};
        for (const i of changedBindings) {
          const voiceChannelId = bindingEdits[i.instance] ?? null;
          await save("fleet/bindings", "PUT", { instance: i.instance, voiceChannelId });
          done[i.instance] = voiceChannelId;
        }
        setSavedBindings((s) => ({ ...s, ...done }));
        setBindingEdits({});
        void refresh();
      } else {
        const keys = changedKeys(sec);
        const body = Object.fromEntries(keys.map((k) => [k, outgoing(k, edits[k], base[k])]));
        const res = await save<{ ok?: boolean; settings?: Doc }>("settings", "PATCH", body);
        const next =
          res && typeof res === "object" && res.settings && typeof res.settings === "object" ? res.settings : { ...base, ...body };
        settings.setData(next);
        setEdits((e) => {
          const out = { ...e };
          for (const k of sec.keys) delete out[k];
          return out;
        });
      }
      setSavedAt((s) => ({ ...s, [sec.id]: Date.now() }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "the server didn't answer";
      setFailed((f) => ({ ...f, [sec.id]: msg }));
      toast.push({ tone: "error", title: `Couldn't save ${sec.title.toLowerCase()}`, detail: msg });
    } finally {
      setSaving(null);
    }
  };

  const ready = Boolean(settings.data);
  const active = useScrollSpy(
    SECTIONS.map((s) => s.id),
    ready,
  );
  useHashSection(ready);

  const guildName = fleet?.guild.name ?? "This server";
  const status = readOnly
    ? "Read only for you"
    : anyDirty
      ? `${dirtySections.length} section${dirtySections.length === 1 ? "" : "s"} not saved yet`
      : "Everything saved";

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
        <h1 className="bill text-[52px] leading-[0.85] sm:text-[60px]">Settings</h1>
        <p className="pb-1 text-[15px] text-ink-2">
          {guildName} · <span className={cx(anyDirty && !readOnly && "font-semibold text-ink")}>{status}</span>
        </p>
      </div>

      <div className="border-t-2 border-ink px-4 sm:px-6">
        {readOnly ? <CrewNotice reason={me?.groups?.settings?.reason} guildId={fleet?.guild.id} /> : null}

        {/* Mobile: section chips */}
        <nav
          aria-label="Settings sections"
          className="-mx-4 flex gap-1.5 overflow-x-auto border-b border-rule px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
              aria-current={active === s.id ? "true" : undefined}
              className={cx(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[4px] border px-3 text-[13px] font-semibold transition-colors",
                active === s.id ? "border-ink bg-ink text-stock" : "border-ink/25 text-ink hover:border-ink",
              )}
            >
              {s.title}
              {dirtyCount(s.id) > 0 ? <DirtyDot on={active === s.id} /> : null}
            </a>
          ))}
        </nav>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Desktop: sticky anchor list */}
          <nav aria-label="Settings sections" className="hidden lg:col-span-3 lg:block xl:col-span-2">
            <ul className="sticky top-[5.5rem] space-y-0.5 pt-8">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => jump(e, s.id)}
                    aria-current={active === s.id ? "true" : undefined}
                    className={cx(
                      "flex items-center justify-between gap-2 rounded-[4px] px-3 py-2 text-[15px] font-semibold transition-colors",
                      active === s.id ? "bg-ink text-stock" : "text-ink hover:bg-ink/[0.07]",
                    )}
                  >
                    <span>{s.title}</span>
                    {dirtyCount(s.id) > 0 ? <DirtyDot on={active === s.id} /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 lg:col-span-9 xl:col-span-8 xl:max-w-4xl">
            {settings.error && !settings.data ? (
              <LoadError message={settings.error} onRetry={() => void settings.reload()} />
            ) : !settings.data ? (
              <Skeleton />
            ) : (
              SECTIONS.map((sec) => {
                const errors = errorsFor(sec.id);
                const firstError = sec.id === "stages" ? Object.values(bindingErrors)[0] : Object.values(errors)[0];
                const props = { get, set, errors, readOnly };
                return (
                  <SectionFrame
                    key={sec.id}
                    id={sec.id}
                    title={sec.title}
                    intro={INTRO[sec.id]}
                    footer={
                      readOnly ? null : (
                        <SectionFooter
                          title={sec.title}
                          dirty={dirtyCount(sec.id)}
                          error={firstError}
                          saving={saving === sec.id}
                          savedAt={savedAt[sec.id]}
                          failed={failed[sec.id]}
                          onSave={() => void saveSection(sec)}
                          onDiscard={() => discard(sec)}
                        />
                      )
                    }
                  >
                    {sec.id === "playback" ? <PlaybackFields {...props} /> : null}
                    {sec.id === "voice" ? <VoiceFields {...props} meta={meta.data} /> : null}
                    {sec.id === "channels" ? <ChannelFields {...props} meta={meta.data} /> : null}
                    {sec.id === "stages" ? (
                      <StageRows
                        instances={instances}
                        binding={binding}
                        setBinding={(n, v) => setBindingEdits((b) => ({ ...b, [n]: v }))}
                        errors={bindingErrors}
                        readOnly={readOnly}
                        meta={meta.data}
                        scope={scope}
                        allowed={list(get("allowedVoiceChannels"))}
                      />
                    ) : null}
                    {sec.id === "look" ? <LookFields {...props} /> : null}
                    {sec.id === "commands" ? <CommandFields {...props} /> : null}
                    {sec.id === "safety" ? <SafetyFields {...props} /> : null}
                  </SectionFrame>
                );
              })
            )}
            {meta.error && settings.data ? (
              <p className="mt-6 text-[13px] text-ink-2">
                Channel names couldn&apos;t load ({meta.error}). Saved channels still apply.{" "}
                <button type="button" onClick={() => void meta.reload()} className="font-semibold text-ink underline underline-offset-2">
                  Try again
                </button>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

/**
 * Arriving with a section in the URL (e.g. #stages from Permissions): the
 * sections render once settings load, so scroll there then, and on later
 * hash changes.
 */
function useHashSection(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const go = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!SECTIONS.some((s) => s.id === id)) return;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [ready]);
}

/** The section whose heading sits nearest the top third of the viewport. */
function useScrollSpy(ids: string[], ready: boolean): string {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(",");
  const visible = useRef(new Map<string, boolean>());
  useEffect(() => {
    const els = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) visible.current.set(en.target.id, en.isIntersecting);
        const first = key.split(",").find((id) => visible.current.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    // At the very bottom the last short sections never reach the band.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(key.split(",").at(-1)!);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [key, ready]);
  return active;
}

function DirtyDot({ on }: { on: boolean }) {
  return (
    <>
      <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", on ? "bg-stock" : "bg-ink")} />
      <span className="sr-only">, unsaved changes</span>
    </>
  );
}

function CrewNotice({ reason, guildId }: { reason?: string; guildId?: string }) {
  return (
    <div className="mt-5 flex items-center gap-4 rounded-[4px] border border-ink bg-paper px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dash/band-red.webp" alt="" width={64} height={64} className="h-16 w-16 shrink-0" />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-ink">You can look, but only the crew can change these.</p>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-2">
          Changing settings needs Manage Server, the server&apos;s admin role, or a role allowed under{" "}
          {guildId ? (
            <Link
              href={`/servers/${guildId}/permissions`}
              className="font-semibold text-ink underline underline-offset-2 hover:no-underline"
            >
              Permissions → Settings
            </Link>
          ) : (
            "Permissions → Settings"
          )}
          .{reason ? ` ${reason}` : ""}
        </p>
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12">
      <p className="bill text-[34px]">Settings didn&apos;t load</p>
      <p className="mt-2 max-w-prose text-[15px] text-ink-2">{message}. Nothing was changed. Try again in a moment.</p>
      <Button variant="ink" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="pt-8">
      <div className="h-9 w-40 animate-pulse rounded-[4px] bg-ink/10" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-[4px] bg-ink/[0.06]" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}
