"use client";

import { relTime } from "@/lib/admin/format";
import type { AdminGuild, AdminOverview } from "@/types/admin";
import { useMemo, useState } from "react";
import { Chip, Label, Panel, iconUrl } from "./ui";

type SortKey = "members" | "joined" | "lastActive" | "tracks" | "commands";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "members", label: "Members" },
  { key: "lastActive", label: "Last active" },
  { key: "tracks", label: "Tracks 7d" },
  { key: "commands", label: "Commands 7d" },
  { key: "joined", label: "Joined" }
];

function sortValue(g: AdminGuild, key: SortKey): number {
  switch (key) {
    case "members":
      return g.memberCount;
    case "joined":
      return g.joinedAt;
    case "lastActive":
      return g.lastActive ? Date.parse(g.lastActive) : 0;
    case "tracks":
      return g.activity7d.tracks;
    case "commands":
      return g.activity7d.commands;
  }
}

function GuildIcon({ guild, size }: { guild: AdminGuild; size: number }) {
  const cls = "rounded-md bg-panel-raised shrink-0";
  if (guild.icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={iconUrl(guild.id, guild.icon)} alt="" width={size} height={size} className={cls} />;
  }
  return (
    <span className={`${cls} grid place-items-center font-display text-dune`} style={{ width: size, height: size }}>
      {guild.name.charAt(0)}
    </span>
  );
}

export function ServersTable({
  guilds,
  membership,
  onSelect
}: {
  guilds: AdminGuild[];
  membership?: AdminOverview["membership30d"];
  onSelect: (g: AdminGuild) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("members");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guilds
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.id.includes(q))
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));
  }, [guilds, query, sort]);

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <Panel className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <input
            placeholder="Search name or id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[180px] rounded-md bg-panel-raised border border-line-bright px-3 py-1.5 font-mono text-sm text-cream focus-amber"
          />
          <div className="flex gap-1 flex-wrap">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider border ${
                  sort === s.key ? "border-amber/60 text-amber bg-amber/10" : "border-line text-dust hover:text-cream"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left">
                {["Server", "Members", "Status", "7d", "Last active", "Joined"].map((h) => (
                  <th key={h} className="console-label font-normal px-4 py-2 border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => onSelect(g)}
                  className="cursor-pointer border-b border-line/60 hover:bg-panel-raised/60 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <GuildIcon guild={g} size={32} />
                      <div className="min-w-0">
                        <div className="text-cream font-medium truncate max-w-[260px]">{g.name}</div>
                        <div className="font-mono text-[11px] text-dust">{g.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 stat-readout text-cream">{g.memberCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {g.playback?.isPlaying ? (
                        <Chip tone="signal">playing</Chip>
                      ) : g.playback?.isPaused ? (
                        <Chip tone="amber">paused</Chip>
                      ) : (
                        <Chip>idle</Chip>
                      )}
                      {g.premium?.active && <Chip tone="amber">premium {g.premium.bitrate}k</Chip>}
                      {g.hasSettings && <Chip>configured</Chip>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-dune whitespace-nowrap">
                    {g.activity7d.tracks} tracks · {g.activity7d.commands} cmds
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-dune whitespace-nowrap">
                    {relTime(g.lastActive ?? null)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-dune whitespace-nowrap">{relTime(g.joinedAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-dune font-mono text-sm">
                    {query ? "No servers match" : "No servers"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <Label className="mb-3">Membership · 30d</Label>
        {!membership || membership.recent.length === 0 ? (
          <p className="text-xs text-dust font-mono">No joins or leaves recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {membership.recent.map((e, i) => (
              <li key={`${e.ts}-${i}`} className="flex items-baseline gap-2 text-sm">
                <span className={`font-mono text-[11px] ${e.event === "join" ? "text-signal" : "text-clip"}`}>
                  {e.event === "join" ? "+" : "−"}
                </span>
                <span className="text-cream truncate flex-1">{e.name}</span>
                <span className="font-mono text-[11px] text-dust" title={e.ts}>
                  {relTime(e.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
