"use client";

import { relTime } from "@/lib/admin/format";
import type { AdminPremium } from "@/types/admin";
import type { ReactNode } from "react";
import { Chip, Label, Loader, Panel, Unavailable } from "./ui";
import { usePolling } from "./usePolling";

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left">
            {headers.map((h) => (
              <th key={h} className="console-label font-normal px-3 py-2 border-b border-line">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const cell = "px-3 py-2 border-b border-line/60 whitespace-nowrap";

export function PremiumPanel() {
  const { data, error, loading } = usePolling<AdminPremium>("/api/admin/premium", 0);
  if (loading && !data) return <Loader />;
  if (error || !data) return <Unavailable what={`Premium data${error ? ` (${error})` : ""}`} />;

  return (
    <div className="space-y-4">
      <Panel className="p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex justify-between">
          <Label>Patrons</Label>
          <Label>{data.patrons.filter((p) => p.isPremium).length} active</Label>
        </div>
        {data.patrons.length === 0 ? (
          <p className="p-4 text-xs text-dust font-mono">No patrons synced.</p>
        ) : (
          <Table headers={["Patron", "Tier", "Status", "Pledge", "Lifetime", "Last charge"]}>
            {data.patrons.map((p) => (
              <tr key={p.discordId}>
                <td className={cell}>
                  <div className="text-cream">{p.fullName || p.discordId}</div>
                  <div className="font-mono text-[11px] text-dust">{p.discordId}</div>
                </td>
                <td className={cell}>
                  {p.tierTitle || "—"} {p.isFounder && <Chip tone="amber">founder</Chip>}
                </td>
                <td className={cell}>
                  <Chip tone={p.isPremium ? "signal" : "dust"}>{p.patronStatus}</Chip>
                </td>
                <td className={`${cell} stat-readout`}>${p.pledgeUsd.toFixed(2)}</td>
                <td className={`${cell} stat-readout`}>${p.lifetimeUsd.toFixed(2)}</td>
                <td className={`${cell} font-mono text-xs text-dune`}>
                  {p.lastChargeDate ? relTime(p.lastChargeDate) : "—"} {p.lastChargeStatus && `· ${p.lastChargeStatus}`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel className="p-0 overflow-hidden">
          <div className="p-4 border-b border-line">
            <Label>Premium servers</Label>
          </div>
          {data.premiumGuilds.length === 0 ? (
            <p className="p-4 text-xs text-dust font-mono">None linked.</p>
          ) : (
            <Table headers={["Server", "Patron", "Bitrate", "Linked"]}>
              {data.premiumGuilds.map((g) => (
                <tr key={g.guildId}>
                  <td className={cell}>
                    <div className="text-cream">{g.guildName || g.guildId}</div>
                    <div className="font-mono text-[11px] text-dust">{g.guildId}</div>
                  </td>
                  <td className={`${cell} font-mono text-xs`}>{g.discordId}</td>
                  <td className={cell}>
                    <Chip tone={g.isActive ? "amber" : "dust"}>{g.audioBitrate}kbps</Chip>
                  </td>
                  <td className={`${cell} font-mono text-xs text-dune`}>{relTime(g.linkedAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel className="p-0 overflow-hidden">
          <div className="p-4 border-b border-line">
            <Label>Linked bots</Label>
          </div>
          {data.linkedBots.length === 0 ? (
            <p className="p-4 text-xs text-dust font-mono">No linked bots.</p>
          ) : (
            <Table headers={["Bot", "Owner", "Status", "Guilds", "Plays"]}>
              {data.linkedBots.map((b) => (
                <tr key={b.botId}>
                  <td className={cell}>
                    <div className="text-cream">{b.botUsername}</div>
                    <div className="font-mono text-[11px] text-dust">{b.botId}</div>
                  </td>
                  <td className={`${cell} text-dune`}>{b.ownerUsername}</td>
                  <td className={cell} title={b.lastError ?? undefined}>
                    <Chip tone={b.status === "online" ? "signal" : b.status === "error" ? "clip" : "dust"}>{b.status}</Chip>
                  </td>
                  <td className={`${cell} stat-readout`}>{b.totalGuilds}</td>
                  <td className={`${cell} stat-readout`}>{b.totalSongsPlayed}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
