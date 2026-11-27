"use client";

/**
 * The bodies of each settings section. Each reads and writes the page draft
 * through `get`/`set`; saving and the footer live in SettingsScreen.
 */
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Volume2 } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, GuildMeta } from "@/lib/dash/types";
import { FieldRow, Select, Switch, TextInput, cx } from "../ui";
import { ChannelOptions, ChannelSet, ChipList, FieldError, ListAdder, NumberField, PercentField } from "./controls";
import type { ChannelOption } from "./controls";
import type { StageChannelScope } from "./stageChannels";
import { fmtSeconds, LANGUAGES, LEAVE_PRESETS, list, normLanguage, num, STAGE_COLOUR_NAMES, stay247Of } from "./model";

export interface SectionProps {
  get: (k: string) => unknown;
  set: (k: string, v: unknown) => void;
  errors: Record<string, string>;
  readOnly: boolean;
}

export function voiceOptions(meta: GuildMeta | null): ChannelOption[] {
  return (meta?.voiceChannels ?? []).map((c) => ({ id: c.id, name: c.name, group: c.parentName }));
}

export function textOptions(meta: GuildMeta | null): ChannelOption[] {
  return (meta?.textChannels ?? []).map((c) => ({ id: c.id, name: c.name }));
}

// ── Playback ────────────────────────────────────────────────────────────────

export function PlaybackFields({ get, set, errors, readOnly }: SectionProps) {
  const maxSec = num(get("maxSongDuration"), Number.NaN);
  const minutes = Number.isFinite(maxSec) ? Math.round((maxSec / 60) * 100) / 100 : Number.NaN;
  return (
    <>
      <FieldRow label="Default volume" htmlFor="defaultVolume" hint="Where the volume starts when Bypass begins a new queue.">
        <PercentField
          id="defaultVolume"
          label="Default volume"
          value={num(get("defaultVolume"), 80)}
          onChange={(v) => set("defaultVolume", v)}
          disabled={readOnly}
          error={errors.defaultVolume}
        />
      </FieldRow>
      <FieldRow label="Max volume" htmlFor="maxVolume" hint="Nobody can turn a bot above this, from Discord or here.">
        <PercentField
          id="maxVolume"
          label="Max volume"
          value={num(get("maxVolume"), 100)}
          onChange={(v) => set("maxVolume", v)}
          disabled={readOnly}
          error={errors.maxVolume}
        />
      </FieldRow>
      <FieldRow label="Queue limit" htmlFor="maxQueueSize" hint="Most songs a queue can hold, 1 to 1,000.">
        <NumberField
          id="maxQueueSize"
          value={num(get("maxQueueSize"), Number.NaN)}
          min={1}
          max={1000}
          suffix="songs"
          onChange={(v) => set("maxQueueSize", v)}
          disabled={readOnly}
          error={errors.maxQueueSize}
        />
      </FieldRow>
      <FieldRow label="Longest song" htmlFor="maxSongDuration" hint="Songs longer than this are refused. 0 means no limit.">
        <NumberField
          id="maxSongDuration"
          value={minutes}
          min={0}
          suffix="min"
          onChange={(v) => set("maxSongDuration", Number.isFinite(v) ? v * 60 : Number.NaN)}
          disabled={readOnly}
          error={errors.maxSongDuration}
        />
      </FieldRow>
      <FieldRow label="Block duplicates" hint="Refuse a song that is already waiting in the queue.">
        <div className="flex sm:justify-end">
          <Switch
            label="Block duplicates"
            checked={Boolean(get("preventDuplicates"))}
            onChange={(v) => set("preventDuplicates", v)}
            disabled={readOnly}
          />
        </div>
      </FieldRow>
      <FieldRow label="Autoplay" hint="When the queue runs out, keep going with similar songs.">
        <div className="flex sm:justify-end">
          <Switch label="Autoplay" checked={Boolean(get("autoplay"))} onChange={(v) => set("autoplay", v)} disabled={readOnly} />
        </div>
      </FieldRow>
      <FieldRow
        label="Vote to skip"
        htmlFor="voteSkipPercentage"
        hint="Share of the listeners in the channel who must vote before a song is skipped."
      >
        <PercentField
          id="voteSkipPercentage"
          label="Votes needed to skip"
          value={num(get("voteSkipPercentage"), 50)}
          min={1}
          onChange={(v) => set("voteSkipPercentage", v)}
          disabled={readOnly}
          error={errors.voteSkipPercentage}
        />
      </FieldRow>
    </>
  );
}

