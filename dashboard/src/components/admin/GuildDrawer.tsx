"use client";

import { relTime, uptime } from "@/lib/admin/format";
import type { AdminGuild, AdminGuildDetail } from "@/types/admin";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, Chip, Label, iconUrl } from "./ui";
import { postAction, usePolling } from "./usePolling";

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-line/60 text-sm">
      <span className="text-dust font-mono text-xs">{k}</span>
      <span className="text-cream text-right break-all">
        {v === null || v === undefined || v === "" ? "—" : String(v)}
      </span>
    </div>
  );
}

export function GuildDrawer({
  guild,
  onClose,
  onAction
}: {
  guild: AdminGuild;
  onClose: () => void;
  onAction: (message: string, ok: boolean) => void;
}) {
  const detail = usePolling<AdminGuildDetail>(`/api/admin/guilds/${guild.id}`, 0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmLeave) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmLeave]);

  const stop = async () => {
    setBusy(true);
    const r = await postAction(`/api/admin/guilds/${guild.id}/stop`);
    setBusy(false);
    onAction(r.ok ? r.result || "Playback stopped" : r.error || "Stop failed", r.ok);
    if (r.ok) detail.refresh();
  };

  const leave = async () => {
    setBusy(true);
    const r = await postAction(`/api/admin/guilds/${guild.id}/leave`);
    setBusy(false);
    setConfirmLeave(false);
    onAction(r.ok ? r.result || "Left server" : r.error || "Leave failed", r.ok);
  };

  const d = detail.data;
  const s = d?.settings;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-coal/70" onClick={onClose}>
      <aside
        className="h-full w-full sm:w-[520px] overflow-y-auto bg-panel border-l border-line p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Server ${guild.name}`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {guild.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconUrl(guild.id, guild.icon, 128)}
                alt=""
                width={48}
                height={48}
                className="rounded-lg bg-panel-raised shrink-0"
              />
            ) : (
              <span className="w-12 h-12 rounded-lg bg-panel-raised grid place-items-center font-display text-xl text-dune shrink-0">
                {guild.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold text-cream truncate">{guild.name}</h3>
              <div className="font-mono text-[11px] text-dust">
                {guild.id} · owner {guild.ownerId}
              </div>
            </div>
          </div>
          <Button onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <Chip>{guild.memberCount.toLocaleString()} members</Chip>
          <Chip>joined {relTime(guild.joinedAt)}</Chip>
          {guild.premium?.active && <Chip tone="amber">premium {guild.premium.bitrate}kbps</Chip>}
          {d?.playback?.isPlaying && <Chip tone="signal">playing</Chip>}
        </div>

        <div className="flex gap-2 mb-6">
          <Button tone="amber" onClick={stop} disabled={busy || !d?.playback?.isPlaying}>
            Stop playback
          </Button>
          <Button tone="clip" onClick={() => setConfirmLeave(true)} disabled={busy}>
            Leave server
          </Button>
          <a
            href={`/servers/${guild.id}/settings`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto self-center font-mono text-[11px] uppercase tracking-wider text-dune hover:text-amber"
          >
            open settings ↗
          </a>
        </div>

        {detail.error && <p className="text-clip font-mono text-sm">{detail.error}</p>}

        {d && (
          <div className="space-y-6">
            <div>
              <Label className="mb-2">Now</Label>
              <Row k="track" v={d.playback?.currentTrack?.title ?? "nothing playing"} />
              <Row k="voice channel" v={d.playback?.voiceChannelName} />
              <Row k="queue" v={d.playback?.queueSize ?? 0} />
              <Row
                k="volume"
                v={d.playback ? `${d.playback.volume}% · ${d.playback.audioBitrate}kbps · loop ${d.playback.loopMode}` : null}
              />
              <Row k="last update" v={d.playback ? relTime(d.playback.lastUpdated) : null} />
            </div>

            <div>
              <Label className="mb-2">Activity · 7d</Label>
              <Row k="commands" v={d.activity.commands7d} />
              <Row k="tracks" v={d.activity.tracks7d} />
              <Row k="top commands" v={d.activity.topCommands.map((c) => `/${c.command} ${c.count}`).join(" · ") || null} />
              <Row
                k="top requesters"
                v={d.activity.topRequesters.map((r) => `${r.userId} (${r.count})`).join(" · ") || null}
              />
              <Row
                k="lifetime plays"
                v={s ? `${s.totalSongsPlayed ?? 0} songs · ${uptime(s.totalPlaytime ?? 0)}` : null}
              />
            </div>

            <div>
              <Label className="mb-2">Settings</Label>
              {!s ? (
                <p className="text-xs text-dust font-mono">Defaults (never configured)</p>
              ) : (
                <>
                  <Row k="language" v={s.language} />
                  <Row k="dj role" v={s.djRoleId} />
                  <Row k="admin role" v={s.adminRoleId} />
                  <Row k="volume" v={`${s.defaultVolume} default · ${s.maxVolume} max`} />
                  <Row k="queue" v={`${s.maxQueueSize} max · ${s.maxSongDuration || "∞"} s max duration`} />
                  <Row k="auto-leave" v={s.autoLeaveEmpty ? "on" : "off"} />
                  <Row k="announce" v={s.announceNowPlaying ? "on" : "off"} />
                  <Row k="log channel" v={s.logChannelId} />
                  <Row k="allowed text ch." v={s.allowedTextChannels?.length || "all"} />
                  <Row k="allowed voice ch." v={s.allowedVoiceChannels?.length || "all"} />
                  <Row k="blacklisted users" v={s.blacklistedUsers?.length || 0} />
                  <Row k="disabled commands" v={s.disabledCommands?.join(", ") || "none"} />
                  <Row k="updated" v={s.updatedAt ? relTime(String(s.updatedAt)) : null} />
                </>
              )}
            </div>

            <div>
              <Label className="mb-2">Recent events</Label>
              {d.events.length === 0 ? (
                <p className="text-xs text-dust font-mono">No events recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.events.map((e, i) => (
                    <li key={`${e.ts}-${i}`} className="flex gap-2 text-xs">
                      <span className="font-mono text-dust w-14 shrink-0" title={e.ts}>
                        {relTime(e.ts)}
                      </span>
                      <span className={`font-mono shrink-0 ${e.ok === false ? "text-clip" : "text-amber"}`}>{e.kind}</span>
                      <span className="text-cream break-all">{e.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {confirmLeave && (
          <ConfirmDialog
            title={`Leave ${guild.name}?`}
            description="The bot will leave this server immediately and stop any playback there. Server settings stay in the database; the bot can be re-invited later."
            confirmText="Leave server"
            requireText={guild.name}
            busy={busy}
            onConfirm={leave}
            onCancel={() => setConfirmLeave(false)}
          />
        )}
      </aside>
    </div>
  );
}
