"use client";

/**
 * The voice channels each stage may serve, edited in Settings › Stages next
 * to its home channel. The lists live in the permission config
 * (`instanceChannels`, empty = any channel), so saving sends the whole config
 * back with only those lists changed.
 *
 * A bot only goes to its home channel if the channel is on its list, so a
 * list the admin touches always carries the home channel along.
 */
import { useCallback, useMemo, useState } from "react";
import { usePermissions } from "@/lib/dash/hooks";
import type { FleetInstance, PermissionConfig } from "@/lib/dash/types";

type SaveFn = <T>(path: string, method: "PUT" | "PATCH", body: unknown) => Promise<T>;
type SaveResult = { ok?: boolean; config?: PermissionConfig } | PermissionConfig | null;

const norm = (a: string[]) => JSON.stringify([...new Set(a)].sort());

export interface StageChannelScope {
  /** Permission config loaded, so lists can be shown and saved. */
  ready: boolean;
  error: string | null;
  /** Off "Any channel": only listed channels (plus home). */
  restricted: (n: number) => boolean;
  /** Channels ticked besides the home channel. */
  extras: (n: number) => string[];
  /** Saved list predates this screen and leaves the home channel out. */
  homeMissing: (n: number) => boolean;
  setAny: (n: number, any: boolean) => void;
  toggle: (n: number, channelId: string) => void;
  includeHome: (n: number) => void;
  /** Bots whose list differs from the saved one. */
  changed: number[];
  discard: () => void;
  save: () => Promise<void>;
}

export function useStageChannels(
  instances: FleetInstance[],
  home: (n: number) => string | null,
  homeTouched: (n: number) => boolean,
  saveTo: SaveFn,
): StageChannelScope {
  const perms = usePermissions();
  const raw = perms.data;
  const [edits, setEdits] = useState<Record<number, string[]>>({});
  // Switched off "Any channel" before anything is ticked.
  const [restricting, setRestricting] = useState<Set<number>>(() => new Set());

  const saved = useCallback((n: number) => raw?.instanceChannels?.[String(n)] ?? [], [raw]);
  const list = useCallback((n: number) => (n in edits ? edits[n] : saved(n)), [edits, saved]);
  const restricted = useCallback((n: number) => list(n).length > 0 || restricting.has(n), [list, restricting]);
  const touched = useCallback((n: number) => n in edits || restricting.has(n) || homeTouched(n), [edits, restricting, homeTouched]);

  /** What would be saved for bot `n`. */
  const effective = useCallback(
    (n: number): string[] => {
      if (!restricted(n)) return [];
      const h = home(n);
      const l = list(n);
      return touched(n) && h && !l.includes(h) ? [...l, h] : l;
    },
    [restricted, home, list, touched],
  );

  const changed = useMemo(
    () => instances.filter((i) => i.inGuild && norm(effective(i.instance)) !== norm(saved(i.instance))).map((i) => i.instance),
    [instances, effective, saved],
  );

  const setAny = useCallback(
    (n: number, any: boolean) => {
      setRestricting((r) => {
        const next = new Set(r);
        if (any) next.delete(n);
        else next.add(n);
        return next;
      });
      setEdits((e) => ({ ...e, [n]: any ? [] : list(n) }));
    },
    [list],
  );

  const toggle = useCallback(
    (n: number, id: string) => {
      const l = list(n);
      setEdits((e) => ({ ...e, [n]: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] }));
    },
    [list],
  );

  const includeHome = useCallback(
    (n: number) => {
      const h = home(n);
      if (h) setEdits((e) => ({ ...e, [n]: [...list(n).filter((x) => x !== h), h] }));
    },
    [home, list],
  );

  const discard = useCallback(() => {
    setEdits({});
    setRestricting(new Set());
  }, []);

  const save = useCallback(async () => {
    if (!raw || !changed.length) return;
    const body: PermissionConfig = { ...raw, instanceChannels: { ...(raw.instanceChannels ?? {}) } };
    for (const n of changed) body.instanceChannels[String(n)] = effective(n);
    const res = await saveTo<SaveResult>("permissions", "PUT", body);
    if (res && "ok" in res && res.ok === false) throw new Error("the server did not accept these channel lists");
    const next = res && "config" in res && res.config ? res.config : res && "groups" in res ? res : body;
    perms.setData(next as PermissionConfig);
    discard();
  }, [raw, changed, effective, saveTo, perms, discard]);

  return {
    ready: Boolean(raw),
    error: perms.error,
    restricted,
    extras: (n) => {
      const h = home(n);
      return list(n).filter((x) => x !== h);
    },
    homeMissing: (n) => {
      const h = home(n);
      return Boolean(h && restricted(n) && !effective(n).includes(h));
    },
    setAny,
    toggle,
    includeHome,
    changed,
    discard,
    save,
  };
}