// ── Voice ───────────────────────────────────────────────────────────────────

export function VoiceFields({ get, set, errors, readOnly, meta }: SectionProps & { meta: GuildMeta | null }) {
  const timeout = num(get("autoLeaveTimeout"), 300);
  const presets =
    LEAVE_PRESETS.includes(timeout) || !Number.isFinite(timeout) ? LEAVE_PRESETS : [...LEAVE_PRESETS, timeout].sort((a, b) => a - b);
  const s247 = stay247Of(get("stay247"));
  const voice = voiceOptions(meta);
  return (
    <>
      <FieldRow label="Leave an empty channel" hint="Leave once everyone else has left the voice channel.">
        <div className="flex sm:justify-end">
          <Switch
            label="Leave an empty channel"
            checked={Boolean(get("autoLeaveEmpty"))}
            onChange={(v) => set("autoLeaveEmpty", v)}
            disabled={readOnly}
          />
        </div>
      </FieldRow>
      <FieldRow
        label="Wait before leaving"
        htmlFor="autoLeaveTimeout"
        hint="How long Bypass stays in an empty channel, or after the queue ends, before it goes."
      >
        <Select
          id="autoLeaveTimeout"
          value={String(timeout)}
          disabled={readOnly}
          onChange={(e) => set("autoLeaveTimeout", Number(e.target.value))}
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {fmtSeconds(p)}
            </option>
          ))}
        </Select>
        <FieldError id="autoLeaveTimeout-err">{errors.autoLeaveTimeout}</FieldError>
      </FieldRow>
      <FieldRow
        label="24/7"
        hint={
          <>
            Stays in one voice channel around the clock and rejoins it after restarts. Turn it on or off with{" "}
            <code className="font-semibold text-ink">/247</code> in Discord, from the channel it should keep. It needs Premium: the
            Founder tier, a support-server boost, or a vote (12 hours).{" "}
            <Link href="/premium" className="font-semibold text-ink underline underline-offset-2 hover:no-underline">
              See Premium
            </Link>
          </>
        }
      >
        <p className="flex items-center gap-2 text-sm sm:justify-end">
          <span aria-hidden className={s247.enabled ? "h-2.5 w-2.5 rounded-full bg-stage-4" : "h-2.5 w-2.5 rounded-full border border-ink-3"} />
          {s247.enabled
            ? `On in ${voice.find((v) => v.id === s247.voiceChannelId)?.name ?? "its channel"}`
            : "Off"}
        </p>
      </FieldRow>
    </>
  );
}

// ── Channels ────────────────────────────────────────────────────────────────

