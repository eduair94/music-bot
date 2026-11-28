"use client";

import { relTime } from "@/lib/admin/format";
import {
  FEEDBACK_STATUSES,
  type AdminFeedbackItem,
  type AdminFeedbackResponse,
  type FeedbackStatus,
} from "@/lib/feedback/admin-shape";
import { npsBandOf } from "@/lib/feedback/nps";
import { useState } from "react";
import { FEEDBACK_KINDS, type FeedbackKind } from "../../../../shared/growth";
import { Button, Chip, Label, Loader, Panel, Unavailable, type Tone } from "./ui";
import { usePolling } from "./usePolling";

const KIND_LABEL: Record<FeedbackKind, string> = { idea: "Ideas", bug: "Bugs", praise: "Praise", other: "Other", nps: "NPS answers" };
const KIND_CHIP: Record<FeedbackKind, { label: string; tone: Tone }> = {
  idea: { label: "idea", tone: "amber" },
  bug: { label: "bug", tone: "clip" },
  praise: { label: "praise", tone: "signal" },
  other: { label: "other", tone: "dust" },
  nps: { label: "nps", tone: "dust" },
};
const STATUS_TONE: Record<FeedbackStatus, Tone> = { new: "amber", read: "dust", done: "signal" };
const BAND_TONE = { promoter: "signal", passive: "amber", detractor: "clip" } as const;

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors focus-amber ${
        active ? "border-line-strong bg-panel-raised text-cream" : "border-line text-dune hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function NpsFigure({ data }: { data: AdminFeedbackResponse }) {
  const { score, n, promoters, passives, detractors } = data.nps;
  const share = (v: number) => (n ? `${(v / n) * 100}%` : "0%");
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <Label>NPS · {data.windowDays} days</Label>
        <Label>n = {n}</Label>
      </div>
      <div className="stat-readout text-4xl md:text-5xl font-bold text-cream mt-2">
        {score === null ? "—" : score > 0 ? `+${score}` : String(score)}
      </div>
      {n > 0 ? (
        <>
          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="bg-signal" style={{ width: share(promoters) }} />
            <span className="bg-amber" style={{ width: share(passives) }} />
            <span className="bg-clip" style={{ width: share(detractors) }} />
          </div>
          <div className="mt-2 font-mono text-xs text-dust">
            {promoters} promoters · {passives} passive · {detractors} detractors
          </div>
        </>
      ) : (
        <div className="mt-2 font-mono text-xs text-dust">No answers yet</div>
      )}
    </Panel>
  );
}

function KindCounts({ data }: { data: AdminFeedbackResponse }) {
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <Label>By kind · {data.windowDays} days</Label>
        <Label>{data.countsByStatus.new} new</Label>
      </div>
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
        {FEEDBACK_KINDS.map((k) => (
          <div key={k}>
            <dt className="console-label">{KIND_LABEL[k]}</dt>
            <dd className="stat-readout text-2xl font-bold text-cream mt-1">{data.countsByKind[k]}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Item({ item, busy, onStatus }: { item: AdminFeedbackItem; busy: boolean; onStatus: (s: FeedbackStatus) => void }) {
  const kind = KIND_CHIP[item.kind] ?? KIND_CHIP.other;
  const meta = [
    item.context ? `${item.source} ${item.context}` : item.source,
    item.userId ? `${item.userName ? `${item.userName} ` : ""}${item.userId}` : null,
    item.guildId ? `guild ${item.guildId}` : null,
    item.country,
    item.locale,
  ].filter(Boolean);

  return (
    <li className="p-4 border-b border-line/60 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={kind.tone}>{kind.label}</Chip>
        {typeof item.score === "number" && (
          <Chip tone={BAND_TONE[npsBandOf(item.score)]}>{item.score}/10</Chip>
        )}
        <Chip tone={STATUS_TONE[item.status]}>{item.status}</Chip>
        {item.quoteOk && <Chip tone="signal" title="The author allowed quoting this on the site">quotable</Chip>}
        <span className="flex-1" />
        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()} className="font-mono text-xs text-dune">
          {relTime(item.createdAt)}
        </time>
      </div>

      <p className={`mt-2 text-sm whitespace-pre-wrap break-words ${item.message ? "text-cream" : "text-dust italic"}`}>
        {item.message || "(no message)"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-dust">
        {meta.map((m) => (
          <span key={m}>{m}</span>
        ))}
        {item.contact && (
          <span className="text-dune">
            reply to <span className="text-cream select-all">{item.contact}</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {item.status === "new" && (
          <Button disabled={busy} onClick={() => onStatus("read")}>
            Mark read
          </Button>
        )}
        {item.status !== "done" ? (
          <Button tone="signal" disabled={busy} onClick={() => onStatus("done")}>
            Done
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => onStatus("new")}>
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

export function FeedbackPanel() {
  const [kind, setKind] = useState<FeedbackKind | "">("");
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = new URLSearchParams({ limit: "50" });
  if (kind) query.set("kind", kind);
  if (status) query.set("status", status);
  const { data, error, loading, refresh } = usePolling<AdminFeedbackResponse>(`/api/admin/feedback?${query}`, 60_000);

  const updateStatus = async (id: string, next: FeedbackStatus) => {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) setActionError(body.error || `HTTP ${res.status}`);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <Loader />;
  if (!data) return <Unavailable what={`Feedback${error ? ` (${error})` : ""}`} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <NpsFigure data={data} />
        <KindCounts data={data} />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter feedback">
        <FilterChip active={kind === ""} onClick={() => setKind("")}>
          All kinds
        </FilterChip>
        {FEEDBACK_KINDS.map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_CHIP[k].label}
          </FilterChip>
        ))}
        <span className="mx-2 h-4 w-px bg-line" aria-hidden="true" />
        <FilterChip active={status === ""} onClick={() => setStatus("")}>
          Any status
        </FilterChip>
        {FEEDBACK_STATUSES.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
            {`${s} (${data.countsByStatus[s]})`}
          </FilterChip>
        ))}
      </div>

      {(actionError || error) && (
        <p role="alert" className="font-mono text-xs text-clip">
          {actionError ?? `Refresh failed: ${error}`}
        </p>
      )}

      <Panel className="p-0 overflow-hidden">
        {data.items.length === 0 ? (
          <p className="p-4 text-xs text-dust font-mono">Nothing here yet.</p>
        ) : (
          <ul>
            {data.items.map((item) => (
              <Item key={item.id} item={item} busy={busyId === item.id} onStatus={(s) => updateStatus(item.id, s)} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
