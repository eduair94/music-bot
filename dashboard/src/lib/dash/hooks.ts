"use client";

import { useCallback, useEffect, useState } from "react";
import { guildApi } from "./api";
import { demoActivity, demoAudit, demoHistory, demoMeta, demoPermissions, demoSettings, isDemo } from "./demo";
import { useGuildLive } from "./live";
import type { Activity, AuditItem, GuildMeta, HistoryItem, PermissionConfig } from "./types";

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

/** Fetch /api/guilds/:id/<path> (or the demo fixture) and refetch when `version` changes. */
function useGuildResource<T>(path: string, demo: () => T, version = 0): Resource<T> {
  const { guildId } = useGuildLive();
  const offline = isDemo(guildId);
  const [data, setData] = useState<T | null>(() => (offline ? demo() : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!offline);

  const reload = useCallback(async () => {
    if (offline) {
      setData(demo());
      return;
    }
    setLoading(true);
    try {
      setData(await guildApi<T>(guildId, path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [guildId, offline, path]);

  useEffect(() => {
    void reload();
  }, [reload, version]);

  return { data, error, loading, reload, setData };
}

export function useGuildMeta() {
  return useGuildResource<GuildMeta>("meta", demoMeta);
}

export function usePermissions() {
  const { settingsVersion } = useGuildLive();
  return useGuildResource<PermissionConfig>("permissions", demoPermissions, settingsVersion);
}

export function useSettings() {
  const { settingsVersion } = useGuildLive();
  return useGuildResource<Record<string, unknown>>("settings", demoSettings, settingsVersion);
}

export function useActivity(days: 7 | 30) {
  return useGuildResource<Activity>(`activity?days=${days}`, () => demoActivity(days));
}

export function useHistory() {
  const r = useGuildResource<{ items: HistoryItem[] }>("history?limit=50", () => ({ items: demoHistory() }));
  return r;
}

export function useAudit() {
  return useGuildResource<{ items: AuditItem[] }>("audit?limit=50", () => ({ items: demoAudit() }));
}

/** Save to /api/guilds/:id/<path>; in demo mode resolves locally. */
export function useGuildSave() {
  const { guildId } = useGuildLive();
  const offline = isDemo(guildId);
  return useCallback(
    async <T,>(path: string, method: "PUT" | "PATCH", body: unknown): Promise<T> => {
      if (offline) {
        await new Promise((r) => setTimeout(r, 350));
        return body as T;
      }
      return guildApi<T>(guildId, path, { method, body: JSON.stringify(body) });
    },
    [guildId, offline],
  );
}
