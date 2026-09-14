"use client";

import BrandMark from "@/components/common/BrandMark";
import type { AdminGuild, AdminGuildsResponse, AdminOverview, AuditEntry } from "@/types/admin";
import { useState } from "react";
import { ActivityCharts } from "./ActivityCharts";
import { AuditPanel } from "./AuditPanel";
import { ErrorsList } from "./ErrorsList";
import { GuildDrawer } from "./GuildDrawer";
import { KpiGrid } from "./KpiGrid";
import { LogsPanel } from "./LogsPanel";
import { PremiumPanel } from "./PremiumPanel";
import { SectionNav } from "./SectionNav";
import { ServersTable } from "./ServersTable";
import { StatusStrip } from "./StatusStrip";
import { ToastView, useToast } from "./Toast";
import { Button, Loader, SectionHead, Unavailable } from "./ui";
import { postAction, usePolling } from "./usePolling";

export default function AdminConsole() {
  const overview = usePolling<AdminOverview>("/api/admin/overview", 30_000);
  const guilds = usePolling<AdminGuildsResponse>("/api/admin/guilds", 60_000);
  const audit = usePolling<{ entries: AuditEntry[] }>("/api/admin/audit?limit=50", 0);
  const { toast, show } = useToast();
  const [selected, setSelected] = useState<AdminGuild | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshAll = () => {
    overview.refresh();
    guilds.refresh();
    audit.refresh();
  };

  const resync = async () => {
    setBusy(true);
    const r = await postAction("/api/admin/resync");
    setBusy(false);
    show(r.ok ? r.result || "Resynced" : r.error || "Resync failed", r.ok ? "signal" : "clip");
    refreshAll();
  };

  if (overview.loading && !overview.data) return <Loader />;

  return (
    <div className="max-w-[1400px] mx-auto text-cream">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BrandMark size={38} />
          <div>
            <div className="font-display text-xl font-bold tracking-tight">Owner console</div>
            <div className="console-label">
              {overview.data ? `updated ${new Date(overview.data.generatedAt).toLocaleTimeString()}` : "loading"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAll}>Refresh</Button>
          <Button tone="amber" onClick={resync} disabled={busy}>
            {busy ? "Resyncing…" : "Resync bot"}
          </Button>
        </div>
      </div>

      <SectionNav />

      <section id="overview" className="scroll-mt-28 mb-12">
        {overview.error && <Unavailable what={`Overview (${overview.error})`} />}
        {overview.data && (
          <>
            <StatusStrip overview={overview.data} />
            <KpiGrid overview={overview.data} />
            <ErrorsList errors={overview.data.recentErrors} />
          </>
        )}
      </section>

      <section id="servers" className="scroll-mt-28 mb-12">
        <SectionHead
          kicker="Inventory"
          title="Servers"
          note={guilds.data ? `${guilds.data.guilds.length} servers` : undefined}
        />
        {guilds.error && <Unavailable what={`Servers (${guilds.error})`} />}
        {guilds.data && (
          <ServersTable guilds={guilds.data.guilds} membership={overview.data?.membership30d} onSelect={setSelected} />
        )}
      </section>

      <section id="activity" className="scroll-mt-28 mb-12">
        <SectionHead kicker="Usage" title="Activity" note="last 14 days" />
        {overview.data && <ActivityCharts overview={overview.data} />}
      </section>

      <section id="premium" className="scroll-mt-28 mb-12">
        <SectionHead kicker="Revenue" title="Premium & linked bots" />
        <PremiumPanel />
      </section>

      <section id="logs" className="scroll-mt-28 mb-12">
        <SectionHead kicker="Live" title="Bot logs" />
        <LogsPanel />
      </section>

      <section id="audit" className="scroll-mt-28 mb-12">
        <SectionHead
          kicker="Trail"
          title="Audit log"
          note={audit.data ? `${audit.data.entries.length} entries` : undefined}
        />
        <AuditPanel entries={audit.data?.entries ?? []} error={audit.error} />
      </section>

      {selected && (
        <GuildDrawer
          guild={selected}
          onClose={() => setSelected(null)}
          onAction={(message, ok) => {
            show(message, ok ? "signal" : "clip");
            if (ok) {
              setSelected(null);
              refreshAll();
            }
          }}
        />
      )}
      <ToastView toast={toast} />
    </div>
  );
}