export function ChannelFields({ get, set, readOnly, meta }: SectionProps & { meta: GuildMeta | null }) {
  const log = (get("logChannelId") as string | null) ?? "";
  const text = textOptions(meta);
  return (
    <>
      <FieldRow
        label="Text channels for commands"
        htmlFor="allowedTextChannels"
        hint="Members can only use Bypass in these channels. Leave empty for every channel. People with Manage Server are never limited."
      >
        <ChannelSet
          id="allowedTextChannels"
          options={text}
          value={list(get("allowedTextChannels"))}
          onChange={(v) => set("allowedTextChannels", v)}
          disabled={readOnly}
          prefix="#"
          emptyLabel="Every text channel"
          addLabel="Add text channel"
        />
      </FieldRow>
      <FieldRow
        label="Voice channels"
        htmlFor="allowedVoiceChannels"
        hint={
          <>
            Bypass only joins these. Leave empty for every voice channel. A stage can only serve channels allowed here and in its own
            list under{" "}
            <a href="#stages" className="font-semibold text-ink underline underline-offset-2 hover:no-underline">
              Stages
            </a>
            .
          </>
        }
      >
        <ChannelSet
          id="allowedVoiceChannels"
          options={voiceOptions(meta)}
          value={list(get("allowedVoiceChannels"))}
          onChange={(v) => set("allowedVoiceChannels", v)}
          disabled={readOnly}
          prefix=""
          emptyLabel="Every voice channel"
          addLabel="Add voice channel"
        />
      </FieldRow>
      <FieldRow label="Log channel" htmlFor="logChannelId" hint="Where Bypass logs who played, skipped or changed what.">
        <Select id="logChannelId" value={log} disabled={readOnly} onChange={(e) => set("logChannelId", e.target.value || null)}>
          <option value="">Automatic: #bot-commands if it exists</option>
          <option value="disabled">Off: don&apos;t log</option>
          {text.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
          {log && log !== "disabled" && !text.some((c) => c.id === log) ? <option value={log}>Deleted channel</option> : null}
        </Select>
      </FieldRow>
    </>
  );
}

// ── Stages ──────────────────────────────────────────────────────────────────

/**
 * One block per bot: its home channel and the other voice channels it may
 * serve. Both decide where a bot can go, so they sit together here.
 */
export function StageRows({
  instances,
  binding,
  setBinding,
  errors,
  readOnly,
  meta,
  scope,
  allowed,
}: {
  instances: FleetInstance[];
  binding: (instance: number) => string | null;
  setBinding: (instance: number, v: string | null) => void;
  errors: Record<number, string>;
  readOnly: boolean;
  meta: GuildMeta | null;
  scope: StageChannelScope;
  /** Settings › Channels "Voice channels" (draft); empty means every channel. */
  allowed: string[];
}) {
  const voice = voiceOptions(meta);
  return (
    <>
      {instances.map((inst) => {
        const s = stage(inst.instance);
        const value = binding(inst.instance);
        const status = !inst.inGuild
          ? "Not in this server"
          : !inst.online
            ? "Off air"
            : inst.playback?.isConnected
              ? `Playing in ${inst.playback.voiceChannelName ?? "a voice channel"}`
              : "On the bench";
        const selectId = `binding-${inst.instance}`;
        return (
          <div key={inst.instance} className="border-t border-rule py-5 first:border-t-0">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-end sm:gap-8">
              <div className="min-w-0">
                <span
                  aria-hidden
                  className="mb-2 block h-1.5 w-24"
                  style={
                    inst.inGuild
                      ? { background: s.color }
                      : { backgroundImage: "linear-gradient(to right, #8a8378 60%, transparent 0)", backgroundSize: "12px 6px" }
                  }
                />
                <h3 className={cx("bill text-[30px]", !inst.inGuild && "text-ink-3")}>{inst.name}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
                    {STAGE_COLOUR_NAMES[inst.instance] ?? "Stage"} stage
                  </span>
                  <span aria-hidden>·</span>
                  <span>{status}</span>
                </p>
              </div>
              <div className="min-w-0 sm:w-full sm:justify-self-end">
                {inst.inGuild ? (
                  <>
                    <label htmlFor={selectId} className="mb-1 block text-[13px] font-semibold text-ink">
                      Home channel
                    </label>
                    <Select
                      id={selectId}
                      value={value ?? ""}
                      disabled={readOnly}
                      aria-invalid={errors[inst.instance] ? true : undefined}
                      onChange={(e) => setBinding(inst.instance, e.target.value || null)}
                    >
                      <option value="">No home channel</option>
                      <ChannelOptions options={voice} />
                      {value && !voice.some((c) => c.id === value) ? <option value={value}>Deleted channel</option> : null}
                    </Select>
                    <FieldError id={`${selectId}-err`}>{errors[inst.instance]}</FieldError>
                  </>
                ) : (
                  <a
                    id={selectId}
                    href={inst.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[4px] border border-ink px-4 text-sm font-semibold transition-colors hover:bg-ink hover:text-stock"
                  >
                    Invite {inst.name} first <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            </div>
            {inst.inGuild ? (
              <ServeList inst={inst} home={value} voice={voice} scope={scope} allowed={allowed} readOnly={readOnly} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function ServeList({
  inst,
  home,
  voice,
  scope,
  allowed,
  readOnly,
}: {
  inst: FleetInstance;
  home: string | null;
  voice: ChannelOption[];
  scope: StageChannelScope;
  allowed: string[];
  readOnly: boolean;
}) {
  const n = inst.instance;
  const s = stage(n);
  const restricted = scope.ready && scope.restricted(n);
  const extras = scope.ready ? scope.extras(n) : [];
  const homeName = voice.find((c) => c.id === home)?.name ?? "Its home channel";
  const listId = `serve-${n}`;
  const groups = new Map<string, ChannelOption[]>();
  for (const c of voice) {
    if (c.id === home) continue;
    groups.set(c.group ?? "", [...(groups.get(c.group ?? "") ?? []), c]);
  }
  const blockedHome = Boolean(home && allowed.length && !allowed.includes(home));

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={`${listId}-label`} className="text-[13px] font-semibold text-ink">
            May also serve
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
            {!scope.ready
              ? scope.error
                ? "Couldn't load the channel lists. Reload the page to try again."
                : "Loading channel lists…"
              : restricted
                ? home
                  ? `Only ${homeName} and the channels ticked here.`
                  : "Only the channels ticked here."
                : allowed.length
                  ? "Any voice channel allowed under Channels."
                  : "Any voice channel in the server."}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-ink">
          Any channel
          <Switch
            label={`${inst.name} may serve any channel`}
            checked={!restricted}
            disabled={readOnly || !scope.ready}
            color={s.color}
            onChange={(v) => scope.setAny(n, v)}
          />
        </label>
      </div>

      {restricted ? (
        <fieldset id={listId} disabled={readOnly} aria-labelledby={`${listId}-label`} className="mt-2 min-w-0">
          {[...groups.entries()].map(([parent, chans]) => (
            <div key={parent || "none"} className="mb-1">
              {parent ? <p className="pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">{parent}</p> : null}
              <ul className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
                {chans.map((c) => {
                  const on = extras.includes(c.id);
                  const off = allowed.length > 0 && !allowed.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={cx(
                          "flex h-8 items-center gap-2.5 rounded-[3px] px-1 text-[14px] transition-colors",
                          off && !on ? "cursor-default text-ink-3" : "cursor-pointer text-ink hover:bg-ink/[0.05]",
                          "has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={off && !on}
                          onChange={() => scope.toggle(n, c.id)}
                          className="h-4 w-4 shrink-0 cursor-pointer disabled:cursor-default"
                          style={{ accentColor: s.color }}
                        />
                        <Volume2 size={14} className="shrink-0 text-ink-3" aria-hidden />
                        <span className="truncate">{c.name}</span>
                        {off ? <span className="shrink-0 text-[11.5px] text-ink-3">off under Channels</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!home && extras.length === 0 ? (
            <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug text-now">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
              Tick at least one channel. Until then {inst.name} serves any channel.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {scope.ready && scope.homeMissing(n) ? (
        <p className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1 text-[12.5px] font-semibold leading-snug text-now">
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
          <span>{homeName} isn&apos;t on its list, so {inst.name} never goes there.</span>
          {readOnly ? null : (
            <button type="button" onClick={() => scope.includeHome(n)} className="text-ink underline underline-offset-2 hover:no-underline">
              Add it
            </button>
          )}
        </p>
      ) : blockedHome ? (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug text-now">
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
          {homeName} is off under Channels › Voice channels, so {inst.name} can&apos;t join it.
        </p>
      ) : null}
    </div>
  );
}

// ── Language & look ─────────────────────────────────────────────────────────

export function LookFields({ get, set, errors, readOnly }: SectionProps) {
  const lang = normLanguage(get("language"));
  const known = lang === "auto" || LANGUAGES.some((l) => l.code === lang);
  const color = typeof get("embedColor") === "string" ? (get("embedColor") as string) : "";
  const valid = /^#[0-9a-f]{6}$/i.test(color);
  return (
    <>
      <FieldRow
        label="Language"
        htmlFor="language"
        hint="What Bypass speaks in this server. Automatic follows each member's Discord language."
      >
        <Select id="language" value={lang} disabled={readOnly} onChange={(e) => set("language", e.target.value)}>
          <option value="auto">Automatic</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native === l.english ? l.native : `${l.native} · ${l.english}`}
            </option>
          ))}
          {!known ? <option value={lang}>{lang}</option> : null}
        </Select>
      </FieldRow>
      <FieldRow label="Message colour" htmlFor="embedColor" hint="The colour strip on Bypass's messages in Discord.">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick message colour"
            value={valid ? color.toLowerCase() : "#000000"}
            disabled={readOnly}
            onChange={(e) => set("embedColor", e.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded-[4px] border border-ink/30 bg-paper p-1 disabled:cursor-not-allowed disabled:opacity-55"
          />
          <TextInput
            id="embedColor"
            value={color}
            disabled={readOnly}
            maxLength={7}
            spellCheck={false}
            aria-invalid={errors.embedColor ? true : undefined}
            aria-describedby={errors.embedColor ? "embedColor-err" : "embedColor-preview"}
            onChange={(e) => {
              const v = e.target.value.trim();
              set("embedColor", v && !v.startsWith("#") ? `#${v}` : v);
            }}
            className={cx(
              "clock text-[17px] uppercase disabled:cursor-not-allowed disabled:opacity-55",
              errors.embedColor && "border-now focus:border-now",
            )}
          />
        </div>
        <FieldError id="embedColor-err">{errors.embedColor}</FieldError>
        <div
          id="embedColor-preview"
          className="mt-2.5 flex overflow-hidden rounded-[4px] bg-[#2b2d31]"
          aria-label="Preview of a Bypass message in Discord"
        >
          <span aria-hidden className="w-1 shrink-0" style={{ background: valid ? color : "#4e5058" }} />
          <div className="min-w-0 px-3 py-2">
            <p className="text-[12px] font-semibold text-[#f2f3f5]">Now playing</p>
            <p className="truncate text-[12.5px] text-[#b5bac1]">Song title · Artist · 4:18</p>
          </div>
        </div>
      </FieldRow>
    </>
  );
}

// ── Commands ────────────────────────────────────────────────────────────────

export function CommandFields({ get, set, readOnly }: SectionProps) {
  const items = list(get("disabledCommands"));
  return (
    <FieldRow label="Turned-off commands" htmlFor="disabledCommands" hint="Members can't use these. People with Manage Server still can.">
      <ListAdder
        id="disabledCommands"
        label="Command to turn off"
        placeholder="/command"
        button="Turn off"
        existing={items}
        disabled={readOnly}
        onAdd={(v) => set("disabledCommands", [...items, v])}
        parse={(raw) => {
          const v = raw.trim().replace(/^\//, "").toLowerCase();
          return /^[a-z0-9_-]{1,32}$/.test(v) ? { value: v } : { error: "Type a command name like /lyrics, without spaces." };
        }}
      />
      <div className="mt-3">
        <ChipList
          label="Turned-off commands"
          items={items}
          emptyLabel="Every command is on"
          render={(v) => `/${v}`}
          onRemove={(v) =>
            set(
              "disabledCommands",
              items.filter((x) => x !== v),
            )
          }
          disabled={readOnly}
        />
      </div>
    </FieldRow>
  );
}

// ── Safety ──────────────────────────────────────────────────────────────────

export function SafetyFields({ get, set, readOnly }: SectionProps) {
  const items = list(get("blacklistedUsers"));
  return (
    <FieldRow
      label="Blocked members"
      htmlFor="blacklistedUsers"
      hint="Blocked members can't use Bypass in this server. To copy an ID, turn on Developer Mode in Discord, then right-click the member."
    >
      <ListAdder
        id="blacklistedUsers"
        label="User ID to block"
        placeholder="User ID"
        button="Block"
        mono
        existing={items}
        disabled={readOnly}
        onAdd={(v) => set("blacklistedUsers", [...items, v])}
        parse={(raw) => {
          const v = raw.trim().replace(/^<@!?(\d+)>$/, "$1");
          return /^\d{17,20}$/.test(v) ? { value: v } : { error: "A user ID is 17 to 20 digits." };
        }}
      />
      <div className="mt-3">
        <ChipList
          label="Blocked members"
          items={items}
          emptyLabel="Nobody is blocked"
          render={(v) => <span className="clock text-[14px] tracking-wide">{v}</span>}
          onRemove={(v) =>
            set(
              "blacklistedUsers",
              items.filter((x) => x !== v),
            )
          }
          disabled={readOnly}
        />
      </div>
    </FieldRow>
  );
}
