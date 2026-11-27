"use client";

/**
 * One live connection per open server: fleet + member permissions, kept
 * current by server-sent events (falls back to polling), plus a command
 * sender that targets a bot instance. In demo mode a local engine plays
 * the bill so the UI can be built and verified offline.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, guildApi, postCommand } from "./api";
import { DEMO_INVITE_EVENT, demoFleet, demoMe, demoSearch, isDemo } from "./demo";
import { livePosition, trackMs } from "./format";
import type { CommandName, CommandResult, Fleet, Me, PlaybackState, Track } from "./types";

type Link = "connecting" | "live" | "polling" | "offline";

/** Why the server can't be opened, as the API explained it (status + optional details). */
export interface AccessProblem {
  status: number;
  /** "bot_missing": Bypass (instance 1) isn't in the server yet. */
  code?: string;
  guildName?: string;
  /** The member has Manage Server (or owns the server), so they can add Bypass. */
  canManage?: boolean;
  /** Bypass's invite, pre-selecting this server (only sent to members who can add it). */
  inviteUrl?: string | null;
}

interface GuildLive {
  guildId: string;
  fleet: Fleet | null;
  me: Me | null;
  link: Link;
  error: string | null;
  problem: AccessProblem | null;
  /** Bypass joined the server while this page was open (it was missing on the first load). */
  arrived: boolean;
  /** Bumps when settings changed elsewhere, so pages can refetch. */
  settingsVersion: number;
  send: (instance: number, command: CommandName, params?: Record<string, unknown>) => Promise<CommandResult>;
  playbackOf: (instance: number) => PlaybackState | null;
  /** Refetch fleet and member; resolves true when both loaded. */
  refresh: () => Promise<boolean>;
}

const Ctx = createContext<GuildLive | null>(null);

export function useGuildLive(): GuildLive {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuildLive outside GuildLiveProvider");
  return v;
}

