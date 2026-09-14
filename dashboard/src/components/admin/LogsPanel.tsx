"use client";

import type { LogEntry } from "@/types/admin";
import { useEffect, useRef, useState } from "react";
import { Button, Label, Panel } from "./ui";
import { usePolling } from "./usePolling";

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  error: "text-clip",
  warn: "text-amber",
  info: "text-signal",
  log: "text-cream",
  debug: "text-dust"
};

export function LogsPanel() {
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);
  const [applied, setApplied] = useState({ level: "", search: "" });
  const bottomRef = useRef<HTMLDivElement>(null);

  const qs = new URLSearchParams({ last: "300" });
  if (applied.level) qs.set("level", applied.level);
  if (applied.search) qs.set("search", applied.search);
  const { data, error, loading, refresh } = usePolling<{ entries: LogEntry[] }>(
    `/api/admin/logs?${qs.toString()}`,
    live ? 5000 : 0
  );

  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [data, live]);

  const notConfigured = error === "not_configured";

  return (
    <Panel className="p-0 overflow-hidden">
      <form
        className="flex flex-wrap items-center gap-2 p-4 border-b border-line"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ level, search });
        }}
      >
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-md bg-panel-raised border border-line-bright px-2 py-1.5 font-mono text-xs text-cream focus-amber"
        >
          <option value="">all levels</option>
          {["error", "warn", "info", "log", "debug"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search…"
          className="flex-1 min-w-[160px] rounded-md bg-panel-raised border border-line-bright px-3 py-1.5 font-mono text-xs text-cream focus-amber"
        />
        <Button type="submit">Apply</Button>
        <Button type="button" onClick={refresh}>
          Reload
        </Button>
        <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-dune ml-auto">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> live 5s
        </label>
      </form>

      {notConfigured ? (
        <div className="p-6 text-sm text-dune font-mono">
          Log streaming is not configured. Set <span className="kbd">DEBUG_PANEL_URL</span> and{" "}
          <span className="kbd">DEBUG_TOKEN</span> in the dashboard environment.
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-clip font-mono">{error}</div>
      ) : (
        <div className="h-[420px] overflow-y-auto p-3 font-mono text-[12px] leading-relaxed bg-coal/60">
          {loading && !data && <div className="text-dust">Loading…</div>}
          {data?.entries.length === 0 && <div className="text-dust">No log entries match.</div>}
          {data?.entries.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="whitespace-pre-wrap break-all hover:bg-panel-raised/50 px-1 rounded">
              <span className="text-dust">{e.ts.slice(11, 19)}</span>{" "}
              <span className={`${LEVEL_COLOR[e.level] ?? "text-cream"} font-bold`}>{e.level.padEnd(5)}</span>{" "}
              {e.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      <div className="px-4 py-2 border-t border-line">
        <Label>ring buffer · last 2000 lines kept by the bot</Label>
      </div>
    </Panel>
  );
}
