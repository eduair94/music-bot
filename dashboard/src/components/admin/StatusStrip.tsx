"use client";

import { bytes, uptime } from "@/lib/admin/format";
import type { AdminOverview } from "@/types/admin";
import { Chip, Panel } from "./ui";

const LED: Record<AdminOverview["status"]["state"], { color: string; label: string }> = {
  fresh: { color: "#5be49b", label: "Online" },
  stale: { color: "#f8aa2a", label: "Stale heartbeat" },
  offline: { color: "#ff5a48", label: "Offline" }
};

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[96px]">
      <div className="console-label">{label}</div>
      <div className="stat-readout text-cream text-base mt-0.5">{value}</div>
    </div>
  );
}

export function StatusStrip({ overview }: { overview: AdminOverview }) {
  const { heartbeat: hb, state, ageSec } = overview.status;
  const led = LED[state];
  const infra = overview.infra;

  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <span
            className="led"
            style={{ background: led.color, boxShadow: `0 0 6px ${led.color}, 0 0 14px ${led.color}66` }}
          />
          <div>
            <div className="font-display text-lg font-semibold text-cream leading-tight">{hb?.username ?? "Bot"}</div>
            <div className="console-label">
              {led.label}
              {ageSec !== null && ` · heartbeat ${ageSec}s ago`}
            </div>
          </div>
        </div>

        {hb && (
          <>
            <Readout label="Uptime" value={uptime(hb.uptimeSec)} />
            <Readout label="WS ping" value={hb.ws.ping >= 0 ? `${hb.ws.ping} ms` : "—"} />
            <Readout label="RSS" value={bytes(hb.process.rss)} />
            <Readout label="CPU" value={`${hb.process.cpuPercent}%`} />
            <Readout label="Voice" value={`${hb.queues.playing} playing · ${hb.queues.paused} paused`} />
          </>
        )}

        <div className="flex flex-wrap gap-2 ml-auto">
          <Chip tone={infra.redis.ok ? "signal" : "clip"} title="Redis round-trip">
            Redis {infra.redis.ms !== null ? `${infra.redis.ms}ms` : "down"}
          </Chip>
          <Chip tone={infra.mongo.ok ? "signal" : "clip"} title="MongoDB ping">
            Mongo {infra.mongo.ms !== null ? `${infra.mongo.ms}ms` : "down"}
          </Chip>
          <Chip
            tone={!infra.debugPanel.configured ? "dust" : infra.debugPanel.ok ? "signal" : "clip"}
            title="Bot debug panel"
          >
            Logs {!infra.debugPanel.configured ? "n/a" : infra.debugPanel.ok ? "ok" : "down"}
          </Chip>
        </div>
      </div>

      {hb && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-dust">
          <span>bot v{hb.versions.bot}</span>
          <span>discord.js {hb.versions.discordJs}</span>
          <span>discord-player {hb.versions.discordPlayer}</span>
          <span>yt-dlp {hb.versions.ytDlp ?? "unknown"}</span>
          <span>node {hb.process.node}</span>
          <span>pid {hb.process.pid}</span>
          {hb.lastError && (
            <span className="text-clip" title={hb.lastError.ts}>
              last error [{hb.lastError.scope}] {hb.lastError.message}
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}
