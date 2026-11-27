"use client";

/**
 * The bodies of each settings section. Each reads and writes the page draft
 * through `get`/`set`; saving and the footer live in SettingsScreen.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { FleetInstance, GuildMeta } from "@/lib/dash/types";
import { FieldRow, Select, Switch, TextInput, cx } from "../ui";
import { ChannelOptions, ChannelSet, ChipList, FieldError, ListAdder, NumberField, PercentField } from "./controls";
import type { ChannelOption } from "./controls";
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
        htmlFor="stay247-channel"
        hint={
          <>
            Stay in one voice channel around the clock and rejoin it after restarts. 24/7 needs Premium: the Founder tier, a support-server
            boost, or a vote (12 hours).{" "}
            <Link href="/premium" className="font-semibold text-ink underline underline-offset-2 hover:no-underline">
              See Premium
            </Link>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <Select
            id="stay247-channel"
            className="min-w-0 flex-1"
            value={s247.voiceChannelId ?? ""}
            disabled={readOnly || !s247.enabled}
            aria-invalid={errors.stay247 ? true : undefined}
            onChange={(e) => set("stay247", { ...s247, voiceChannelId: e.target.value || null })}
          >
            <option value="">{s247.enabled ? "Pick a channel…" : "Off"}</option>
            <ChannelOptions options={voice} />
          </Select>
          <Switch label="24/7" checked={s247.enabled} onChange={(v) => set("stay247", { ...s247, enabled: v })} disabled={readOnly} />
        </div>
        <FieldError id="stay247-err">{errors.stay247}</FieldError>
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
      <FieldRow label="Voice channels" htmlFor="allowedVoiceChannels" hint="Bypass only joins these. Leave empty for every voice channel.">
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

export function StageRows({
  instances,
  binding,
  setBinding,
  errors,
  readOnly,
  meta,
}: {
  instances: FleetInstance[];
  binding: (instance: number) => string | null;
  setBinding: (instance: number, v: string | null) => void;
  errors: Record<number, string>;
  readOnly: boolean;
  meta: GuildMeta | null;
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
          <div
            key={inst.instance}
            className="grid gap-3 border-t border-rule py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-8"
          >
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
              <label htmlFor={selectId} className={cx("bill block text-[30px]", !inst.inGuild && "text-ink-3")}>
                {inst.name}
              </label>
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
        );
      })}
    </>
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
