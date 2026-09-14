import type {
  CommandBotEvent,
  ErrorBotEvent,
  ErrorScope,
  GuildBotEvent,
  GuildEventType,
  TrackBotEvent,
  TrackEventType
} from "../../shared/types";

export const MAX_STACK = 2000;
export const MAX_MESSAGE = 500;

export function truncate(s: string | undefined | null, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function errorMessage(err: unknown): string | undefined {
  if (err === undefined || err === null) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function commandEvent(p: {
  guildId: string;
  userId: string;
  command: string;
  subcommand?: string | null;
  ok: boolean;
  durationMs: number;
  error?: unknown;
  now?: Date;
}): CommandBotEvent {
  const ev: CommandBotEvent = {
    kind: "command",
    ts: p.now ?? new Date(),
    guildId: p.guildId,
    userId: p.userId,
    command: p.command,
    ok: p.ok,
    durationMs: Math.max(0, Math.round(p.durationMs))
  };
  if (p.subcommand) ev.subcommand = p.subcommand;
  const msg = p.ok ? undefined : truncate(errorMessage(p.error), MAX_MESSAGE);
  if (msg) ev.error = msg;
  return ev;
}

export function trackEvent(p: {
  guildId: string;
  event: TrackEventType;
  title: string;
  author: string;
  url: string;
  source: string;
  trackDurationMs: number;
  requestedById?: string;
  reason?: string;
  error?: unknown;
  now?: Date;
}): TrackBotEvent {
  const ev: TrackBotEvent = {
    kind: "track",
    ts: p.now ?? new Date(),
    guildId: p.guildId,
    event: p.event,
    title: truncate(p.title, 200) ?? "",
    author: truncate(p.author, 120) ?? "",
    url: truncate(p.url, 500) ?? "",
    source: p.source || "unknown",
    trackDurationMs: Math.max(0, Math.round(p.trackDurationMs || 0))
  };
  if (p.requestedById) ev.requestedById = p.requestedById;
  if (p.reason) ev.reason = truncate(p.reason, 120);
  const msg = truncate(errorMessage(p.error), MAX_MESSAGE);
  if (msg) ev.error = msg;
  return ev;
}

export function guildEvent(p: {
  guildId: string;
  event: GuildEventType;
  name: string;
  memberCount: number;
  now?: Date;
}): GuildBotEvent {
  return {
    kind: "guild",
    ts: p.now ?? new Date(),
    guildId: p.guildId,
    event: p.event,
    name: truncate(p.name, 120) ?? "",
    memberCount: Math.max(0, p.memberCount || 0)
  };
}

export function errorEvent(p: {
  scope: ErrorScope;
  error: unknown;
  guildId?: string;
  command?: string;
  track?: string;
  now?: Date;
}): ErrorBotEvent {
  const ev: ErrorBotEvent = {
    kind: "error",
    ts: p.now ?? new Date(),
    scope: p.scope,
    message: truncate(errorMessage(p.error), MAX_MESSAGE) ?? "Unknown error"
  };
  if (p.error instanceof Error && p.error.stack) ev.stack = truncate(p.error.stack, MAX_STACK);
  if (p.guildId) ev.guildId = p.guildId;
  if (p.command) ev.command = p.command;
  if (p.track) ev.track = truncate(p.track, 200);
  return ev;
}