/** Re-render every `ms` so interpolated positions and the NOW line move. */
export function useTicker(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function problemFrom(e: unknown): AccessProblem | null {
  if (!(e instanceof ApiError)) return null;
  const b = (e.body ?? {}) as { code?: unknown; guild?: { name?: unknown }; canManage?: unknown; inviteUrl?: unknown };
  return {
    status: e.status,
    code: typeof b.code === "string" ? b.code : undefined,
    guildName: typeof b.guild?.name === "string" ? b.guild.name : undefined,
    canManage: b.canManage === true,
    inviteUrl: typeof b.inviteUrl === "string" && b.inviteUrl ? b.inviteUrl : null,
  };
}

function withPlayback(fleet: Fleet, instance: number, playback: PlaybackState | null): Fleet {
  return {
    ...fleet,
    instances: fleet.instances.map((i) => (i.instance === instance ? { ...i, playback } : i)),
  };
}

// ── Demo engine ──────────────────────────────────────────────────────────────

const AUTOPLAY_POOL: Track[] = [
  { title: "Tech Noir", author: "Gunship", duration: "4:57", url: "#", source: "youtube" },
  { title: "Sunset", author: "The Midnight", duration: "5:21", url: "#", source: "youtube" },
  { title: "Odd Look", author: "Kavinsky", duration: "4:12", url: "#", source: "youtube" },
];

function demoAdvance(p: PlaybackState, now: number): PlaybackState {
  if (!p.currentTrack || !p.isPlaying || p.isPaused) return p;
  const dur = trackMs(p.currentTrack);
  if (dur === 0 || livePosition(p, now) < dur) return p;
  const queue = [...p.queue];
  let next = queue.shift();
  if (p.loopMode === "track") next = p.currentTrack;
  else if (p.loopMode === "queue") queue.push(p.currentTrack);
  if (!next && p.autoplay) next = AUTOPLAY_POOL[Math.floor(now / 1000) % AUTOPLAY_POOL.length];
  if (!next) return { ...p, isPlaying: false, currentTrack: undefined, currentPosition: 0, positionAt: now, queue: [], queueSize: 0 };
  return { ...p, currentTrack: next, currentPosition: 0, positionAt: now, queue, queueSize: queue.length, lastUpdated: now };
}

function demoCommand(fleet: Fleet, instance: number, command: CommandName, params: Record<string, unknown>): { fleet: Fleet; result: CommandResult } {
  const now = Date.now();
  const inst = fleet.instances.find((i) => i.instance === instance);
  let p = inst?.playback ? { ...inst.playback, currentPosition: livePosition(inst.playback, now), positionAt: now } : null;
  const ok = (message: string, data?: CommandResult["data"]) => ({ success: true, message, data });

  if (command === "search") {
    return { fleet, result: ok("", { results: demoSearch(String(params.query ?? "")) }) };
  }
  if (command === "play") {
    const query = String(params.query ?? "").trim();
    const track: Track = (params.track as Track) ?? { title: query || "Unknown", author: "Search result", duration: "3:45", url: "#", source: "youtube" };
    const requested = { ...track, requestedBy: { id: "100000000000000005", username: "rook" } };
    if (!p || !p.currentTrack) {
      p = {
        guildId: fleet.guild.id,
        instance,
        isConnected: true,
        voiceChannelId: String(params.voiceChannelId ?? inst?.binding.voiceChannelId ?? "v3"),
        voiceChannelName: params.voiceChannelName ? String(params.voiceChannelName) : "Casual",
        isPlaying: true,
        isPaused: false,
        volume: 70,
        currentTrack: requested,
        currentPosition: 0,
        positionAt: now,
        queue: p?.queue ?? [],
        queueSize: p?.queue.length ?? 0,
        loopMode: "off",
        autoplay: false,
        filters: [],
        listeners: 1,
        lastUpdated: now,
      };
      return { fleet: withPlayback(fleet, instance, p), result: ok(`Playing ${requested.title}`) };
    }
    const queue = [...p.queue, requested];
    return { fleet: withPlayback(fleet, instance, { ...p, queue, queueSize: queue.length }), result: ok(`Added ${requested.title}`) };
  }
  if (!p) return { fleet, result: { success: false, error: "Nothing is playing on this stage." } };

  switch (command) {
    case "pause":
      p = { ...p, isPaused: true };
      break;
    case "resume":
      p = { ...p, isPaused: false };
      break;
    case "skip":
    case "skipto": {
      const idx = command === "skipto" ? Math.max(0, Number(params.position ?? 1) - 1) : 0;
      const queue = p.queue.slice(idx);
      const next = queue.shift();
      p = next ? { ...p, currentTrack: next, currentPosition: 0, queue, queueSize: queue.length } : { ...p, currentTrack: undefined, isPlaying: false, queue: [], queueSize: 0 };
      break;
    }
    case "previous":
      p = { ...p, currentPosition: 0 };
      break;
    case "seek":
      p = { ...p, currentPosition: Number(params.position ?? 0) };
      break;
    case "volume":
      p = { ...p, volume: Number(params.volume ?? p.volume) };
      break;
    case "loop":
      p = { ...p, loopMode: (params.loopMode as PlaybackState["loopMode"]) ?? "off" };
      break;
    case "autoplay":
      p = { ...p, autoplay: Boolean(params.enabled) };
      break;
    case "filter": {
      const name = String(params.name);
      const set = new Set(p.filters ?? []);
      if (params.enabled) set.add(name);
      else set.delete(name);
      p = { ...p, filters: [...set] };
      break;
    }
    case "shuffle": {
      const queue = [...p.queue].sort(() => Math.random() - 0.5);
      p = { ...p, queue };
      break;
    }
    case "remove": {
      const queue = p.queue.filter((_, i) => i !== Number(params.position) - 1);
      p = { ...p, queue, queueSize: queue.length };
      break;
    }
    case "move": {
      const queue = [...p.queue];
      const [t] = queue.splice(Number(params.from) - 1, 1);
      if (t) queue.splice(Number(params.to) - 1, 0, t);
      p = { ...p, queue };
      break;
    }
    case "clear":
      p = { ...p, queue: [], queueSize: 0 };
      break;
    case "stop":
    case "leave":
      return { fleet: withPlayback(fleet, instance, null), result: ok("Left the channel") };
    default:
      break;
  }
  return { fleet: withPlayback(fleet, instance, { ...p, lastUpdated: now }), result: ok("Done") };
}

// ── Provider ────────────────────────────────────────────────────────────────

export function GuildLiveProvider({ guildId, children }: { guildId: string; children: React.ReactNode }) {
  const demo = isDemo(guildId);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [link, setLink] = useState<Link>(demo ? "live" : "connecting");
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<AccessProblem | null>(null);
  const [arrived, setArrived] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const fleetRef = useRef(fleet);
  fleetRef.current = fleet;
  const missingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (demo) return true;
    try {
      const [f, m] = await Promise.all([guildApi<Fleet>(guildId, "fleet"), guildApi<Me>(guildId, "me")]);
      setFleet(f);
      setMe(m);
      setError(null);
      setProblem(null);
      if (missingRef.current) {
        missingRef.current = false;
        setArrived(true);
      }
      return true;
    } catch (e) {
      const p = problemFrom(e);
      if (p?.code === "bot_missing" && !fleetRef.current) missingRef.current = true;
      setError(e instanceof Error ? e.message : "Could not load this server");
      setProblem(p);
      return false;
    }
  }, [demo, guildId]);

  // Initial load + live stream (real mode).
  useEffect(() => {
    if (demo) return;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let failures = 0;
    let closed = false;

    void refresh();

    const startPolling = () => {
      if (poll) return;
      setLink("polling");
      let lastOk = true;
      poll = setInterval(() => {
        void refresh().then((ok) => {
          // Back from an outage (or Bypass just joined): try the live stream again.
          if (ok && !lastOk && !closed) {
            failures = 0;
            connect();
          }
          lastOk = ok;
        });
      }, 4000);
    };

    const connect = () => {
      if (closed || typeof EventSource === "undefined") return startPolling();
      es = new EventSource(`/api/guilds/${guildId}/stream`);
      es.addEventListener("open", () => {
        failures = 0;
        setLink("live");
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      });
      es.addEventListener("playback", (ev) => {
        try {
          const state = JSON.parse((ev as MessageEvent).data) as PlaybackState;
          setFleet((f) => (f ? withPlayback(f, state.instance ?? 1, state.isConnected ? state : null) : f));
        } catch {
          /* ignore malformed frames */
        }
      });
      es.addEventListener("fleet", (ev) => {
        try {
          const d = JSON.parse((ev as MessageEvent).data) as { instance: number; online?: boolean; inGuild?: boolean };
          setFleet((f) =>
            f
              ? {
                  ...f,
                  instances: f.instances.map((i) =>
                    i.instance === d.instance ? { ...i, online: d.online ?? i.online, inGuild: d.inGuild ?? i.inGuild } : i,
                  ),
                }
              : f,
          );
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("settings", () => setSettingsVersion((v) => v + 1));
      es.addEventListener("error", () => {
        failures += 1;
        es?.close();
        if (failures >= 3) startPolling();
        else setTimeout(connect, 1500 * failures);
      });
    };
    connect();

    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [demo, guildId, refresh]);

  // Demo engine: load on the client (the clock differs from the server's), then songs end and sets advance.
  // `?preview=fresh` opens with only Bypass in the server; `?preview=missing` without it, until it is "invited".
  useEffect(() => {
    if (!demo) return;
    const preview = new URLSearchParams(window.location.search).get("preview");
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (preview === "missing") {
      setError("Bypass is not in this server");
      setProblem({ status: 404, code: "bot_missing", guildName: "Night Owls", canManage: true, inviteUrl: "#" });
    } else {
      setFleet(demoFleet(Date.now(), preview === "fresh" ? "fresh" : "full"));
      setMe(demoMe());
    }
    // A demo invite "arrives" a few seconds after Discord would have opened.
    const onInvite = (ev: Event) => {
      const instance = Number((ev as CustomEvent<{ instance: number }>).detail?.instance);
      timers.push(
        setTimeout(() => {
          if (instance === 1 && !fleetRef.current) {
            setFleet(demoFleet(Date.now(), "fresh"));
            setMe(demoMe());
            setError(null);
            setProblem(null);
            setArrived(true);
            return;
          }
          setFleet((f) =>
            f ? { ...f, instances: f.instances.map((i) => (i.instance === instance ? { ...i, inGuild: true, online: true } : i)) } : f,
          );
        }, 3200),
      );
    };
    window.addEventListener(DEMO_INVITE_EVENT, onInvite);
    const id = setInterval(() => {
      const now = Date.now();
      setFleet((f) =>
        f
          ? { ...f, instances: f.instances.map((i) => (i.playback ? { ...i, playback: demoAdvance(i.playback, now) } : i)) }
          : f,
      );
    }, 1000);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
      window.removeEventListener(DEMO_INVITE_EVENT, onInvite);
    };
  }, [demo]);

  const send = useCallback(
    async (instance: number, command: CommandName, params: Record<string, unknown> = {}): Promise<CommandResult> => {
      if (demo) {
        const current = fleetRef.current;
        if (!current) return { success: false, error: "Not loaded" };
        const { fleet: next, result } = demoCommand(current, instance, command, params);
        setFleet(next);
        await new Promise((r) => setTimeout(r, 180));
        return result;
      }
      const result = await postCommand(guildId, instance, command, params);
      if (result.success && command !== "search") {
        // The stream brings the new state; a fetch covers polling mode.
        if (link !== "live") void refresh();
      }
      return result;
    },
    [demo, guildId, link, refresh],
  );

  const playbackOf = useCallback(
    (instance: number) => fleet?.instances.find((i) => i.instance === instance)?.playback ?? null,
    [fleet],
  );

  const value = useMemo<GuildLive>(
    () => ({ guildId, fleet, me, link, error, problem, arrived, settingsVersion, send, playbackOf, refresh }),
    [guildId, fleet, me, link, error, problem, arrived, settingsVersion, send, playbackOf, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
