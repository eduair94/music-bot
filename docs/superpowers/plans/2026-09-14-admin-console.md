# Owner Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner-only `/admin` page with live bot health, server inventory, usage/error analytics, premium/linked-bot state, live logs and audited admin actions, fed by new bot telemetry.

**Architecture:** The bot gains a `TelemetryService` that writes a 20 s heartbeat to Redis `bot:status` and fire-and-forget events to a Mongo `botevents` collection (TTL 90 d). The Next.js dashboard adds owner-only `/api/admin/*` routes that aggregate Redis + Mongo, proxy the bot DebugPanel for logs, and execute three audited actions (leave guild via Discord REST, stop playback and resync via the existing `botcommands` queue). The `/admin` page is rebuilt with the studio-console design system.

**Tech Stack:** TypeScript, discord.js 14, discord-player 7, mongoose (9 bot / 8 dashboard), ioredis, Next.js 15 App Router, Auth.js v5, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-admin-console-design.md`

## Global Constraints

- Owner Discord ID `1066182746399055993`; env var `OWNER_ID` on both bot and dashboard.
- Heartbeat interval 20 s, Redis TTL 60 s (existing `REDIS_TTL.BOT_STATUS`).
- Event retention `BOT_EVENTS_TTL_DAYS` default 90; stack traces truncated to 2000 chars, messages to 500.
- Every `/api/admin/*` response: `Cache-Control: no-store`. Reads use `requireOwner()`, actions use `requireOwnerAction(request)` (owner + same-origin + 10 actions/min).
- Telemetry must never throw into bot code paths; all writes are `void`-ed with a catch.
- Dashboard UI uses studio-console tokens/classes (`console-panel`, `console-label`, `stat-readout`, `led`, `text-amber`, `text-cream`, `text-dune`, `text-dust`, `bg-panel-raised`, `border-line`), no MUI cards.
- Prettier: printWidth 120, no trailing commas, LF. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Root `tsconfig.json` includes `./`; test files must be excluded from the build.
- Never commit `.env` files or tokens.

## File map

**Bot (root)**
- Create `services/telemetry/heartbeat.ts` — pure heartbeat builder + cpu percent.
- Create `services/telemetry/events.ts` — pure event shapers + truncation.
- Create `services/telemetry.ts` — `TelemetryService` (start/stop/tick/record/resyncNow/noteError), yt-dlp version.
- Create `models/BotEvent.ts` — mongoose model `botevents` with TTL.
- Modify `shared/types/index.ts` — `IBotHeartbeat`, `IBotEventRecord`, event unions, `AdminCommandType`.
- Modify `structs/Bot.ts` — use telemetry, command/guild events.
- Modify `services/discordPlayer.ts` — track events, counters fix.
- Modify `services/dashboardSync.ts` — `admin_resync`.
- Modify `index.ts` — process error events, stop telemetry on shutdown.
- Create `tests/unit/telemetry.test.ts`; modify `package.json`, `tsconfig.json`.

**Dashboard (`dashboard/`)**
- Create `src/lib/admin/guards.ts`, `aggregate.ts`, `format.ts` (+ `*.test.ts`).
- Modify `src/lib/admin-auth.ts` — `requireOwner`, `requireOwnerAction`, `adminJson`.
- Create `src/lib/models/BotEvent.ts`, `src/lib/models/AdminAuditLog.ts`.
- Create `src/lib/admin/audit.ts`, `src/lib/admin/discord-bot.ts`, `src/lib/admin/overview.ts`, `src/lib/admin/debug-panel.ts`, `src/lib/bot-commands.ts`.
- Modify `src/lib/redis.ts` — `pingRedis`, `removeBotGuild`.
- Create `src/types/admin.ts` — response types shared by routes and UI.
- Routes: modify `src/app/api/admin/guilds/route.ts`; create `overview/route.ts`, `guilds/[guildId]/route.ts`, `guilds/[guildId]/leave/route.ts`, `guilds/[guildId]/stop/route.ts`, `resync/route.ts`, `logs/route.ts`, `audit/route.ts`.
- UI: rewrite `src/app/(dashboard)/admin/page.tsx`; create `src/components/admin/{AdminConsole,SectionNav,StatusStrip,KpiGrid,ActivityCharts,ErrorsList,ServersTable,GuildDrawer,ConfirmDialog,PremiumPanel,LogsPanel,AuditPanel,Toast,usePolling,ui}.tsx`.
- Modify `src/components/dashboard/MobileDrawer.tsx`, `Header.tsx`, `src/app/(dashboard)/layout.tsx`, `.env.example`, `package.json`.

---

### Task 1: Test tooling (vitest in root and dashboard)

**Files:**
- Modify: `package.json` (root), `tsconfig.json` (root)
- Modify: `dashboard/package.json`
- Create: `tests/unit/smoke.test.ts`, `dashboard/src/lib/admin/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (root) runs `tests/unit/**/*.test.ts`; `npm test` in `dashboard/` runs `src/**/*.test.ts`.

- [ ] **Step 1: Install vitest in both packages**

Run (from repo root):
```bash
npm install -D vitest@^2.1.0
cd dashboard && npm install -D vitest@^2.1.0 && cd ..
```

- [ ] **Step 2: Add scripts and build exclusions**

In root `package.json` scripts add `"test": "vitest run --dir tests/unit"`.
In `dashboard/package.json` scripts add `"test": "vitest run --dir src"`.
In root `tsconfig.json` change `exclude` to:
```json
"exclude": ["/.github", "./dist", "./node_modules", "./website", "./dashboard", "./commands_disabled", "./tests/unit", "**/*.test.ts"]
```

- [ ] **Step 3: Write smoke tests**

`tests/unit/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```
`dashboard/src/lib/admin/smoke.test.ts`: same content.

- [ ] **Step 4: Run both**

Run: `npm test` and `cd dashboard && npm test`
Expected: 1 passed each.

- [ ] **Step 5: Verify the bot build ignores tests**

Run: `npm run build && ls dist/tests 2>/dev/null || echo "no dist/tests"`
Expected: `no dist/tests` (or a listing without `unit/`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json dashboard/package.json dashboard/package-lock.json tests/unit/smoke.test.ts dashboard/src/lib/admin/smoke.test.ts
git commit -m "chore: add vitest to bot and dashboard"
```

---

### Task 2: Shared telemetry types

**Files:**
- Modify: `shared/types/index.ts` (append after `BotCommandType`, ~line 337)

**Interfaces:**
- Produces: `IBotHeartbeat`, `IBotEventRecord`, `BotEventKind`, `TrackEventType`, `GuildEventType`, `ErrorScope`, `CommandBotEvent`, `TrackBotEvent`, `GuildBotEvent`, `ErrorBotEvent`, `BotEvent`, `AdminCommandType`; `BotCommandType` now includes `"admin_resync"`.

- [ ] **Step 1: Replace the `BotCommandType` line**

Change
```ts
export type BotCommandType = PlayerCommandType | LinkedBotCommandType;
```
to
```ts
/** Owner-only administrative commands (guild-less, like linked-bot commands) */
export type AdminCommandType = "admin_resync";

export type BotCommandType = PlayerCommandType | LinkedBotCommandType | AdminCommandType;
```

- [ ] **Step 2: Append the telemetry types at the end of the file**

```ts
// ============ Admin Telemetry ============

/** Written by the bot to Redis `bot:status` every 20 s (TTL 60 s). Superset of the old status object. */
export interface IBotHeartbeat {
  online: true;
  id: string;
  username: string;
  avatar: string | null;
  /** ISO — process start */
  startedAt: string;
  /** ISO — this tick */
  ts: string;
  uptimeSec: number;
  guildCount: number;
  memberCount: number;
  ws: { ping: number; status: number };
  queues: { total: number; playing: number; paused: number; voiceConnections: number };
  process: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    cpuPercent: number;
    node: string;
    platform: string;
    pid: number;
  };
  versions: { bot: string; discordJs: string; discordPlayer: string; ytDlp: string | null };
  services: { mongo: boolean; patreon: boolean; debugPanel: boolean };
  lastError?: { ts: string; scope: string; message: string };
}

export type BotEventKind = "command" | "track" | "guild" | "error";
export type TrackEventType = "start" | "finish" | "skip" | "error";
export type GuildEventType = "join" | "leave";
export type ErrorScope = "command" | "player" | "process";

export interface CommandBotEvent {
  kind: "command";
  ts: Date;
  guildId: string;
  userId: string;
  command: string;
  subcommand?: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface TrackBotEvent {
  kind: "track";
  ts: Date;
  guildId: string;
  event: TrackEventType;
  title: string;
  author: string;
  url: string;
  source: string;
  trackDurationMs: number;
  requestedById?: string;
  reason?: string;
  error?: string;
}

export interface GuildBotEvent {
  kind: "guild";
  ts: Date;
  guildId: string;
  event: GuildEventType;
  name: string;
  memberCount: number;
}

export interface ErrorBotEvent {
  kind: "error";
  ts: Date;
  guildId?: string;
  scope: ErrorScope;
  message: string;
  stack?: string;
  command?: string;
  track?: string;
}

export type BotEvent = CommandBotEvent | TrackBotEvent | GuildBotEvent | ErrorBotEvent;

/** Flat document shape stored in the `botevents` collection (every union field optional). */
export interface IBotEventRecord {
  kind: BotEventKind;
  ts: Date;
  guildId?: string;
  userId?: string;
  command?: string;
  subcommand?: string;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  event?: string;
  title?: string;
  author?: string;
  url?: string;
  source?: string;
  trackDurationMs?: number;
  requestedById?: string;
  reason?: string;
  name?: string;
  memberCount?: number;
  scope?: string;
  message?: string;
  stack?: string;
  track?: string;
}
```

- [ ] **Step 3: Type-check both packages**

Run: `npx tsc --noEmit -p tsconfig.json && cd dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add shared/types/index.ts
git commit -m "feat(types): heartbeat, bot event and admin command types"
```

---

### Task 3: Pure telemetry helpers (TDD)

**Files:**
- Create: `services/telemetry/heartbeat.ts`, `services/telemetry/events.ts`
- Test: `tests/unit/telemetry.test.ts`

**Interfaces:**
- Produces:
  - `buildHeartbeat(input: HeartbeatInput): IBotHeartbeat`
  - `cpuPercent(prev: NodeJS.CpuUsage, curr: NodeJS.CpuUsage, elapsedMs: number): number`
  - `commandEvent(p): CommandBotEvent`, `trackEvent(p): TrackBotEvent`, `guildEvent(p): GuildBotEvent`, `errorEvent(p): ErrorBotEvent`
  - `truncate(s, max): string | undefined`, `errorMessage(err: unknown): string | undefined`, constants `MAX_STACK = 2000`, `MAX_MESSAGE = 500`

- [ ] **Step 1: Write the failing tests**

`tests/unit/telemetry.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildHeartbeat, cpuPercent, HeartbeatInput } from "../../services/telemetry/heartbeat";
import { commandEvent, errorEvent, guildEvent, MAX_STACK, trackEvent, truncate } from "../../services/telemetry/events";

const base: HeartbeatInput = {
  id: "1",
  username: "Bypass",
  avatar: null,
  startedAt: new Date("2026-09-14T00:00:00Z"),
  now: new Date("2026-09-14T01:00:00Z"),
  guildCount: 23,
  memberCount: 88000,
  wsPing: 42,
  wsStatus: 0,
  queues: { total: 3, playing: 2, paused: 1, voiceConnections: 3 },
  memory: { rss: 100, heapUsed: 50, heapTotal: 80 },
  cpuPercent: 3.2,
  node: "v22.0.0",
  platform: "linux",
  pid: 7,
  versions: { bot: "2.9.0", discordJs: "14.25.1", discordPlayer: "7.2.0", ytDlp: "2026.09.01" },
  services: { mongo: true, patreon: false, debugPanel: true }
};

describe("buildHeartbeat", () => {
  it("computes uptime and copies fields", () => {
    const hb = buildHeartbeat(base);
    expect(hb.online).toBe(true);
    expect(hb.uptimeSec).toBe(3600);
    expect(hb.ts).toBe("2026-09-14T01:00:00.000Z");
    expect(hb.queues.playing).toBe(2);
    expect(hb.process.cpuPercent).toBe(3.2);
    expect(hb.lastError).toBeUndefined();
  });

  it("never reports negative uptime", () => {
    const hb = buildHeartbeat({ ...base, now: new Date("2026-09-13T00:00:00Z") });
    expect(hb.uptimeSec).toBe(0);
  });

  it("includes lastError when given", () => {
    const hb = buildHeartbeat({ ...base, lastError: { ts: "x", scope: "player", message: "boom" } });
    expect(hb.lastError?.message).toBe("boom");
  });
});

describe("cpuPercent", () => {
  it("converts microsecond deltas to percent of one core", () => {
    const prev = { user: 0, system: 0 };
    const curr = { user: 100_000, system: 100_000 }; // 200 ms of CPU
    expect(cpuPercent(prev, curr, 1000)).toBe(20);
  });
  it("returns 0 for zero or negative elapsed", () => {
    expect(cpuPercent({ user: 0, system: 0 }, { user: 5, system: 5 }, 0)).toBe(0);
  });
});

describe("events", () => {
  it("shapes a successful command", () => {
    const ev = commandEvent({ guildId: "g", userId: "u", command: "play", subcommand: null, ok: true, durationMs: 12.6 });
    expect(ev).toMatchObject({ kind: "command", guildId: "g", userId: "u", command: "play", ok: true, durationMs: 13 });
    expect(ev.subcommand).toBeUndefined();
    expect(ev.error).toBeUndefined();
  });

  it("captures the error message of a failed command", () => {
    const ev = commandEvent({ guildId: "g", userId: "u", command: "play", ok: false, durationMs: 1, error: new Error("nope") });
    expect(ev.error).toBe("nope");
  });

  it("shapes a track start", () => {
    const ev = trackEvent({
      guildId: "g",
      event: "start",
      title: "T",
      author: "A",
      url: "https://x",
      source: "youtube",
      trackDurationMs: 1000,
      requestedById: "u"
    });
    expect(ev).toMatchObject({ kind: "track", event: "start", source: "youtube", requestedById: "u" });
  });

  it("shapes a guild join", () => {
    expect(guildEvent({ guildId: "g", event: "join", name: "N", memberCount: 5 })).toMatchObject({ kind: "guild", event: "join" });
  });

  it("truncates stacks and falls back to a message", () => {
    const err = new Error("x");
    err.stack = "s".repeat(5000);
    const ev = errorEvent({ scope: "player", error: err, guildId: "g", track: "T" });
    expect(ev.stack!.length).toBe(MAX_STACK);
    expect(ev.message).toBe("x");
    expect(errorEvent({ scope: "process", error: undefined }).message).toBe("Unknown error");
    expect(errorEvent({ scope: "process", error: "plain" }).message).toBe("plain");
  });

  it("truncate keeps short strings and caps long ones", () => {
    expect(truncate("abc", 5)).toBe("abc");
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(truncate(undefined, 5)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — cannot find module `../../services/telemetry/heartbeat`.

- [ ] **Step 3: Implement `services/telemetry/heartbeat.ts`**

```ts
import type { IBotHeartbeat } from "../../shared/types";

export interface HeartbeatInput {
  id: string;
  username: string;
  avatar: string | null;
  startedAt: Date;
  now: Date;
  guildCount: number;
  memberCount: number;
  wsPing: number;
  wsStatus: number;
  queues: IBotHeartbeat["queues"];
  memory: { rss: number; heapUsed: number; heapTotal: number };
  cpuPercent: number;
  node: string;
  platform: string;
  pid: number;
  versions: IBotHeartbeat["versions"];
  services: IBotHeartbeat["services"];
  lastError?: IBotHeartbeat["lastError"];
}

/** Pure: turns sampled process/client values into the Redis heartbeat document. */
export function buildHeartbeat(i: HeartbeatInput): IBotHeartbeat {
  const uptimeSec = Math.max(0, Math.floor((i.now.getTime() - i.startedAt.getTime()) / 1000));
  const hb: IBotHeartbeat = {
    online: true,
    id: i.id,
    username: i.username,
    avatar: i.avatar,
    startedAt: i.startedAt.toISOString(),
    ts: i.now.toISOString(),
    uptimeSec,
    guildCount: i.guildCount,
    memberCount: i.memberCount,
    ws: { ping: i.wsPing, status: i.wsStatus },
    queues: { ...i.queues },
    process: {
      rss: i.memory.rss,
      heapUsed: i.memory.heapUsed,
      heapTotal: i.memory.heapTotal,
      cpuPercent: i.cpuPercent,
      node: i.node,
      platform: i.platform,
      pid: i.pid
    },
    versions: { ...i.versions },
    services: { ...i.services }
  };
  if (i.lastError) hb.lastError = { ...i.lastError };
  return hb;
}

/** CPU usage as percent of one core between two `process.cpuUsage()` samples (microseconds). */
export function cpuPercent(prev: NodeJS.CpuUsage, curr: NodeJS.CpuUsage, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const usedMicros = curr.user - prev.user + (curr.system - prev.system);
  const pct = (usedMicros / 1000 / elapsedMs) * 100;
  return Math.round(Math.max(0, pct) * 10) / 10;
}
```

- [ ] **Step 4: Implement `services/telemetry/events.ts`**

```ts
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
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all telemetry tests PASS.

- [ ] **Step 6: Commit**

```bash
git add services/telemetry tests/unit/telemetry.test.ts
git commit -m "feat(telemetry): pure heartbeat and event helpers"
```

---

### Task 4: BotEvent model and TelemetryService wired into the bot

**Files:**
- Create: `models/BotEvent.ts`, `services/telemetry.ts`
- Modify: `structs/Bot.ts` (ready handler lines 56-98, guildCreate/guildDelete ~207-229, interaction try/catch ~326-343), `index.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 helpers, `setBotStatus`, `syncBotGuildsWithData`, `isRedisAvailable`, `GuildData` from `shared/services/redis`, `DatabaseService.isReady()`, `DiscordPlayerService.getPlayer()`, `PatreonService.isConfigured()`.
- Produces:
  - `BotEvent` mongoose model (`models/BotEvent.ts`, collection `botevents`)
  - `TelemetryService.getInstance()` with `start(client)`, `stop()`, `tick()`, `record(event: BotEvent)`, `noteError(scope, error)`, `resyncNow(): Promise<{ guilds: number }>`
  - `collectGuildData(client): GuildData[]` exported from `services/telemetry.ts`

- [ ] **Step 1: Create `models/BotEvent.ts`**

```ts
import { Schema, model } from "mongoose";
import type { IBotEventRecord } from "../shared/types";

/**
 * Bot telemetry events — one document per command execution, track lifecycle
 * event, guild join/leave, or error. Read by the dashboard admin console.
 *
 * Retention: TTL index on `ts`. To change BOT_EVENTS_TTL_DAYS after the index
 * exists, drop the `ts_1` index once (`db.botevents.dropIndex("ts_1")`) so
 * mongoose can recreate it with the new value.
 */
const TTL_DAYS = Math.max(1, Number(process.env.BOT_EVENTS_TTL_DAYS) || 90);

const botEventSchema = new Schema<IBotEventRecord>(
  {
    kind: { type: String, required: true, enum: ["command", "track", "guild", "error"] },
    ts: { type: Date, required: true, default: Date.now },
    guildId: String,
    // command
    userId: String,
    command: String,
    subcommand: String,
    ok: Boolean,
    durationMs: Number,
    error: String,
    // track / guild
    event: String,
    title: String,
    author: String,
    url: String,
    source: String,
    trackDurationMs: Number,
    requestedById: String,
    reason: String,
    name: String,
    memberCount: Number,
    // error
    scope: String,
    message: String,
    stack: String,
    track: String
  },
  { versionKey: false, minimize: true }
);

botEventSchema.index({ kind: 1, ts: -1 });
botEventSchema.index({ guildId: 1, ts: -1 });
botEventSchema.index({ ts: 1 }, { expireAfterSeconds: TTL_DAYS * 86400 });

export const BotEvent = model<IBotEventRecord>("BotEvent", botEventSchema);
export default BotEvent;
```

- [ ] **Step 2: Create `services/telemetry.ts`**

```ts
import { execFile } from "child_process";
import { Client, version as discordJsVersion } from "discord.js";
import { BotEvent as BotEventModel } from "../models/BotEvent";
import { GuildData, isRedisAvailable, setBotStatus, syncBotGuildsWithData } from "../shared/services/redis";
import type { BotEvent, ErrorScope, IBotHeartbeat } from "../shared/types";
import { DatabaseService } from "./database";
import { DiscordPlayerService } from "./discordPlayer";
import { PatreonService } from "./patreon";
import { errorMessage } from "./telemetry/events";
import { buildHeartbeat, cpuPercent } from "./telemetry/heartbeat";

const HEARTBEAT_MS = 20_000;

/** Snapshot of guild data the dashboard reads from Redis (`bot:guild:<id>`). */
export function collectGuildData(client: Client): GuildData[] {
  return client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    memberCount: g.memberCount,
    ownerId: g.ownerId,
    joinedAt: g.joinedTimestamp || Date.now()
  }));
}

function readVersion(candidates: string[]): string {
  for (const c of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const v = require(c)?.version;
      if (typeof v === "string") return v;
    } catch {
      // try next
    }
  }
  return "unknown";
}

/**
 * TelemetryService — heartbeat to Redis every 20 s and fire-and-forget event
 * writes to Mongo. Never throws into bot code paths.
 */
export class TelemetryService {
  private static instance: TelemetryService;
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly startedAt = new Date();
  private lastCpu = process.cpuUsage();
  private lastTick = Date.now();
  private ytDlpVersion: string | null = null;
  private lastError: IBotHeartbeat["lastError"];
  private lastRecordFailureLog = 0;
  private readonly botVersion = readVersion(["../package.json", "../../package.json"]);
  private readonly discordPlayerVersion = readVersion(["discord-player/package.json"]);

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!this.instance) this.instance = new TelemetryService();
    return this.instance;
  }

  public start(client: Client): void {
    this.client = client;
    void this.resolveYtDlpVersion();
    void this.tick();
    this.timer = setInterval(() => void this.tick(), HEARTBEAT_MS);
    this.timer.unref?.();
    console.log("[Telemetry] ✅ Heartbeat started");
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Remember the last error so the next heartbeat surfaces it. */
  public noteError(scope: ErrorScope, error: unknown): void {
    this.lastError = {
      ts: new Date().toISOString(),
      scope,
      message: (errorMessage(error) ?? "Unknown error").slice(0, 200)
    };
  }

  /** Fire-and-forget event write. Drops silently when Mongo is not ready. */
  public record(event: BotEvent): void {
    if (!DatabaseService.getInstance().isReady()) return;
    BotEventModel.create(event).then(
      () => undefined,
      (err: unknown) => {
        const now = Date.now();
        if (now - this.lastRecordFailureLog > 60_000) {
          this.lastRecordFailureLog = now;
          console.error("[Telemetry] Event write failed:", errorMessage(err));
        }
      }
    );
  }

  /** Re-publish guild data and a heartbeat (used by the dashboard `admin_resync` action). */
  public async resyncNow(): Promise<{ guilds: number }> {
    if (!this.client) throw new Error("Telemetry not started");
    const guilds = collectGuildData(this.client);
    await syncBotGuildsWithData(guilds);
    await this.tick();
    return { guilds: guilds.length };
  }

  public async tick(): Promise<void> {
    const client = this.client;
    if (!client?.user) return;
    try {
      if (!(await isRedisAvailable())) return;
      const now = Date.now();
      const cpu = process.cpuUsage();
      const pct = cpuPercent(this.lastCpu, cpu, now - this.lastTick);
      this.lastCpu = cpu;
      this.lastTick = now;
      const mem = process.memoryUsage();
      const hb = buildHeartbeat({
        id: client.user.id,
        username: client.user.username,
        avatar: client.user.avatar,
        startedAt: this.startedAt,
        now: new Date(now),
        guildCount: client.guilds.cache.size,
        memberCount: client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0),
        wsPing: client.ws.ping,
        wsStatus: client.ws.status,
        queues: this.queueStats(),
        memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
        cpuPercent: pct,
        node: process.version,
        platform: process.platform,
        pid: process.pid,
        versions: {
          bot: this.botVersion,
          discordJs: discordJsVersion,
          discordPlayer: this.discordPlayerVersion,
          ytDlp: this.ytDlpVersion
        },
        services: {
          mongo: DatabaseService.getInstance().isReady(),
          patreon: PatreonService.getInstance().isConfigured(),
          debugPanel: !!process.env.DEBUG_TOKEN
        },
        lastError: this.lastError
      });
      await setBotStatus(hb);
    } catch (error) {
      console.error("[Telemetry] Heartbeat failed:", errorMessage(error));
    }
  }

  private queueStats(): IBotHeartbeat["queues"] {
    const stats = { total: 0, playing: 0, paused: 0, voiceConnections: 0 };
    const player = DiscordPlayerService.getInstance().getPlayer();
    if (!player) return stats;
    for (const q of player.nodes.cache.values()) {
      if (!q || q.deleted) continue;
      stats.total++;
      if (q.node.isPlaying()) stats.playing++;
      if (q.node.isPaused()) stats.paused++;
      if (q.connection) stats.voiceConnections++;
    }
    return stats;
  }

  private resolveYtDlpVersion(): Promise<void> {
    return new Promise((resolve) => {
      execFile("yt-dlp", ["--version"], { timeout: 10_000 }, (err, stdout) => {
        this.ytDlpVersion = err ? null : String(stdout).trim() || null;
        resolve();
      });
    });
  }
}
```

- [ ] **Step 3: Wire `structs/Bot.ts`**

Add imports:
```ts
import { TelemetryService, collectGuildData } from "../services/telemetry";
import { commandEvent, errorEvent, guildEvent } from "../services/telemetry/events";
```
Remove `setBotStatus` from the `../shared/services/redis` import (no longer used here).

In the `ready` handler replace the two inline `this.client.guilds.cache.map(g => ({...}))` blocks with `collectGuildData(this.client)` and delete the `await setBotStatus({...})` call and its comment. The block becomes:
```ts
      try {
        if (await isRedisAvailable()) {
          await syncBotGuildsWithData(collectGuildData(this.client));
          console.log("✅ Redis sync completed");

          // Periodic guild refresh (every 3 minutes to prevent key expiration)
          setInterval(async () => {
            try {
              await syncBotGuildsWithData(collectGuildData(this.client));
            } catch (error) {
              console.error("[Redis] Periodic guild sync failed:", error);
            }
          }, 3 * 60 * 1000);
        } else {
          console.log("⚠️ Redis not available, skipping guild sync");
        }
      } catch (error) {
        console.error("⚠️ Redis initialization skipped:", error);
      }
```
Immediately after the "Discord Player service initialized" try/catch add:
```ts
      // Heartbeat + event telemetry (powers the owner admin console)
      try {
        TelemetryService.getInstance().start(this.client);
      } catch (error) {
        console.error("⚠️ Telemetry failed to start:", error);
      }
```
In `guildCreate`, after the `setBotInGuild` try/catch:
```ts
      TelemetryService.getInstance().record(
        guildEvent({ guildId: guild.id, event: "join", name: guild.name, memberCount: guild.memberCount })
      );
```
In `guildDelete`, after the `removeBotFromGuild` try/catch:
```ts
      TelemetryService.getInstance().record(
        guildEvent({ guildId: guild.id, event: "leave", name: guild.name, memberCount: guild.memberCount })
      );
```
Replace the command execution try/catch (`const permissionsCheck ...` through `await safeReply(...)`) with:
```ts
      const telemetry = TelemetryService.getInstance();
      const startedAt = Date.now();
      const subcommand = interaction.options.getSubcommand(false);
      const guildIdForEvent = interaction.guild.id;

      try {
        const permissionsCheck: PermissionResult = await checkPermissions(command, interaction);

        if (permissionsCheck.result) {
          await command.execute(interaction as ChatInputCommandInteraction);
        } else {
          throw new MissingPermissionsException(permissionsCheck.missing);
        }

        telemetry.record(
          commandEvent({
            guildId: guildIdForEvent,
            userId: interaction.user.id,
            command: interaction.commandName,
            subcommand,
            ok: true,
            durationMs: Date.now() - startedAt
          })
        );
      } catch (error: any) {
        console.error(error);

        telemetry.record(
          commandEvent({
            guildId: guildIdForEvent,
            userId: interaction.user.id,
            command: interaction.commandName,
            subcommand,
            ok: false,
            durationMs: Date.now() - startedAt,
            error
          })
        );
        if (!(error instanceof MissingPermissionsException)) {
          telemetry.noteError("command", error);
          telemetry.record(errorEvent({ scope: "command", error, guildId: guildIdForEvent, command: interaction.commandName }));
        }

        const message = typeof error?.message === "string" && error.message.includes("permissions")
          ? error.toString()
          : i18n.__("common.errorCommand");

        await safeReply(interaction, { content: message, ephemeral: true });
      }
```

- [ ] **Step 4: Wire `index.ts`**

Add after the existing imports:
```ts
import { TelemetryService } from "./services/telemetry";
import { errorEvent } from "./services/telemetry/events";

function reportProcessError(error: unknown): void {
  try {
    const telemetry = TelemetryService.getInstance();
    telemetry.noteError("process", error);
    telemetry.record(errorEvent({ scope: "process", error }));
  } catch {
    // never let telemetry break error handling
  }
}
```
Change the two handlers:
```ts
process.on("unhandledRejection", (reason) => {
  console.error("[Process] ❌ Unhandled rejection:", reason);
  reportProcessError(reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] ❌ Uncaught exception:", error);
  reportProcessError(error);
});
```
In `shutdown()`, as the first statement after the timeout is created:
```ts
  TelemetryService.getInstance().stop();
```

- [ ] **Step 5: Build and run tests**

Run: `npm run build && npm test`
Expected: tsc clean, tests pass.

- [ ] **Step 6: Smoke-run locally for 40 seconds (optional if local `.env` has Redis)**

Run: `timeout 40 npx ts-node index.ts 2>&1 | grep -E "Telemetry|Heartbeat|ready"` (Git Bash). Expected line `[Telemetry] ✅ Heartbeat started`. Skip if local Discord token/Redis are not configured; production verification happens in Task 19.

- [ ] **Step 7: Commit**

```bash
git add models/BotEvent.ts services/telemetry.ts structs/Bot.ts index.ts
git commit -m "feat(telemetry): heartbeat service, bot events and command tracking"
```

---

### Task 5: Player track events and play counters

**Files:**
- Modify: `services/discordPlayer.ts` (event handlers ~lines 299-368)

**Interfaces:**
- Consumes: `TelemetryService.getInstance().record/noteError`, `trackEvent`, `errorEvent`, `GuildSettingsService.incrementSongPlayed(guildId)`, `addPlaytime(guildId, seconds)`.

- [ ] **Step 1: Add imports**

```ts
import { TelemetryService } from "./telemetry";
import { errorEvent, trackEvent } from "./telemetry/events";
```
(`GuildSettingsService` is already imported.)

- [ ] **Step 2: Add a private helper in `DiscordPlayerService`**

```ts
  /** Shape a track lifecycle event for telemetry (never throws). */
  private recordTrack(queue: GuildQueue, track: Track | undefined, event: "start" | "finish" | "skip" | "error", extra?: { reason?: string; error?: unknown }): void {
    const guildId = queue.guild?.id;
    if (!guildId || !track) return;
    TelemetryService.getInstance().record(
      trackEvent({
        guildId,
        event,
        title: track.title,
        author: track.author,
        url: track.url,
        source: track.source,
        trackDurationMs: track.durationMS,
        requestedById: track.requestedBy?.id,
        reason: extra?.reason,
        error: extra?.error
      })
    );
  }
```

- [ ] **Step 3: Hook the handlers**

In `playerStart`, right after `queue.metadata = metadata;`:
```ts
      this.recordTrack(queue, track, "start");
      if (queue.guild?.id) void GuildSettingsService.getInstance().incrementSongPlayed(queue.guild.id);
```
In `playerFinish`, after the `console.log`:
```ts
      this.recordTrack(queue, track, "finish");
      if (queue.guild?.id && track.durationMS > 0) {
        void GuildSettingsService.getInstance().addPlaytime(queue.guild.id, Math.round(track.durationMS / 1000));
      }
```
In `playerSkip`, after the first `console.log`:
```ts
      this.recordTrack(queue, track, "skip", { reason: String(reason) });
```
In the `error` handler, after the two `console.error` lines:
```ts
      TelemetryService.getInstance().noteError("player", error);
      TelemetryService.getInstance().record(errorEvent({ scope: "player", error, guildId: queue.guild?.id }));
```
In `playerError`, after the three `console.error` lines:
```ts
      this.recordTrack(queue, track, "error", { error });
      TelemetryService.getInstance().noteError("player", error);
      TelemetryService.getInstance().record(
        errorEvent({ scope: "player", error, guildId: queue.guild?.id, track: track?.title })
      );
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean. (Circular import telemetry ↔ discordPlayer is safe: both only dereference the other inside methods.)

- [ ] **Step 5: Commit**

```bash
git add services/discordPlayer.ts
git commit -m "feat(player): emit track telemetry and fix play counters"
```

---

### Task 6: `admin_resync` bot command

**Files:**
- Modify: `services/dashboardSync.ts` (`processCommands` ~line 291, `executeLinkedBotCommand` ~line 314)

**Interfaces:**
- Consumes: `TelemetryService.resyncNow()`.
- Produces: a pending `BotCommand` with `type: "admin_resync"` is completed with `result: "Resynced N guilds"`.

- [ ] **Step 1: Include the type in the poll**

```ts
      const linkedBotCommands = await BotCommand.find({
        status: "pending",
        type: { $in: ["linked_bot_start", "linked_bot_stop", "linked_bot_restart", "admin_resync"] }
      })
```

- [ ] **Step 2: Dispatch before the `botId` guard**

At the top of `executeLinkedBotCommand`, replace `if (!_id || !botId || !type) return;` with:
```ts
    if (!_id || !type) return;
    if (type === "admin_resync") {
      await this.executeAdminCommand(command);
      return;
    }
    if (!botId) return;
```

- [ ] **Step 3: Add the method**

```ts
  /** Owner action from the dashboard: republish guild data + heartbeat. */
  private async executeAdminCommand(command: IBotCommand): Promise<void> {
    const { _id, type } = command;
    try {
      await BotCommand.updateOne({ _id }, { status: "processing" });
      const { TelemetryService } = await import("./telemetry");
      const { guilds } = await TelemetryService.getInstance().resyncNow();
      const result = `Resynced ${guilds} guilds`;
      await BotCommand.updateOne({ _id }, { status: "completed", result, processedAt: new Date() });
      console.log(`[DashboardSync] ✅ Admin command completed: ${type} - ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DashboardSync] ❌ Admin command failed: ${type} - ${errorMessage}`);
      await BotCommand.updateOne({ _id }, { status: "failed", error: errorMessage, processedAt: new Date() });
    }
  }
```

- [ ] **Step 4: Build and commit**

Run: `npm run build`
```bash
git add services/dashboardSync.ts
git commit -m "feat(bot): admin_resync dashboard command"
```

---

### Task 7: Dashboard pure modules (TDD)

**Files:**
- Create: `dashboard/src/lib/admin/guards.ts`, `aggregate.ts`, `format.ts`
- Test: `dashboard/src/lib/admin/guards.test.ts`, `aggregate.test.ts`, `format.test.ts`
- Delete: `dashboard/src/lib/admin/smoke.test.ts`

**Interfaces:**
- Produces:
  - `isSnowflake(id: unknown): id is string`; `isSameOrigin(headers: Headers, requestHost: string | null): boolean`; `class RateLimiter(limit, windowMs).allow(key, now?): boolean`
  - `utcDay(d: Date): string`; `fillDailySeries(rows, days, now?): DailyPoint[]` where `DailyPoint = { date: string; commands: number; tracks: number; errors: number }`; `delta(curr, prev): { abs: number; pct: number | null }`; `errorRate(errors, total): number`; `freshness(ts, now?): { state: "fresh" | "stale" | "offline"; ageSec: number | null }`
  - `relTime(ts, now?)`, `compact(n)`, `bytes(n)`, `uptime(sec)`, `pct(n)`

- [ ] **Step 1: Write failing tests**

`guards.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isSameOrigin, isSnowflake, RateLimiter } from "./guards";

describe("isSnowflake", () => {
  it("accepts 17-20 digit ids", () => {
    expect(isSnowflake("1066182746399055993")).toBe(true);
    expect(isSnowflake("12345")).toBe(false);
    expect(isSnowflake("abc")).toBe(false);
    expect(isSnowflake(123)).toBe(false);
  });
});

describe("isSameOrigin", () => {
  it("trusts sec-fetch-site same-origin/none", () => {
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "same-origin" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "none" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "cross-site", origin: "https://a.com" }), "a.com")).toBe(false);
  });
  it("falls back to Origin host comparison", () => {
    expect(isSameOrigin(new Headers({ origin: "https://a.com" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://evil.com" }), "a.com")).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "not a url" }), "a.com")).toBe(false);
    expect(isSameOrigin(new Headers(), "a.com")).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows up to limit per window then blocks, and recovers", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow("k", 0)).toBe(true);
    expect(rl.allow("k", 10)).toBe(true);
    expect(rl.allow("k", 20)).toBe(false);
    expect(rl.allow("other", 20)).toBe(true);
    expect(rl.allow("k", 1001)).toBe(true);
  });
});
```

`aggregate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { delta, errorRate, fillDailySeries, freshness, utcDay } from "./aggregate";

describe("fillDailySeries", () => {
  it("zero-fills missing days oldest→newest", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    const out = fillDailySeries([{ date: "2026-09-13", commands: 5, tracks: 2, errors: 1 }], 3, now);
    expect(out.map((p) => p.date)).toEqual(["2026-09-12", "2026-09-13", "2026-09-14"]);
    expect(out[1]).toEqual({ date: "2026-09-13", commands: 5, tracks: 2, errors: 1 });
    expect(out[2]).toEqual({ date: "2026-09-14", commands: 0, tracks: 0, errors: 0 });
  });
  it("utcDay formats YYYY-MM-DD", () => {
    expect(utcDay(new Date("2026-01-02T23:59:59Z"))).toBe("2026-01-02");
  });
});

describe("delta / errorRate", () => {
  it("computes absolute and percent deltas", () => {
    expect(delta(120, 100)).toEqual({ abs: 20, pct: 20 });
    expect(delta(5, 0)).toEqual({ abs: 5, pct: null });
    expect(delta(33, 100).pct).toBe(-67);
  });
  it("errorRate is a rounded percent", () => {
    expect(errorRate(1, 8)).toBe(12.5);
    expect(errorRate(0, 0)).toBe(0);
  });
});

describe("freshness", () => {
  const now = Date.parse("2026-09-14T00:10:00Z");
  it("classifies by age", () => {
    expect(freshness("2026-09-14T00:09:30Z", now)).toEqual({ state: "fresh", ageSec: 30 });
    expect(freshness("2026-09-14T00:05:00Z", now)).toEqual({ state: "stale", ageSec: 300 });
    expect(freshness("2026-09-13T00:00:00Z", now).state).toBe("offline");
    expect(freshness(null, now)).toEqual({ state: "offline", ageSec: null });
    expect(freshness("garbage", now)).toEqual({ state: "offline", ageSec: null });
  });
});
```

`format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { bytes, compact, pct, relTime, uptime } from "./format";

describe("format", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  it("relTime", () => {
    expect(relTime(null)).toBe("never");
    expect(relTime("2026-09-14T11:59:50Z", now)).toBe("just now");
    expect(relTime("2026-09-14T11:30:00Z", now)).toBe("30m ago");
    expect(relTime("2026-09-14T09:00:00Z", now)).toBe("3h ago");
    expect(relTime("2026-09-10T12:00:00Z", now)).toBe("4d ago");
    expect(relTime(now - 40 * 86400000, now)).toBe("1mo ago");
  });
  it("compact / bytes / uptime / pct", () => {
    expect(compact(88000)).toBe("88K");
    expect(bytes(512 * 1024 * 1024)).toBe("512.0 MB");
    expect(bytes(0)).toBe("0 B");
    expect(uptime(90061)).toBe("1d 1h 1m");
    expect(uptime(59)).toBe("59s");
    expect(pct(12.5)).toBe("12.5%");
    expect(pct(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd dashboard && npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `guards.ts`**

```ts
/** Discord snowflake: 17–20 decimal digits. */
export function isSnowflake(id: unknown): id is string {
  return typeof id === "string" && /^\d{17,20}$/.test(id);
}

/**
 * CSRF guard for state-changing admin routes. Browsers send Sec-Fetch-Site on
 * every request; when absent we require an Origin whose host matches ours.
 */
export function isSameOrigin(headers: Headers, requestHost: string | null): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = headers.get("origin");
  if (!origin || !requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

/** Sliding-window in-memory limiter (per Next.js server instance). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  allow(key: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
```

- [ ] **Step 4: Implement `aggregate.ts`**

```ts
export interface DailyPoint {
  date: string;
  commands: number;
  tracks: number;
  errors: number;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Continuous UTC-day series ending today; missing days are zero. */
export function fillDailySeries(rows: Partial<DailyPoint>[], days: number, now: Date = new Date()): DailyPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = utcDay(d);
    const row = byDate.get(date);
    out.push({
      date,
      commands: Number(row?.commands ?? 0),
      tracks: Number(row?.tracks ?? 0),
      errors: Number(row?.errors ?? 0)
    });
  }
  return out;
}

export function delta(curr: number, prev: number): { abs: number; pct: number | null } {
  const abs = curr - prev;
  const pct = prev > 0 ? Math.round((abs / prev) * 1000) / 10 : null;
  return { abs, pct };
}

export function errorRate(errors: number, total: number): number {
  return total > 0 ? Math.round((errors / total) * 1000) / 10 : 0;
}

export type Freshness = "fresh" | "stale" | "offline";

/** Heartbeat age → fresh (<90 s), stale (<10 min), offline. */
export function freshness(ts: string | null | undefined, now: number = Date.now()): { state: Freshness; ageSec: number | null } {
  if (!ts) return { state: "offline", ageSec: null };
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return { state: "offline", ageSec: null };
  const ageSec = Math.max(0, Math.round((now - t) / 1000));
  if (ageSec < 90) return { state: "fresh", ageSec };
  if (ageSec < 600) return { state: "stale", ageSec };
  return { state: "offline", ageSec };
}
```

- [ ] **Step 5: Implement `format.ts`**

```ts
export function relTime(ts: string | number | Date | null | undefined, now: number = Date.now()): string {
  if (ts === null || ts === undefined || ts === "") return "never";
  const t = ts instanceof Date ? ts.getTime() : typeof ts === "number" ? ts : Date.parse(ts);
  if (Number.isNaN(t)) return "never";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function compact(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function bytes(n: number): string {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return i === 0 ? `${Math.round(v)} B` : `${v.toFixed(1)} ${units[i]}`;
}

export function uptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s % 60}s`);
  return parts.join(" ");
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : `${n}%`;
}
```

- [ ] **Step 6: Run tests, delete smoke test, commit**

Run: `cd dashboard && npm test` → all pass.
```bash
git rm dashboard/src/lib/admin/smoke.test.ts
git add dashboard/src/lib/admin
git commit -m "feat(dashboard): admin guards, aggregation and formatting helpers"
```

---

### Task 8: Owner auth helpers, models and server libs

**Files:**
- Modify: `dashboard/src/lib/admin-auth.ts`, `dashboard/src/lib/redis.ts`
- Create: `dashboard/src/lib/models/BotEvent.ts`, `dashboard/src/lib/models/AdminAuditLog.ts`, `dashboard/src/lib/admin/audit.ts`, `dashboard/src/lib/admin/discord-bot.ts`, `dashboard/src/lib/admin/debug-panel.ts`, `dashboard/src/lib/bot-commands.ts`, `dashboard/src/types/admin.ts`

**Interfaces:**
- Produces:
  - `requireOwner(): Promise<OwnerGate>`; `requireOwnerAction(request: Request): Promise<OwnerGate>` where `OwnerGate = { ok: true; owner: { discordId: string; name: string } } | { ok: false; response: NextResponse }`
  - `adminJson(data: unknown, status = 200): NextResponse` (adds `Cache-Control: no-store`)
  - `pingRedis(): Promise<{ ok: boolean; ms: number | null }>`; `removeBotGuild(guildId): Promise<void>`
  - `BotEventModel` (dashboard, `autoIndex: false`), `AdminAuditLog` model + `IAdminAuditLog`, `AdminAction`
  - `writeAudit(entry: Omit<IAdminAuditLog, "ts">): Promise<void>`; `listAudit(limit): Promise<AuditEntry[]>`
  - `leaveGuild(guildId): Promise<{ ok: true } | { ok: false; status: number; error: string }>`
  - `debugPanelConfigured(): boolean`; `fetchDebugPanel(path: string, timeoutMs?): Promise<Response>`
  - `enqueueAndWait(doc, timeoutMs = 5000): Promise<{ status: "completed" | "failed" | "pending"; result?: string; error?: string; id: string }>`
  - Types in `types/admin.ts` (below)

- [ ] **Step 1: Extend `lib/admin-auth.ts`**

Add imports and helpers at the bottom:
```ts
import { NextResponse } from "next/server";
import { isSameOrigin, RateLimiter } from "./admin/guards";

export interface OwnerIdentity {
  discordId: string;
  name: string;
}
export type OwnerGate = { ok: true; owner: OwnerIdentity } | { ok: false; response: NextResponse };

/** JSON response that must never be cached by browsers or proxies. */
export function adminJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredOwnerId(): string | null {
  return process.env.OWNER_ID || process.env.DISCORD_OWNER_ID || null;
}

/** Read gate: Discord session whose id equals OWNER_ID. */
export async function requireOwner(): Promise<OwnerGate> {
  const session = await auth();
  const discordId = session?.user?.discordId;
  if (!discordId) return { ok: false, response: adminJson({ error: "Unauthorized" }, 401) };
  const ownerId = configuredOwnerId();
  if (!ownerId || discordId !== ownerId) return { ok: false, response: adminJson({ error: "Forbidden" }, 403) };
  return { ok: true, owner: { discordId, name: session?.user?.name ?? "owner" } };
}

const actionLimiter = new RateLimiter(10, 60_000);

/** Action gate: owner + same-origin + 10 actions per minute. */
export async function requireOwnerAction(request: Request): Promise<OwnerGate> {
  const gate = await requireOwner();
  if (!gate.ok) return gate;
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return { ok: false, response: adminJson({ error: "Cross-origin request rejected" }, 403) };
  }
  if (!actionLimiter.allow(gate.owner.discordId)) {
    return { ok: false, response: adminJson({ error: "Rate limited, retry in a minute" }, 429) };
  }
  return gate;
}
```

- [ ] **Step 2: Extend `lib/redis.ts`**

Append:
```ts
/** Round-trip latency to Redis, for the admin infra strip. */
export async function pingRedis(): Promise<{ ok: boolean; ms: number | null }> {
  try {
    const redis = getRedis();
    if (!redis) return { ok: false, ms: null };
    const t = Date.now();
    await redis.ping();
    return { ok: true, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: null };
  }
}

/** Remove a guild from the bot presence keys (after an owner-initiated leave). */
export async function removeBotGuild(guildId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.pipeline().del(REDIS_KEYS.BOT_GUILD(guildId)).srem(REDIS_KEYS.BOT_GUILDS, guildId).exec();
}
```

- [ ] **Step 3: Create `lib/models/BotEvent.ts`**

```ts
import { Schema, model, models } from "mongoose";
import type { IBotEventRecord } from "../../../../shared/types";

export type { IBotEventRecord };

// Read model. The bot owns index creation (including the TTL index), so the
// dashboard must not try to (re)create indexes with possibly different options.
const botEventSchema = new Schema<IBotEventRecord>(
  {
    kind: { type: String, required: true },
    ts: { type: Date, required: true },
    guildId: String,
    userId: String,
    command: String,
    subcommand: String,
    ok: Boolean,
    durationMs: Number,
    error: String,
    event: String,
    title: String,
    author: String,
    url: String,
    source: String,
    trackDurationMs: Number,
    requestedById: String,
    reason: String,
    name: String,
    memberCount: Number,
    scope: String,
    message: String,
    stack: String,
    track: String
  },
  { versionKey: false, autoIndex: false, collection: "botevents" }
);

export const BotEventModel = models.BotEvent || model<IBotEventRecord>("BotEvent", botEventSchema);
export default BotEventModel;
```

- [ ] **Step 4: Create `lib/models/AdminAuditLog.ts`**

```ts
import { Schema, model, models } from "mongoose";

export type AdminAction = "guild.leave" | "guild.stop" | "bot.resync";

export interface IAdminAuditLog {
  ts: Date;
  actorId: string;
  actorName: string;
  action: AdminAction;
  targetGuildId?: string;
  targetName?: string;
  ok: boolean;
  result?: string;
  error?: string;
  ip?: string;
  userAgent?: string;
}

// Audit trail of owner actions. No TTL: retained indefinitely.
const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    ts: { type: Date, required: true, default: Date.now },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    targetGuildId: String,
    targetName: String,
    ok: { type: Boolean, required: true },
    result: String,
    error: String,
    ip: String,
    userAgent: String
  },
  { versionKey: false }
);
adminAuditLogSchema.index({ ts: -1 });

export const AdminAuditLog = models.AdminAuditLog || model<IAdminAuditLog>("AdminAuditLog", adminAuditLogSchema);
export default AdminAuditLog;
```

- [ ] **Step 5: Create `lib/admin/audit.ts`**

```ts
import "server-only";
import { AdminAuditLog, IAdminAuditLog } from "../models/AdminAuditLog";
import { connectToDatabase } from "../mongodb";
import type { AuditEntry } from "@/types/admin";

/** Persist an owner action (success or failure). Never throws. */
export async function writeAudit(entry: Omit<IAdminAuditLog, "ts">): Promise<void> {
  try {
    await connectToDatabase();
    await AdminAuditLog.create({ ...entry, ts: new Date() });
  } catch (error) {
    console.error("[admin/audit] write failed:", error);
  }
}

export function requestMeta(request: Request): { ip?: string; userAgent?: string } {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) || undefined;
  return { ip, userAgent };
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  await connectToDatabase();
  const rows = await AdminAuditLog.find({}).sort({ ts: -1 }).limit(limit).lean<IAdminAuditLog[]>();
  return rows.map((r) => ({
    ts: new Date(r.ts).toISOString(),
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    targetGuildId: r.targetGuildId,
    targetName: r.targetName,
    ok: r.ok,
    result: r.result,
    error: r.error
  }));
}
```

- [ ] **Step 6: Create `lib/admin/discord-bot.ts`**

```ts
import "server-only";

const DISCORD_API_BASE = "https://discord.com/api/v10";

/** Make the bot leave a guild. 404 from Discord counts as already gone. */
export async function leaveGuild(guildId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, status: 500, error: "DISCORD_BOT_TOKEN not configured" };
  const res = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store"
  });
  if (res.status === 204 || res.status === 404) return { ok: true };
  if (res.status === 429) return { ok: false, status: 429, error: "Rate limited by Discord, retry later" };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: `Discord ${res.status}: ${body.slice(0, 200)}` };
}
```

- [ ] **Step 7: Create `lib/admin/debug-panel.ts`**

```ts
import "server-only";

export function debugPanelConfigured(): boolean {
  return !!(process.env.DEBUG_PANEL_URL && process.env.DEBUG_TOKEN);
}

/** Server-side call to the bot DebugPanel; the token never reaches the browser. */
export async function fetchDebugPanel(path: string, timeoutMs = 3000): Promise<Response> {
  const base = (process.env.DEBUG_PANEL_URL || "").replace(/\/$/, "");
  const url = new URL(base + path);
  url.searchParams.set("token", process.env.DEBUG_TOKEN || "");
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
}
```

- [ ] **Step 8: Create `lib/bot-commands.ts`**

```ts
import "server-only";
import { BotCommand, IBotCommand } from "./models/BotCommand";
import { connectToDatabase } from "./mongodb";

export interface CommandOutcome {
  id: string;
  status: "completed" | "failed" | "pending";
  result?: string;
  error?: string;
}

/** Insert a `botcommands` document and poll until the bot processes it or the timeout elapses. */
export async function enqueueAndWait(doc: Partial<IBotCommand>, timeoutMs = 5000): Promise<CommandOutcome> {
  await connectToDatabase();
  const created = await BotCommand.create({ ...doc, status: "pending" });
  const id = String(created._id);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = (await BotCommand.findById(id).lean()) as IBotCommand | null;
    if (row && row.status === "completed") return { id, status: "completed", result: row.result };
    if (row && row.status === "failed") return { id, status: "failed", error: row.error || "Command failed" };
    await new Promise((r) => setTimeout(r, 150));
  }
  return { id, status: "pending" };
}
```

- [ ] **Step 9: Create `types/admin.ts`**

```ts
import type { IBotHeartbeat, IGuildSettings, IPlaybackState, LinkedBotStatus } from "../../../shared/types";
import type { DailyPoint, Freshness } from "@/lib/admin/aggregate";

export type { IBotHeartbeat, DailyPoint };

export interface InfraCheck {
  ok: boolean;
  ms: number | null;
}

export interface AdminOverview {
  status: { heartbeat: IBotHeartbeat | null; state: Freshness; ageSec: number | null };
  infra: { redis: InfraCheck; mongo: InfraCheck; debugPanel: InfraCheck & { configured: boolean } };
  totals: {
    guilds: number;
    members: number;
    playing: number;
    paused: number;
    premiumUsers: number;
    premiumGuilds: number;
    linkedBots: Record<LinkedBotStatus, number>;
    guildsWithSettings: number;
  };
  activity: {
    commands24h: number;
    commandsPrev24h: number;
    tracks24h: number;
    tracksPrev24h: number;
    errors24h: number;
    errorRate24h: number;
    uniqueUsers7d: number;
    uniqueGuilds7d: number;
  };
  series14d: DailyPoint[];
  topCommands7d: { command: string; count: number; failed: number }[];
  sources7d: { source: string; starts: number; errors: number }[];
  recentErrors: RecentError[];
  membership30d: { joins: number; leaves: number; recent: MembershipEvent[] };
  generatedAt: string;
}

export interface RecentError {
  ts: string;
  kind: "error" | "command" | "track";
  scope?: string;
  guildId?: string;
  guildName?: string;
  command?: string;
  track?: string;
  message: string;
}

export interface MembershipEvent {
  ts: string;
  event: "join" | "leave";
  guildId: string;
  name: string;
  memberCount: number;
}

export interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  joinedAt: number;
  hasSettings: boolean;
  isCurrentlyPlaying: boolean;
  lastActive?: string;
  premium: { active: boolean; bitrate: number; tier?: string } | null;
  settingsSummary: {
    djRoleId: string | null;
    language: string;
    maxQueueSize: number;
    logChannelId: string | null;
    totalSongsPlayed: number;
    totalPlaytime: number;
  } | null;
  activity7d: { commands: number; tracks: number };
  playback: {
    isPlaying: boolean;
    isPaused: boolean;
    currentTrack: string | null;
    queueSize: number;
    voiceChannelName: string | null;
  } | null;
}

export interface AdminGuildsResponse {
  guilds: AdminGuild[];
  stats: {
    totalGuilds: number;
    totalMembers: number;
    activeGuilds: number;
    guildsWithSettings: number;
    premiumGuilds: number;
  };
}

export interface GuildEventRow {
  ts: string;
  kind: string;
  summary: string;
  ok?: boolean;
}

export interface AdminGuildDetail {
  guild: AdminGuild | null;
  settings: Partial<IGuildSettings> | null;
  premium: { active: boolean; bitrate: number; discordId: string; linkedAt: string; tier?: string } | null;
  playback: Pick<IPlaybackState, "isPlaying" | "isPaused" | "volume" | "queueSize" | "voiceChannelName" | "currentTrack" | "loopMode" | "audioBitrate"> & { lastUpdated: string } | null;
  events: GuildEventRow[];
  activity: {
    commands7d: number;
    tracks7d: number;
    topCommands: { command: string; count: number }[];
    topRequesters: { userId: string; count: number }[];
  };
}

export interface AuditEntry {
  ts: string;
  actorId: string;
  actorName: string;
  action: string;
  targetGuildId?: string;
  targetName?: string;
  ok: boolean;
  result?: string;
  error?: string;
}

export interface LogEntry {
  ts: string;
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
}

export interface ActionResult {
  ok: boolean;
  result?: string;
  error?: string;
}
```

- [ ] **Step 10: Type-check and commit**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json`
```bash
git add dashboard/src/lib dashboard/src/types/admin.ts
git commit -m "feat(dashboard): owner gates, audit log, bot event model and admin libs"
```

---

### Task 9: Overview aggregation and `GET /api/admin/overview`

**Files:**
- Create: `dashboard/src/lib/admin/overview.ts`, `dashboard/src/app/api/admin/overview/route.ts`

**Interfaces:**
- Consumes: `getAllBotGuildsData`, `getBotStatus`, `pingRedis` (redis), `connectToDatabase`, models `BotEventModel`, `PatreonUserModel`, `PremiumGuild`, `LinkedBotModel`, `GuildSettingsModel`, `PlaybackState`, `fetchDebugPanel`, `debugPanelConfigured`, `fillDailySeries`, `errorRate`, `freshness`, `requireOwner`, `adminJson`.
- Produces: `loadOverview(): Promise<AdminOverview>`.

- [ ] **Step 1: Create `lib/admin/overview.ts`**

```ts
import "server-only";
import mongoose from "mongoose";
import type { IBotHeartbeat, LinkedBotStatus } from "../../../../shared/types";
import type { AdminOverview, MembershipEvent, RecentError } from "@/types/admin";
import { BotEventModel, IBotEventRecord } from "../models/BotEvent";
import { GuildSettingsModel } from "../models/GuildSettings";
import { LinkedBotModel } from "../models/LinkedBot";
import { PatreonUserModel } from "../models/PatreonUser";
import { PlaybackState } from "../models/PlaybackState";
import { PremiumGuild } from "../models/PremiumGuild";
import { connectToDatabase } from "../mongodb";
import { getAllBotGuildsData, getBotStatus, pingRedis } from "../redis";
import { errorRate, fillDailySeries, freshness } from "./aggregate";
import { debugPanelConfigured, fetchDebugPanel } from "./debug-panel";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Any event that counts as an error for the admin console. */
const ERROR_MATCH = {
  $or: [{ kind: "error" }, { kind: "command", ok: false }, { kind: "track", event: "error" }]
};

const EMPTY_LINKED: Record<LinkedBotStatus, number> = { offline: 0, starting: 0, online: 0, error: 0, stopped: 0 };

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number | null; value: T | null }> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch {
    return { ok: false, ms: null, value: null };
  }
}

export async function loadOverview(now: Date = new Date()): Promise<AdminOverview> {
  const nowMs = now.getTime();
  const d24 = new Date(nowMs - DAY);
  const d48 = new Date(nowMs - 2 * DAY);
  const d7 = new Date(nowMs - 7 * DAY);
  const d14 = new Date(nowMs - 14 * DAY);
  const d30 = new Date(nowMs - 30 * DAY);

  // ── Redis: heartbeat + guild inventory ─────────────────────
  const redis = await pingRedis();
  const heartbeat = redis.ok ? ((await getBotStatus()) as IBotHeartbeat | null) : null;
  const guilds = redis.ok ? await getAllBotGuildsData() : [];
  const guildNames = new Map(guilds.map((g) => [g.id, g.name]));
  const fresh = freshness(heartbeat?.ts ?? null, nowMs);

  // ── Mongo ──────────────────────────────────────────────────
  const mongo = await timed(async () => {
    const conn = await connectToDatabase();
    await conn.db?.admin().ping();
  });

  const debugPanel = debugPanelConfigured()
    ? await timed(async () => {
        const r = await fetchDebugPanel("/api/status", 2000);
        if (!r.ok) throw new Error(String(r.status));
      })
    : { ok: false, ms: null, value: null };

  let totals: AdminOverview["totals"] = {
    guilds: guilds.length,
    members: guilds.reduce((s, g) => s + (g.memberCount || 0), 0),
    playing: fresh.state === "fresh" ? heartbeat?.queues.playing ?? 0 : 0,
    paused: fresh.state === "fresh" ? heartbeat?.queues.paused ?? 0 : 0,
    premiumUsers: 0,
    premiumGuilds: 0,
    linkedBots: { ...EMPTY_LINKED },
    guildsWithSettings: 0
  };
  let activity: AdminOverview["activity"] = {
    commands24h: 0,
    commandsPrev24h: 0,
    tracks24h: 0,
    tracksPrev24h: 0,
    errors24h: 0,
    errorRate24h: 0,
    uniqueUsers7d: 0,
    uniqueGuilds7d: 0
  };
  let series14d = fillDailySeries([], 14, now);
  let topCommands7d: AdminOverview["topCommands7d"] = [];
  let sources7d: AdminOverview["sources7d"] = [];
  let recentErrors: RecentError[] = [];
  let membership30d: AdminOverview["membership30d"] = { joins: 0, leaves: 0, recent: [] };

  if (mongo.ok) {
    try {
      const [
        premiumUsers,
        premiumGuilds,
        linkedRows,
        guildsWithSettings,
        playbackRows,
        commands24h,
        commandsPrev24h,
        tracks24h,
        tracksPrev24h,
        errors24h,
        uniqueUsers,
        uniqueGuilds,
        seriesRows,
        topRows,
        sourceRows,
        errorRows,
        joins,
        leaves,
        membershipRows
      ] = await Promise.all([
        PatreonUserModel.countDocuments({ isPremium: true }),
        PremiumGuild.countDocuments({ isActive: true }),
        LinkedBotModel.aggregate<{ _id: LinkedBotStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
        GuildSettingsModel.countDocuments({}),
        fresh.state === "fresh"
          ? Promise.resolve([] as { isPlaying: boolean; isPaused: boolean }[])
          : PlaybackState.find({}).select("isPlaying isPaused").lean<{ isPlaying: boolean; isPaused: boolean }[]>(),
        BotEventModel.countDocuments({ kind: "command", ts: { $gte: d24 } }),
        BotEventModel.countDocuments({ kind: "command", ts: { $gte: d48, $lt: d24 } }),
        BotEventModel.countDocuments({ kind: "track", event: "start", ts: { $gte: d24 } }),
        BotEventModel.countDocuments({ kind: "track", event: "start", ts: { $gte: d48, $lt: d24 } }),
        BotEventModel.countDocuments({ ts: { $gte: d24 }, ...ERROR_MATCH }),
        BotEventModel.distinct("userId", { kind: "command", ts: { $gte: d7 } }),
        BotEventModel.distinct("guildId", { kind: { $in: ["command", "track"] }, ts: { $gte: d7 } }),
        BotEventModel.aggregate<{ _id: string; commands: number; tracks: number; errors: number }>([
          { $match: { ts: { $gte: d14 } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } },
              commands: { $sum: { $cond: [{ $eq: ["$kind", "command"] }, 1, 0] } },
              tracks: {
                $sum: { $cond: [{ $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "start"] }] }, 1, 0] }
              },
              errors: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$kind", "error"] },
                        { $and: [{ $eq: ["$kind", "command"] }, { $eq: ["$ok", false] }] },
                        { $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "error"] }] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        BotEventModel.aggregate<{ _id: string; count: number; failed: number }>([
          { $match: { kind: "command", ts: { $gte: d7 } } },
          { $group: { _id: "$command", count: { $sum: 1 }, failed: { $sum: { $cond: ["$ok", 0, 1] } } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        BotEventModel.aggregate<{ _id: string; starts: number; errors: number }>([
          { $match: { kind: "track", event: { $in: ["start", "error"] }, ts: { $gte: d7 } } },
          {
            $group: {
              _id: "$source",
              starts: { $sum: { $cond: [{ $eq: ["$event", "start"] }, 1, 0] } },
              errors: { $sum: { $cond: [{ $eq: ["$event", "error"] }, 1, 0] } }
            }
          },
          { $sort: { starts: -1 } }
        ]),
        BotEventModel.find(ERROR_MATCH).sort({ ts: -1 }).limit(20).lean<IBotEventRecord[]>(),
        BotEventModel.countDocuments({ kind: "guild", event: "join", ts: { $gte: d30 } }),
        BotEventModel.countDocuments({ kind: "guild", event: "leave", ts: { $gte: d30 } }),
        BotEventModel.find({ kind: "guild", ts: { $gte: d30 } }).sort({ ts: -1 }).limit(10).lean<IBotEventRecord[]>()
      ]);

      const linkedBots = { ...EMPTY_LINKED };
      for (const r of linkedRows) if (r._id in linkedBots) linkedBots[r._id] = r.n;

      totals = {
        ...totals,
        premiumUsers,
        premiumGuilds,
        linkedBots,
        guildsWithSettings,
        playing: fresh.state === "fresh" ? totals.playing : playbackRows.filter((p) => p.isPlaying).length,
        paused: fresh.state === "fresh" ? totals.paused : playbackRows.filter((p) => p.isPaused).length
      };

      activity = {
        commands24h,
        commandsPrev24h,
        tracks24h,
        tracksPrev24h,
        errors24h,
        errorRate24h: errorRate(errors24h, commands24h + tracks24h),
        uniqueUsers7d: uniqueUsers.filter(Boolean).length,
        uniqueGuilds7d: uniqueGuilds.filter(Boolean).length
      };

      series14d = fillDailySeries(
        seriesRows.map((r) => ({ date: r._id, commands: r.commands, tracks: r.tracks, errors: r.errors })),
        14,
        now
      );
      topCommands7d = topRows.map((r) => ({ command: r._id || "unknown", count: r.count, failed: r.failed }));
      sources7d = sourceRows.map((r) => ({ source: r._id || "unknown", starts: r.starts, errors: r.errors }));
      recentErrors = errorRows.map((e) => toRecentError(e, guildNames));
      membership30d = {
        joins,
        leaves,
        recent: membershipRows.map<MembershipEvent>((e) => ({
          ts: new Date(e.ts).toISOString(),
          event: e.event === "leave" ? "leave" : "join",
          guildId: e.guildId || "",
          name: e.name || guildNames.get(e.guildId || "") || e.guildId || "unknown",
          memberCount: e.memberCount || 0
        }))
      };
    } catch (error) {
      console.error("[admin/overview] Mongo aggregation failed:", error);
    }
  }

  return {
    status: { heartbeat, state: fresh.state, ageSec: fresh.ageSec },
    infra: {
      redis: { ok: redis.ok, ms: redis.ms },
      mongo: { ok: mongo.ok, ms: mongo.ms },
      debugPanel: { configured: debugPanelConfigured(), ok: debugPanel.ok, ms: debugPanel.ms }
    },
    totals,
    activity,
    series14d,
    topCommands7d,
    sources7d,
    recentErrors,
    membership30d,
    generatedAt: now.toISOString()
  };
}

function toRecentError(e: IBotEventRecord, guildNames: Map<string, string>): RecentError {
  const base = {
    ts: new Date(e.ts).toISOString(),
    guildId: e.guildId,
    guildName: e.guildId ? guildNames.get(e.guildId) : undefined
  };
  if (e.kind === "command") {
    return { ...base, kind: "command", command: e.command, message: e.error || "Command failed" };
  }
  if (e.kind === "track") {
    return { ...base, kind: "track", track: e.title, message: e.error || "Track error" };
  }
  return { ...base, kind: "error", scope: e.scope, command: e.command, track: e.track, message: e.message || "Error" };
}

// Keep mongoose import referenced for connection typing in some TS configs.
void mongoose;
```

- [ ] **Step 2: Create `app/api/admin/overview/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { loadOverview } from "@/lib/admin/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  try {
    return adminJson(await loadOverview());
  } catch (error) {
    console.error("[admin/overview] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
```

- [ ] **Step 3: Type-check and manual probe**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json`
Run: `cd dashboard && npm run dev` then `curl -i http://localhost:4123/api/admin/overview`
Expected: `401 {"error":"Unauthorized"}` with `Cache-Control: no-store`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/admin/overview.ts dashboard/src/app/api/admin/overview/route.ts
git commit -m "feat(admin): overview aggregation endpoint"
```

---

### Task 10: Guilds list extension and guild detail endpoint

**Files:**
- Modify: `dashboard/src/app/api/admin/guilds/route.ts` (rewrite)
- Create: `dashboard/src/app/api/admin/guilds/[guildId]/route.ts`

**Interfaces:**
- Consumes: Task 8 gates/models, `AdminGuild`, `AdminGuildsResponse`, `AdminGuildDetail`, `GuildEventRow` types.
- Produces: `GET /api/admin/guilds` → `AdminGuildsResponse`; `GET /api/admin/guilds/:id` → `AdminGuildDetail`.

- [ ] **Step 1: Rewrite `guilds/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { BotEventModel } from "@/lib/models/BotEvent";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { IPlaybackState, PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getAllBotGuildsData } from "@/lib/redis";
import type { AdminGuild, AdminGuildsResponse } from "@/types/admin";
import { IGuildSettings } from "../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface PremiumRow {
  guildId: string;
  isActive: boolean;
  audioBitrate: number;
}
interface ActivityRow {
  _id: string;
  commands: number;
  tracks: number;
  last: Date;
}

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;

  try {
    const guilds = await getAllBotGuildsData();
    const guildIds = guilds.map((g) => g.id);
    const d7 = new Date(Date.now() - 7 * 86400_000);

    let settingsData: IGuildSettings[] = [];
    let playbackData: IPlaybackState[] = [];
    let premiumData: PremiumRow[] = [];
    let activityData: ActivityRow[] = [];
    try {
      await connectToDatabase();
      [settingsData, playbackData, premiumData, activityData] = await Promise.all([
        GuildSettingsModel.find({ guildId: { $in: guildIds } }).lean<IGuildSettings[]>(),
        PlaybackState.find({ guildId: { $in: guildIds } }).lean<IPlaybackState[]>(),
        PremiumGuild.find({ guildId: { $in: guildIds }, isActive: true }).select("guildId isActive audioBitrate").lean<PremiumRow[]>(),
        BotEventModel.aggregate<ActivityRow>([
          { $match: { guildId: { $in: guildIds }, kind: { $in: ["command", "track"] }, ts: { $gte: d7 } } },
          {
            $group: {
              _id: "$guildId",
              commands: { $sum: { $cond: [{ $eq: ["$kind", "command"] }, 1, 0] } },
              tracks: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "track"] }, { $eq: ["$event", "start"] }] }, 1, 0] } },
              last: { $max: "$ts" }
            }
          }
        ])
      ]);
    } catch (dbError) {
      console.error("[admin/guilds] MongoDB unavailable, serving Redis-only data:", dbError);
    }

    const settingsMap = new Map(settingsData.map((s) => [s.guildId, s]));
    const playbackMap = new Map(playbackData.map((p) => [p.guildId, p]));
    const premiumMap = new Map(premiumData.map((p) => [p.guildId, p]));
    const activityMap = new Map(activityData.map((a) => [a._id, a]));

    const rows: AdminGuild[] = guilds.map((guild) => {
      const settings = settingsMap.get(guild.id);
      const playback = playbackMap.get(guild.id);
      const premium = premiumMap.get(guild.id);
      const activity = activityMap.get(guild.id);
      const lastCandidates = [playback?.lastUpdated, activity?.last]
        .filter((d): d is Date => !!d)
        .map((d) => new Date(d).getTime());
      const lastActive = lastCandidates.length ? new Date(Math.max(...lastCandidates)).toISOString() : undefined;

      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        hasSettings: !!settings,
        isCurrentlyPlaying: playback?.isPlaying || false,
        lastActive,
        premium: premium ? { active: premium.isActive, bitrate: premium.audioBitrate } : null,
        settingsSummary: settings
          ? {
              djRoleId: settings.djRoleId ?? null,
              language: settings.language,
              maxQueueSize: settings.maxQueueSize,
              logChannelId: settings.logChannelId ?? null,
              totalSongsPlayed: settings.totalSongsPlayed || 0,
              totalPlaytime: settings.totalPlaytime || 0
            }
          : null,
        activity7d: { commands: activity?.commands || 0, tracks: activity?.tracks || 0 },
        playback: playback
          ? {
              isPlaying: playback.isPlaying,
              isPaused: playback.isPaused,
              currentTrack: playback.currentTrack?.title ?? null,
              queueSize: playback.queueSize || 0,
              voiceChannelName: playback.voiceChannelName ?? null
            }
          : null
      };
    });

    rows.sort((a, b) => b.memberCount - a.memberCount);

    const body: AdminGuildsResponse = {
      guilds: rows,
      stats: {
        totalGuilds: guilds.length,
        totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
        activeGuilds: playbackData.filter((p) => p.isPlaying).length,
        guildsWithSettings: settingsData.length,
        premiumGuilds: premiumData.length
      }
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/guilds] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
```

- [ ] **Step 2: Create `guilds/[guildId]/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { isSnowflake } from "@/lib/admin/guards";
import { BotEventModel, IBotEventRecord } from "@/lib/models/BotEvent";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { IPlaybackState, PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getBotGuildData } from "@/lib/redis";
import type { AdminGuildDetail, GuildEventRow } from "@/types/admin";
import { IGuildSettings } from "../../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

function summarize(e: IBotEventRecord): GuildEventRow {
  const ts = new Date(e.ts).toISOString();
  switch (e.kind) {
    case "command":
      return { ts, kind: "command", ok: e.ok, summary: `/${e.command}${e.subcommand ? " " + e.subcommand : ""}${e.ok ? "" : " — " + (e.error || "failed")}` };
    case "track":
      return { ts, kind: `track:${e.event}`, ok: e.event !== "error", summary: `${e.title || "?"} · ${e.source || "?"}${e.error ? " — " + e.error : ""}` };
    case "guild":
      return { ts, kind: `guild:${e.event}`, summary: `${e.event === "join" ? "Bot joined" : "Bot left"} (${e.memberCount ?? "?"} members)` };
    default:
      return { ts, kind: `error:${e.scope}`, ok: false, summary: e.message || "Error" };
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { guildId } = await params;
  if (!isSnowflake(guildId)) return adminJson({ error: "Invalid guild id" }, 400);

  try {
    const guild = await getBotGuildData(guildId);
    await connectToDatabase();
    const d7 = new Date(Date.now() - 7 * 86400_000);
    const [settings, premium, playback, events, commands7d, tracks7d, topCommands, topRequesters] = await Promise.all([
      GuildSettingsModel.findOne({ guildId }).lean<IGuildSettings | null>(),
      PremiumGuild.findOne({ guildId, isActive: true }).lean<{ isActive: boolean; audioBitrate: number; discordId: string; linkedAt: Date } | null>(),
      PlaybackState.findOne({ guildId }).lean<IPlaybackState | null>(),
      BotEventModel.find({ guildId }).sort({ ts: -1 }).limit(30).lean<IBotEventRecord[]>(),
      BotEventModel.countDocuments({ guildId, kind: "command", ts: { $gte: d7 } }),
      BotEventModel.countDocuments({ guildId, kind: "track", event: "start", ts: { $gte: d7 } }),
      BotEventModel.aggregate<{ _id: string; count: number }>([
        { $match: { guildId, kind: "command", ts: { $gte: d7 } } },
        { $group: { _id: "$command", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      BotEventModel.aggregate<{ _id: string; count: number }>([
        { $match: { guildId, kind: "track", event: "start", ts: { $gte: d7 }, requestedById: { $exists: true } } },
        { $group: { _id: "$requestedById", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    if (!guild && !settings && events.length === 0) return adminJson({ error: "Guild not found" }, 404);

    const body: AdminGuildDetail = {
      guild: guild
        ? {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: guild.memberCount,
            ownerId: guild.ownerId,
            joinedAt: guild.joinedAt,
            hasSettings: !!settings,
            isCurrentlyPlaying: playback?.isPlaying || false,
            premium: premium ? { active: premium.isActive, bitrate: premium.audioBitrate } : null,
            settingsSummary: null,
            activity7d: { commands: commands7d, tracks: tracks7d },
            playback: null
          }
        : null,
      settings: settings
        ? {
            djRoleId: settings.djRoleId,
            adminRoleId: settings.adminRoleId,
            language: settings.language,
            defaultVolume: settings.defaultVolume,
            maxVolume: settings.maxVolume,
            maxQueueSize: settings.maxQueueSize,
            maxSongDuration: settings.maxSongDuration,
            autoLeaveEmpty: settings.autoLeaveEmpty,
            announceNowPlaying: settings.announceNowPlaying,
            logChannelId: settings.logChannelId,
            allowedTextChannels: settings.allowedTextChannels,
            allowedVoiceChannels: settings.allowedVoiceChannels,
            blacklistedUsers: settings.blacklistedUsers,
            disabledCommands: settings.disabledCommands,
            totalSongsPlayed: settings.totalSongsPlayed,
            totalPlaytime: settings.totalPlaytime,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt
          }
        : null,
      premium: premium
        ? { active: premium.isActive, bitrate: premium.audioBitrate, discordId: premium.discordId, linkedAt: new Date(premium.linkedAt).toISOString() }
        : null,
      playback: playback
        ? {
            isPlaying: playback.isPlaying,
            isPaused: playback.isPaused,
            volume: playback.volume,
            queueSize: playback.queueSize,
            voiceChannelName: playback.voiceChannelName,
            currentTrack: playback.currentTrack,
            loopMode: playback.loopMode,
            audioBitrate: playback.audioBitrate,
            lastUpdated: new Date(playback.lastUpdated).toISOString()
          }
        : null,
      events: events.map(summarize),
      activity: {
        commands7d,
        tracks7d,
        topCommands: topCommands.map((r) => ({ command: r._id, count: r.count })),
        topRequesters: topRequesters.map((r) => ({ userId: r._id, count: r.count }))
      }
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/guilds/:id] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
```

- [ ] **Step 3: Type-check, then commit**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json`
```bash
git add "dashboard/src/app/api/admin/guilds"
git commit -m "feat(admin): richer guild list and guild detail endpoints"
```

---

### Task 11: Logs proxy and audit endpoints

**Files:**
- Create: `dashboard/src/app/api/admin/logs/route.ts`, `dashboard/src/app/api/admin/audit/route.ts`

**Interfaces:**
- Produces: `GET /api/admin/logs?last=200&level=&search=` → `{ entries: LogEntry[] }`; `GET /api/admin/audit?limit=50` → `{ entries: AuditEntry[] }`.

- [ ] **Step 1: Create `logs/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { debugPanelConfigured, fetchDebugPanel } from "@/lib/admin/debug-panel";

export const dynamic = "force-dynamic";

const LEVELS = new Set(["log", "info", "warn", "error", "debug"]);

export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  if (!debugPanelConfigured()) return adminJson({ error: "not_configured" }, 501);

  const url = new URL(request.url);
  const last = Math.min(1000, Math.max(1, Number(url.searchParams.get("last")) || 200));
  const level = url.searchParams.get("level") || "";
  const search = (url.searchParams.get("search") || "").slice(0, 200);

  const qs = new URLSearchParams({ last: String(last) });
  if (LEVELS.has(level)) qs.set("level", level);
  if (search) qs.set("search", search);

  try {
    const res = await fetchDebugPanel(`/api/logs?${qs.toString()}`);
    if (!res.ok) return adminJson({ error: `Debug panel responded ${res.status}` }, 502);
    const entries = await res.json();
    return adminJson({ entries });
  } catch (error) {
    console.error("[admin/logs] debug panel unreachable:", error);
    return adminJson({ error: "Debug panel unreachable" }, 502);
  }
}
```

- [ ] **Step 2: Create `audit/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { listAudit } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  try {
    return adminJson({ entries: await listAudit(limit) });
  } catch (error) {
    console.error("[admin/audit] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
```

- [ ] **Step 3: Type-check and commit**

```bash
git add dashboard/src/app/api/admin/logs dashboard/src/app/api/admin/audit
git commit -m "feat(admin): log proxy and audit endpoints"
```

---

### Task 12: Action endpoints (leave, stop, resync)

**Files:**
- Create: `dashboard/src/app/api/admin/guilds/[guildId]/leave/route.ts`, `.../stop/route.ts`, `dashboard/src/app/api/admin/resync/route.ts`

**Interfaces:**
- Consumes: `requireOwnerAction`, `leaveGuild`, `enqueueAndWait`, `writeAudit`, `requestMeta`, `removeBotGuild`, `getBotGuildData`, `isSnowflake`.
- Produces: each returns `ActionResult` (`{ ok, result?, error? }`).

- [ ] **Step 1: `leave/route.ts`**

```ts
import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { leaveGuild } from "@/lib/admin/discord-bot";
import { isSnowflake } from "@/lib/admin/guards";
import { getBotGuildData, removeBotGuild } from "@/lib/redis";
import type { ActionResult } from "@/types/admin";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;
  const { guildId } = await params;
  if (!isSnowflake(guildId)) return adminJson({ ok: false, error: "Invalid guild id" } satisfies ActionResult, 400);

  const guild = await getBotGuildData(guildId);
  if (!guild) return adminJson({ ok: false, error: "Bot is not in this server" } satisfies ActionResult, 404);

  const outcome = await leaveGuild(guildId);
  const meta = requestMeta(request);
  if (outcome.ok) {
    await removeBotGuild(guildId).catch(() => undefined);
    await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "guild.leave", targetGuildId: guildId, targetName: guild.name, ok: true, result: "left", ...meta });
    return adminJson({ ok: true, result: `Left ${guild.name}` } satisfies ActionResult);
  }
  await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "guild.leave", targetGuildId: guildId, targetName: guild.name, ok: false, error: outcome.error, ...meta });
  return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, outcome.status === 429 ? 429 : 502);
}
```

- [ ] **Step 2: `stop/route.ts`**

```ts
import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { isSnowflake } from "@/lib/admin/guards";
import { enqueueAndWait } from "@/lib/bot-commands";
import { getBotGuildData } from "@/lib/redis";
import type { ActionResult } from "@/types/admin";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;
  const { guildId } = await params;
  if (!isSnowflake(guildId)) return adminJson({ ok: false, error: "Invalid guild id" } satisfies ActionResult, 400);

  const guild = await getBotGuildData(guildId);
  const meta = requestMeta(request);
  try {
    const outcome = await enqueueAndWait({
      guildId,
      command: "stop",
      params: {},
      userId: gate.owner.discordId,
      requestedBy: { id: gate.owner.discordId, username: gate.owner.name }
    });
    const ok = outcome.status !== "failed";
    await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "guild.stop", targetGuildId: guildId, targetName: guild?.name, ok, result: outcome.result ?? outcome.status, error: outcome.error, ...meta });
    if (!ok) return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, 400);
    return adminJson({ ok: true, result: outcome.status === "pending" ? "Queued (bot busy)" : outcome.result || "Stopped" } satisfies ActionResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "guild.stop", targetGuildId: guildId, targetName: guild?.name, ok: false, error: message, ...meta });
    return adminJson({ ok: false, error: message } satisfies ActionResult, 500);
  }
}
```

- [ ] **Step 3: `resync/route.ts`**

```ts
import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { enqueueAndWait } from "@/lib/bot-commands";
import type { ActionResult } from "@/types/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;
  const meta = requestMeta(request);
  try {
    const outcome = await enqueueAndWait({ type: "admin_resync", requestedBy: { id: gate.owner.discordId, username: gate.owner.name } });
    const ok = outcome.status !== "failed";
    await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "bot.resync", ok, result: outcome.result ?? outcome.status, error: outcome.error, ...meta });
    if (!ok) return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, 400);
    return adminJson({ ok: true, result: outcome.status === "pending" ? "Queued (bot did not answer in 5 s)" : outcome.result } satisfies ActionResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeAudit({ actorId: gate.owner.discordId, actorName: gate.owner.name, action: "bot.resync", ok: false, error: message, ...meta });
    return adminJson({ ok: false, error: message } satisfies ActionResult, 500);
  }
}
```

- [ ] **Step 4: Type-check, probe CSRF guard, commit**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json`
Probe (dev server running): `curl -i -X POST http://localhost:4123/api/admin/resync` → `401`.
```bash
git add dashboard/src/app/api/admin/resync "dashboard/src/app/api/admin/guilds/[guildId]/leave" "dashboard/src/app/api/admin/guilds/[guildId]/stop"
git commit -m "feat(admin): audited owner actions (leave, stop, resync)"
```

---

### Task 13: `/admin` page shell, polling hook, status strip and KPIs

**Files:**
- Rewrite: `dashboard/src/app/(dashboard)/admin/page.tsx`
- Create: `dashboard/src/components/admin/usePolling.ts`, `ui.tsx`, `Toast.tsx`, `SectionNav.tsx`, `StatusStrip.tsx`, `KpiGrid.tsx`, `AdminConsole.tsx`

**Interfaces:**
- Consumes: `isOwnerSession` (admin-auth), `AdminOverview`, `AdminGuildsResponse`, `AuditEntry`, formatters from `lib/admin/format`.
- Produces:
  - `usePolling<T>(url: string | null, intervalMs: number): { data: T | null; error: string | null; loading: boolean; refresh: () => void }`
  - `ui.tsx`: `Panel`, `Label`, `SectionHead({ kicker, title, note })`, `Chip({ tone, children })` with `tone: "signal" | "amber" | "clip" | "dust"`, `Button({ tone, ...props })`, `iconUrl(id, icon, size?)`
  - `Toast.tsx`: `useToast(): { toast: ToastState | null; show(message, tone?) }` and `<ToastView toast />`
  - `AdminConsole` renders every section; later tasks fill `ActivityCharts`, `ErrorsList`, `ServersTable`, `GuildDrawer`, `PremiumPanel`, `LogsPanel`, `AuditPanel` (Task 13 stubs them as `null` placeholders that Tasks 14–16 replace).

- [ ] **Step 1: Rewrite `app/(dashboard)/admin/page.tsx`**

```tsx
import { isOwnerSession } from "@/lib/admin-auth";
import AdminConsole from "@/components/admin/AdminConsole";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

export default async function AdminPage() {
  if (!(await isOwnerSession())) redirect("/dashboard");
  return <AdminConsole />;
}
```

- [ ] **Step 2: Create `components/admin/usePolling.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

/** Fetch JSON now and every `intervalMs` while the tab is visible. `url = null` disables. */
export function usePolling<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    if (intervalMs <= 0) return () => void (cancelled = true);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs, tick]);

  return { data, error, loading, refresh };
}

/** POST an admin action and normalise the response. */
export async function postAction(url: string): Promise<{ ok: boolean; result?: string; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}` };
    return { ok: body.ok !== false, result: body.result, error: body.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
```

- [ ] **Step 3: Create `components/admin/ui.tsx`**

```tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Tone = "signal" | "amber" | "clip" | "dust";

const toneText: Record<Tone, string> = {
  signal: "text-signal border-signal/40 bg-signal/10",
  amber: "text-amber border-amber/40 bg-amber/10",
  clip: "text-clip border-clip/40 bg-clip/10",
  dust: "text-dune border-line-bright bg-panel-raised"
};

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`console-panel rounded-xl p-5 ${className}`}>{children}</div>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`console-label ${className}`}>{children}</div>;
}

export function SectionHead({ kicker, title, note, action }: { kicker: string; title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-4">
        <span className="console-label text-amber!">{kicker}</span>
        <span className="flex-1 h-px bg-line" />
        {note && <span className="console-label">{note}</span>}
        {action}
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight mt-3 text-cream">{title}</h2>
    </div>
  );
}

export function Chip({ tone = "dust", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${toneText[tone]}`}>
      {children}
    </span>
  );
}

export function Button({ tone = "dust", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const base = "px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-amber";
  const tones: Record<Tone, string> = {
    signal: "border-signal/50 text-signal hover:bg-signal/10",
    amber: "border-amber/60 text-amber hover:bg-amber/10",
    clip: "border-clip/60 text-clip hover:bg-clip/10",
    dust: "border-line-bright text-dune hover:text-cream hover:border-amber/60"
  };
  return <button className={`${base} ${tones[tone]} ${className}`} {...props} />;
}

export function iconUrl(id: string, icon: string | null, size = 64): string {
  if (!icon) return "";
  const fmt = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${fmt}?size=${size}`;
}

export function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="eq scale-150">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function Unavailable({ what }: { what: string }) {
  return (
    <div className="console-panel rounded-xl p-6 text-center">
      <span className="led led--amber inline-block mr-2 align-middle" />
      <span className="font-mono text-sm text-dune">{what} unavailable</span>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/admin/Toast.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tone } from "./ui";

export interface ToastState {
  message: string;
  tone: Tone;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const show = useCallback((message: string, tone: Tone = "signal") => setToast({ message, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  return { toast, show };
}

export function ToastView({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const color = toast.tone === "clip" ? "border-clip/60 text-clip" : toast.tone === "amber" ? "border-amber/60 text-amber" : "border-signal/60 text-signal";
  return (
    <div role="status" className={`fixed bottom-6 right-6 z-50 console-panel rounded-lg px-4 py-3 font-mono text-sm ${color}`}>
      {toast.message}
    </div>
  );
}
```

- [ ] **Step 5: Create `components/admin/SectionNav.tsx`**

```tsx
"use client";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "servers", label: "Servers" },
  { id: "activity", label: "Activity" },
  { id: "premium", label: "Premium & Bots" },
  { id: "logs", label: "Logs" },
  { id: "audit", label: "Audit" }
] as const;

export function SectionNav() {
  return (
    <nav aria-label="Admin sections" className="sticky top-16 z-20 -mx-2 mb-8 overflow-x-auto bg-coal/90 backdrop-blur px-2 py-2 border-b border-line">
      <ul className="flex gap-1 min-w-max">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="block rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-dune hover:text-cream hover:bg-panel-raised">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Create `components/admin/StatusStrip.tsx`**

```tsx
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
          <span className="led" style={{ background: led.color, boxShadow: `0 0 6px ${led.color}, 0 0 14px ${led.color}66` }} />
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
          <Chip tone={infra.redis.ok ? "signal" : "clip"} title="Redis round-trip">Redis {infra.redis.ms !== null ? `${infra.redis.ms}ms` : "down"}</Chip>
          <Chip tone={infra.mongo.ok ? "signal" : "clip"} title="MongoDB ping">Mongo {infra.mongo.ms !== null ? `${infra.mongo.ms}ms` : "down"}</Chip>
          <Chip tone={!infra.debugPanel.configured ? "dust" : infra.debugPanel.ok ? "signal" : "clip"} title="Bot debug panel">
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
```

- [ ] **Step 7: Create `components/admin/KpiGrid.tsx`**

```tsx
"use client";

import { delta } from "@/lib/admin/aggregate";
import { compact, pct } from "@/lib/admin/format";
import type { AdminOverview } from "@/types/admin";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "signal" | "clip" }) {
  const subColor = tone === "signal" ? "text-signal" : tone === "clip" ? "text-clip" : "text-dust";
  return (
    <div className="console-panel rounded-xl p-5">
      <div className="console-label">{label}</div>
      <div className="stat-readout text-3xl md:text-4xl font-bold text-cream mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 font-mono ${subColor}`}>{sub}</div>}
    </div>
  );
}

function trend(curr: number, prev: number): { sub: string; tone?: "signal" | "clip" } {
  const d = delta(curr, prev);
  if (d.pct === null) return { sub: `${prev} previous 24h` };
  const sign = d.abs >= 0 ? "+" : "";
  return { sub: `${sign}${d.abs} (${sign}${d.pct}%) vs prev 24h`, tone: d.abs >= 0 ? "signal" : "clip" };
}

export function KpiGrid({ overview }: { overview: AdminOverview }) {
  const t = overview.totals;
  const a = overview.activity;
  const m = overview.membership30d;
  const cmd = trend(a.commands24h, a.commandsPrev24h);
  const trk = trend(a.tracks24h, a.tracksPrev24h);
  const linkedOnline = t.linkedBots.online;
  const linkedTotal = Object.values(t.linkedBots).reduce((s, n) => s + n, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <Kpi label="Servers" value={t.guilds.toLocaleString()} sub={`+${m.joins} / −${m.leaves} last 30d`} tone={m.joins >= m.leaves ? "signal" : "clip"} />
      <Kpi label="Member reach" value={compact(t.members)} sub={`${t.guildsWithSettings} configured servers`} />
      <Kpi label="Playing now" value={String(t.playing)} sub={`${t.paused} paused`} />
      <Kpi label="Commands 24h" value={a.commands24h.toLocaleString()} sub={cmd.sub} tone={cmd.tone} />
      <Kpi label="Tracks 24h" value={a.tracks24h.toLocaleString()} sub={trk.sub} tone={trk.tone} />
      <Kpi label="Error rate 24h" value={pct(a.errorRate24h)} sub={`${a.errors24h} errors`} tone={a.errorRate24h > 5 ? "clip" : "signal"} />
      <Kpi label="Active 7d" value={a.uniqueUsers7d.toLocaleString()} sub={`users · ${a.uniqueGuilds7d} servers`} />
      <Kpi label="Premium" value={t.premiumUsers.toLocaleString()} sub={`${t.premiumGuilds} servers · ${linkedOnline}/${linkedTotal} linked bots online`} />
    </div>
  );
}
```

- [ ] **Step 8: Create `components/admin/AdminConsole.tsx` (shell; sections filled by Tasks 14–16)**

```tsx
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
        <SectionHead kicker="Inventory" title="Servers" note={guilds.data ? `${guilds.data.guilds.length} servers` : undefined} />
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
        <SectionHead kicker="Trail" title="Audit log" note={audit.data ? `${audit.data.entries.length} entries` : undefined} />
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
```

- [ ] **Step 9: Temporary stubs so the shell compiles (replaced in Tasks 14–16)**

Create each of `ActivityCharts.tsx`, `ErrorsList.tsx`, `ServersTable.tsx`, `GuildDrawer.tsx`, `PremiumPanel.tsx`, `LogsPanel.tsx`, `AuditPanel.tsx` with a minimal export matching the props used above, for example:
```tsx
"use client";
import type { AdminOverview } from "@/types/admin";
export function ActivityCharts(_: { overview: AdminOverview }) {
  return null;
}
```
(`ErrorsList({ errors })`, `ServersTable({ guilds, membership, onSelect })`, `GuildDrawer({ guild, onClose, onAction })`, `PremiumPanel()`, `LogsPanel()`, `AuditPanel({ entries, error })`.)

- [ ] **Step 10: Type-check, lint, view**

Run: `cd dashboard && npx tsc --noEmit -p tsconfig.json && npm run lint`
Run dev server and open `http://localhost:4123/admin` logged in as a non-owner → redirected to `/dashboard`. (Owner rendering is verified after deploy in Task 19, or locally by setting `OWNER_ID` to your own id in `dashboard/.env`.)

- [ ] **Step 11: Commit**

```bash
git add "dashboard/src/app/(dashboard)/admin/page.tsx" dashboard/src/components/admin
git commit -m "feat(admin): owner console shell with status strip and KPIs"
```

---

### Task 14: Activity charts and recent errors

**Files:**
- Replace stubs: `dashboard/src/components/admin/ActivityCharts.tsx`, `ErrorsList.tsx`

**Interfaces:**
- Consumes: `AreaChart`/`AreaPoint` and `BarRow` from `@/components/insights`, `AdminOverview`, `relTime`.

- [ ] **Step 1: `ActivityCharts.tsx`**

```tsx
"use client";

import { AreaChart, AreaPoint } from "@/components/insights/AreaChart";
import { BarRow } from "@/components/insights/BarRow";
import type { AdminOverview } from "@/types/admin";
import { useMemo, useState } from "react";
import { Label, Panel } from "./ui";

type Metric = "commands" | "tracks" | "errors";
const ACCENT: Record<Metric, string> = { commands: "#f8aa2a", tracks: "#5be49b", errors: "#ff5a48" };

export function ActivityCharts({ overview }: { overview: AdminOverview }) {
  const [metric, setMetric] = useState<Metric>("commands");
  const series: AreaPoint[] = useMemo(
    () => overview.series14d.map((p) => ({ label: p.date.slice(5), value: p[metric] })),
    [overview.series14d, metric]
  );
  const topMax = overview.topCommands7d[0]?.count || 1;
  const srcMax = overview.sources7d[0]?.starts || 1;
  const noEvents = overview.series14d.every((p) => p.commands === 0 && p.tracks === 0 && p.errors === 0);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <Label>Daily {metric}</Label>
          <div className="flex gap-1">
            {(["commands", "tracks", "errors"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider border ${
                  metric === m ? "border-amber/60 text-amber bg-amber/10" : "border-line text-dust hover:text-cream"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {noEvents ? (
          <p className="text-sm text-dune font-mono py-10 text-center">
            No events yet — the bot starts recording commands, tracks and errors after this deploy.
          </p>
        ) : (
          <AreaChart data={series} height={240} accent={ACCENT[metric]} />
        )}
      </Panel>

      <div className="space-y-4">
        <Panel>
          <Label className="mb-3">Top commands · 7d</Label>
          {overview.topCommands7d.length === 0 && <p className="text-xs text-dust font-mono">No data</p>}
          <ul className="space-y-2.5">
            {overview.topCommands7d.map((c) => (
              <li key={c.command}>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-cream">/{c.command}</span>
                  <span className="text-dust">
                    {c.count}
                    {c.failed > 0 && <span className="text-clip"> · {c.failed} failed</span>}
                  </span>
                </div>
                <BarRow value={c.count} max={topMax} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <Label className="mb-3">Sources · 7d</Label>
          {overview.sources7d.length === 0 && <p className="text-xs text-dust font-mono">No data</p>}
          <ul className="space-y-2.5">
            {overview.sources7d.map((s) => (
              <li key={s.source}>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-cream">{s.source}</span>
                  <span className="text-dust">
                    {s.starts}
                    {s.errors > 0 && <span className="text-clip"> · {s.errors} errors</span>}
                  </span>
                </div>
                <BarRow value={s.starts} max={srcMax} accent={s.errors > s.starts / 4 ? "#ff5a48" : "#5be49b"} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ErrorsList.tsx`**

```tsx
"use client";

import { relTime } from "@/lib/admin/format";
import type { RecentError } from "@/types/admin";
import { Chip, Label, Panel } from "./ui";

export function ErrorsList({ errors }: { errors: RecentError[] }) {
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <Label>Recent errors</Label>
        <Label>{errors.length === 0 ? "clean" : `last ${errors.length}`}</Label>
      </div>
      {errors.length === 0 ? (
        <p className="text-sm text-dune font-mono">No errors recorded.</p>
      ) : (
        <ul className="divide-y divide-line">
          {errors.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="py-2 flex flex-wrap gap-x-3 gap-y-1 items-baseline text-sm">
              <span className="font-mono text-[11px] text-dust w-16 shrink-0" title={e.ts}>
                {relTime(e.ts)}
              </span>
              <Chip tone="clip">{e.kind === "error" ? e.scope ?? "error" : e.kind}</Chip>
              {e.guildName && <span className="text-dune text-xs">{e.guildName}</span>}
              {e.command && <span className="kbd">/{e.command}</span>}
              {e.track && <span className="text-dune text-xs truncate max-w-[240px]">{e.track}</span>}
              <span className="text-cream break-all">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 3: Type-check, lint, commit**

```bash
cd dashboard && npx tsc --noEmit -p tsconfig.json && npm run lint && cd ..
git add dashboard/src/components/admin/ActivityCharts.tsx dashboard/src/components/admin/ErrorsList.tsx
git commit -m "feat(admin): activity charts and recent errors"
```

---

### Task 15: Servers table, guild drawer and confirm dialog

**Files:**
- Replace stubs: `dashboard/src/components/admin/ServersTable.tsx`, `GuildDrawer.tsx`
- Create: `dashboard/src/components/admin/ConfirmDialog.tsx`

**Interfaces:**
- `ServersTable({ guilds: AdminGuild[]; membership?: AdminOverview["membership30d"]; onSelect(g: AdminGuild): void })`
- `GuildDrawer({ guild: AdminGuild; onClose(): void; onAction(message: string, ok: boolean): void })` — fetches `/api/admin/guilds/:id`, posts `/leave` and `/stop`.
- `ConfirmDialog({ title, description, confirmText, requireText?, onConfirm(): Promise<void> | void, onCancel(): void, busy?: boolean })`

- [ ] **Step 1: `ConfirmDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

export function ConfirmDialog({
  title,
  description,
  confirmText,
  requireText,
  busy,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  confirmText: string;
  requireText?: string;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const armed = !requireText || typed.trim() === requireText;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal/80 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="console-panel rounded-xl p-6 w-full max-w-md border-clip/40">
        <div className="console-label text-clip!">Destructive action</div>
        <h3 id="confirm-title" className="font-display text-xl font-semibold text-cream mt-2">
          {title}
        </h3>
        <p className="text-sm text-dune mt-2 leading-relaxed">{description}</p>
        {requireText && (
          <label className="block mt-4">
            <span className="console-label">
              Type <span className="text-cream">{requireText}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-md bg-panel-raised border border-line-bright px-3 py-2 font-mono text-sm text-cream focus-amber"
            />
          </label>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button tone="clip" onClick={() => void onConfirm()} disabled={!armed || busy}>
            {busy ? "Working…" : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ServersTable.tsx`**

```tsx
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
                      {g.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconUrl(g.id, g.icon)} alt="" className="w-8 h-8 rounded-md bg-panel-raised" />
                      ) : (
                        <span className="w-8 h-8 rounded-md bg-panel-raised grid place-items-center font-display text-dune">{g.name.charAt(0)}</span>
                      )}
                      <div className="min-w-0">
                        <div className="text-cream font-medium truncate max-w-[260px]">{g.name}</div>
                        <div className="font-mono text-[11px] text-dust">{g.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 stat-readout text-cream">{g.memberCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {g.playback?.isPlaying ? <Chip tone="signal">playing</Chip> : g.playback?.isPaused ? <Chip tone="amber">paused</Chip> : <Chip>idle</Chip>}
                      {g.premium?.active && <Chip tone="amber">premium {g.premium.bitrate}k</Chip>}
                      {g.hasSettings && <Chip>configured</Chip>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-dune whitespace-nowrap">
                    {g.activity7d.tracks} tracks · {g.activity7d.commands} cmds
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-dune whitespace-nowrap">{relTime(g.lastActive ?? null)}</td>
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
                <span className={`font-mono text-[11px] ${e.event === "join" ? "text-signal" : "text-clip"}`}>{e.event === "join" ? "+" : "−"}</span>
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
```

- [ ] **Step 3: `GuildDrawer.tsx`**

```tsx
"use client";

import { relTime, uptime } from "@/lib/admin/format";
import type { AdminGuild, AdminGuildDetail } from "@/types/admin";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, Chip, Label, iconUrl } from "./ui";
import { postAction, usePolling } from "./usePolling";

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-line/60 text-sm">
      <span className="text-dust font-mono text-xs">{k}</span>
      <span className="text-cream text-right break-all">{v === null || v === undefined || v === "" ? "—" : String(v)}</span>
    </div>
  );
}

export function GuildDrawer({
  guild,
  onClose,
  onAction
}: {
  guild: AdminGuild;
  onClose: () => void;
  onAction: (message: string, ok: boolean) => void;
}) {
  const detail = usePolling<AdminGuildDetail>(`/api/admin/guilds/${guild.id}`, 0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !confirmLeave && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmLeave]);

  const stop = async () => {
    setBusy(true);
    const r = await postAction(`/api/admin/guilds/${guild.id}/stop`);
    setBusy(false);
    onAction(r.ok ? r.result || "Playback stopped" : r.error || "Stop failed", r.ok);
    if (r.ok) detail.refresh();
  };

  const leave = async () => {
    setBusy(true);
    const r = await postAction(`/api/admin/guilds/${guild.id}/leave`);
    setBusy(false);
    setConfirmLeave(false);
    onAction(r.ok ? r.result || "Left server" : r.error || "Leave failed", r.ok);
  };

  const d = detail.data;
  const s = d?.settings;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-coal/70" onClick={onClose}>
      <aside
        className="h-full w-full sm:w-[520px] overflow-y-auto bg-panel border-l border-line p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Server ${guild.name}`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {guild.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl(guild.id, guild.icon, 128)} alt="" className="w-12 h-12 rounded-lg bg-panel-raised" />
            ) : (
              <span className="w-12 h-12 rounded-lg bg-panel-raised grid place-items-center font-display text-xl text-dune">{guild.name.charAt(0)}</span>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold text-cream truncate">{guild.name}</h3>
              <div className="font-mono text-[11px] text-dust">
                {guild.id} · owner {guild.ownerId}
              </div>
            </div>
          </div>
          <Button onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <Chip>{guild.memberCount.toLocaleString()} members</Chip>
          <Chip>joined {relTime(guild.joinedAt)}</Chip>
          {guild.premium?.active && <Chip tone="amber">premium {guild.premium.bitrate}kbps</Chip>}
          {d?.playback?.isPlaying && <Chip tone="signal">playing</Chip>}
        </div>

        <div className="flex gap-2 mb-6">
          <Button tone="amber" onClick={stop} disabled={busy || !d?.playback?.isPlaying}>
            Stop playback
          </Button>
          <Button tone="clip" onClick={() => setConfirmLeave(true)} disabled={busy}>
            Leave server
          </Button>
          <a href={`/servers/${guild.id}/settings`} target="_blank" rel="noreferrer" className="ml-auto self-center font-mono text-[11px] uppercase tracking-wider text-dune hover:text-amber">
            open settings ↗
          </a>
        </div>

        {detail.error && <p className="text-clip font-mono text-sm">{detail.error}</p>}

        {d && (
          <div className="space-y-6">
            <div>
              <Label className="mb-2">Now</Label>
              <Row k="track" v={d.playback?.currentTrack?.title ?? "nothing playing"} />
              <Row k="voice channel" v={d.playback?.voiceChannelName} />
              <Row k="queue" v={d.playback?.queueSize ?? 0} />
              <Row k="volume" v={d.playback ? `${d.playback.volume}% · ${d.playback.audioBitrate}kbps · loop ${d.playback.loopMode}` : null} />
              <Row k="last update" v={d.playback ? relTime(d.playback.lastUpdated) : null} />
            </div>

            <div>
              <Label className="mb-2">Activity · 7d</Label>
              <Row k="commands" v={d.activity.commands7d} />
              <Row k="tracks" v={d.activity.tracks7d} />
              <Row k="top commands" v={d.activity.topCommands.map((c) => `/${c.command} ${c.count}`).join(" · ") || null} />
              <Row k="top requesters" v={d.activity.topRequesters.map((r) => `${r.userId} (${r.count})`).join(" · ") || null} />
              <Row k="lifetime plays" v={s ? `${s.totalSongsPlayed ?? 0} songs · ${uptime(s.totalPlaytime ?? 0)}` : null} />
            </div>

            <div>
              <Label className="mb-2">Settings</Label>
              {!s ? (
                <p className="text-xs text-dust font-mono">Defaults (never configured)</p>
              ) : (
                <>
                  <Row k="language" v={s.language} />
                  <Row k="dj role" v={s.djRoleId} />
                  <Row k="admin role" v={s.adminRoleId} />
                  <Row k="volume" v={`${s.defaultVolume} default · ${s.maxVolume} max`} />
                  <Row k="queue" v={`${s.maxQueueSize} max · ${s.maxSongDuration || "∞"} s max duration`} />
                  <Row k="auto-leave" v={s.autoLeaveEmpty ? "on" : "off"} />
                  <Row k="announce" v={s.announceNowPlaying ? "on" : "off"} />
                  <Row k="log channel" v={s.logChannelId} />
                  <Row k="allowed text ch." v={s.allowedTextChannels?.length || "all"} />
                  <Row k="allowed voice ch." v={s.allowedVoiceChannels?.length || "all"} />
                  <Row k="blacklisted users" v={s.blacklistedUsers?.length || 0} />
                  <Row k="disabled commands" v={s.disabledCommands?.join(", ") || "none"} />
                  <Row k="updated" v={s.updatedAt ? relTime(String(s.updatedAt)) : null} />
                </>
              )}
            </div>

            <div>
              <Label className="mb-2">Recent events</Label>
              {d.events.length === 0 ? (
                <p className="text-xs text-dust font-mono">No events recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.events.map((e, i) => (
                    <li key={`${e.ts}-${i}`} className="flex gap-2 text-xs">
                      <span className="font-mono text-dust w-14 shrink-0" title={e.ts}>
                        {relTime(e.ts)}
                      </span>
                      <span className={`font-mono shrink-0 ${e.ok === false ? "text-clip" : "text-amber"}`}>{e.kind}</span>
                      <span className="text-cream break-all">{e.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {confirmLeave && (
          <ConfirmDialog
            title={`Leave ${guild.name}?`}
            description="The bot will leave this server immediately and stop any playback there. Server settings stay in the database; the bot can be re-invited later."
            confirmText="Leave server"
            requireText={guild.name}
            busy={busy}
            onConfirm={leave}
            onCancel={() => setConfirmLeave(false)}
          />
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Type-check, lint, commit**

```bash
cd dashboard && npx tsc --noEmit -p tsconfig.json && npm run lint && cd ..
git add dashboard/src/components/admin/ServersTable.tsx dashboard/src/components/admin/GuildDrawer.tsx dashboard/src/components/admin/ConfirmDialog.tsx
git commit -m "feat(admin): servers table, guild drawer and audited actions UI"
```

---

### Task 16: Premium, logs and audit panels

**Files:**
- Replace stubs: `dashboard/src/components/admin/PremiumPanel.tsx`, `LogsPanel.tsx`, `AuditPanel.tsx`
- Create: `dashboard/src/app/api/admin/premium/route.ts`

**Interfaces:**
- `GET /api/admin/premium` → `{ patrons: PatronRow[]; premiumGuilds: PremiumGuildRow[]; linkedBots: LinkedBotRow[] }` (types defined inline in the route and mirrored in `types/admin.ts` below).

- [ ] **Step 1: Add types to `types/admin.ts`**

```ts
export interface PatronRow {
  discordId: string;
  fullName?: string;
  tierTitle?: string;
  patronStatus: string;
  pledgeUsd: number;
  lifetimeUsd: number;
  isPremium: boolean;
  isFounder: boolean;
  lastChargeDate?: string;
  lastChargeStatus?: string;
}
export interface PremiumGuildRow {
  guildId: string;
  guildName?: string;
  discordId: string;
  audioBitrate: number;
  isActive: boolean;
  linkedAt: string;
  lastUsed?: string;
}
export interface LinkedBotRow {
  botId: string;
  botUsername: string;
  ownerId: string;
  ownerUsername: string;
  status: string;
  totalGuilds: number;
  totalSongsPlayed: number;
  lastError: string | null;
  lastStatusChange: string;
}
export interface AdminPremium {
  patrons: PatronRow[];
  premiumGuilds: PremiumGuildRow[];
  linkedBots: LinkedBotRow[];
}
```

- [ ] **Step 2: Create `app/api/admin/premium/route.ts`**

```ts
import { adminJson, requireOwner } from "@/lib/admin-auth";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { PatreonUserModel } from "@/lib/models/PatreonUser";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import type { AdminPremium } from "@/types/admin";
import type { ILinkedBot, IPatreonUser } from "../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface PremiumGuildDoc {
  guildId: string;
  guildName?: string;
  discordId: string;
  audioBitrate: number;
  isActive: boolean;
  linkedAt: Date;
  lastUsed?: Date;
}

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  try {
    await connectToDatabase();
    const [patrons, premiumGuilds, linkedBots] = await Promise.all([
      PatreonUserModel.find({}).sort({ isPremium: -1, lifetimeSupportCents: -1 }).limit(200).lean<IPatreonUser[]>(),
      PremiumGuild.find({}).sort({ isActive: -1, linkedAt: -1 }).limit(200).lean<PremiumGuildDoc[]>(),
      LinkedBotModel.find({}).sort({ status: 1 }).limit(200).lean<ILinkedBot[]>()
    ]);
    const body: AdminPremium = {
      patrons: patrons.map((p) => ({
        discordId: p.discordId,
        fullName: p.fullName,
        tierTitle: p.tierTitle,
        patronStatus: p.patronStatus,
        pledgeUsd: (p.pledgeAmountCents || 0) / 100,
        lifetimeUsd: (p.lifetimeSupportCents || 0) / 100,
        isPremium: p.isPremium,
        isFounder: p.isFounder,
        lastChargeDate: p.lastChargeDate ? new Date(p.lastChargeDate).toISOString() : undefined,
        lastChargeStatus: p.lastChargeStatus
      })),
      premiumGuilds: premiumGuilds.map((g) => ({
        guildId: g.guildId,
        guildName: g.guildName,
        discordId: g.discordId,
        audioBitrate: g.audioBitrate,
        isActive: g.isActive,
        linkedAt: new Date(g.linkedAt).toISOString(),
        lastUsed: g.lastUsed ? new Date(g.lastUsed).toISOString() : undefined
      })),
      linkedBots: linkedBots.map((b) => ({
        botId: b.botId,
        botUsername: b.botUsername,
        ownerId: b.ownerId,
        ownerUsername: b.ownerUsername,
        status: b.status,
        totalGuilds: b.totalGuilds || 0,
        totalSongsPlayed: b.totalSongsPlayed || 0,
        lastError: b.lastError ?? null,
        lastStatusChange: new Date(b.lastStatusChange).toISOString()
      }))
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/premium] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
```

- [ ] **Step 3: `PremiumPanel.tsx`**

```tsx
"use client";

import { relTime } from "@/lib/admin/format";
import type { AdminPremium } from "@/types/admin";
import { Chip, Label, Loader, Panel, Unavailable } from "./ui";
import { usePolling } from "./usePolling";

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
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
```

- [ ] **Step 4: `LogsPanel.tsx`**

```tsx
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
  const { data, error, loading, refresh } = usePolling<{ entries: LogEntry[] }>(`/api/admin/logs?${qs}`, live ? 5000 : 0);

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
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-md bg-panel-raised border border-line-bright px-2 py-1.5 font-mono text-xs text-cream focus-amber">
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
          Log streaming is not configured. Set <span className="kbd">DEBUG_PANEL_URL</span> and <span className="kbd">DEBUG_TOKEN</span> in the dashboard environment.
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-clip font-mono">{error}</div>
      ) : (
        <div className="h-[420px] overflow-y-auto p-3 font-mono text-[12px] leading-relaxed bg-coal/60">
          {loading && !data && <div className="text-dust">Loading…</div>}
          {data?.entries.length === 0 && <div className="text-dust">No log entries match.</div>}
          {data?.entries.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="whitespace-pre-wrap break-all hover:bg-panel-raised/50 px-1 rounded">
              <span className="text-dust">{e.ts.slice(11, 19)}</span> <span className={`${LEVEL_COLOR[e.level] ?? "text-cream"} font-bold`}>{e.level.padEnd(5)}</span> {e.message}
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
```

- [ ] **Step 5: `AuditPanel.tsx`**

```tsx
"use client";

import { relTime } from "@/lib/admin/format";
import type { AuditEntry } from "@/types/admin";
import { Chip, Panel, Unavailable } from "./ui";

export function AuditPanel({ entries, error }: { entries: AuditEntry[]; error: string | null }) {
  if (error) return <Unavailable what={`Audit log (${error})`} />;
  return (
    <Panel className="p-0 overflow-hidden">
      {entries.length === 0 ? (
        <p className="p-4 text-xs text-dust font-mono">No owner actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left">
                {["When", "Actor", "Action", "Target", "Outcome"].map((h) => (
                  <th key={h} className="console-label font-normal px-3 py-2 border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.ts}-${i}`}>
                  <td className="px-3 py-2 border-b border-line/60 font-mono text-xs text-dune whitespace-nowrap" title={e.ts}>
                    {relTime(e.ts)}
                  </td>
                  <td className="px-3 py-2 border-b border-line/60 text-cream">{e.actorName}</td>
                  <td className="px-3 py-2 border-b border-line/60">
                    <span className="kbd">{e.action}</span>
                  </td>
                  <td className="px-3 py-2 border-b border-line/60 text-dune">
                    {e.targetName || e.targetGuildId || "—"}
                    {e.targetName && e.targetGuildId && <span className="font-mono text-[11px] text-dust"> · {e.targetGuildId}</span>}
                  </td>
                  <td className="px-3 py-2 border-b border-line/60">
                    <Chip tone={e.ok ? "signal" : "clip"}>{e.ok ? "ok" : "failed"}</Chip>
                    <span className="ml-2 text-xs text-dune">{e.ok ? e.result : e.error}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 6: Type-check, lint, commit**

```bash
cd dashboard && npx tsc --noEmit -p tsconfig.json && npm run lint && cd ..
git add dashboard/src/components/admin dashboard/src/app/api/admin/premium dashboard/src/types/admin.ts
git commit -m "feat(admin): premium, live logs and audit panels"
```

---

### Task 17: Mobile admin link, env example and docs

**Files:**
- Modify: `dashboard/src/app/(dashboard)/layout.tsx`, `dashboard/src/components/dashboard/Header.tsx`, `dashboard/src/components/dashboard/MobileDrawer.tsx`, `dashboard/.env.example`, `ARCHITECTURE.md`

- [ ] **Step 1: Pass `isOwner` down**

`layout.tsx`: change `<DashboardHeader />` to `<DashboardHeader isOwner={isOwner} />`.

`Header.tsx`: change the signature to `export function DashboardHeader({ isOwner = false }: { isOwner?: boolean })` and render `<MobileDrawer isOwner={isOwner} />`.

`MobileDrawer.tsx`: add `import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";`, change the signature to `export function MobileDrawer({ isOwner = false }: { isOwner?: boolean })`, and after the `menuItems.map(...)` block inside the `<List>` add:
```tsx
              {isOwner && (
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href="/admin"
                    selected={pathname === "/admin"}
                    onClick={handleNavigation}
                    sx={{ borderRadius: 2 }}
                  >
                    <ListItemIcon sx={{ color: pathname === "/admin" ? "#ff5a48" : "text.secondary", minWidth: 40 }}>
                      <AdminPanelSettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Admin" primaryTypographyProps={{ fontWeight: pathname === "/admin" ? 600 : 400 }} />
                  </ListItemButton>
                </ListItem>
              )}
```

- [ ] **Step 2: Document env vars**

Append to `dashboard/.env.example` after `ADMIN_PASSWORD=`:
```
# Owner console log streaming: the bot's DebugPanel (services/debugPanel.ts).
# In docker compose the bot is reachable by service name; DEBUG_TOKEN must equal the bot's.
DEBUG_PANEL_URL=http://music-bot:9090
DEBUG_TOKEN=
```
Append to root `.env.example` (if present; otherwise skip):
```
# Telemetry event retention in days (botevents collection TTL)
BOT_EVENTS_TTL_DAYS=90
```

- [ ] **Step 3: Update `ARCHITECTURE.md`**

Add to the Bot Services table: `| telemetry.ts | Heartbeat to Redis every 20 s; command/track/guild/error events to Mongo botevents (TTL 90 d) |`.
Add to the MongoDB Collections table: `| botevents | Telemetry events | Bot | Dashboard |` and `| adminauditlogs | Owner action audit trail | Dashboard | Dashboard |`.
Add to the Dashboard API Routes table: `| /api/admin/* | Owner-only console: overview, guilds, guild detail, premium, logs (DebugPanel proxy), audit, actions leave/stop/resync |`.

- [ ] **Step 4: Type-check, lint, commit**

```bash
cd dashboard && npx tsc --noEmit -p tsconfig.json && npm run lint && cd ..
git add dashboard/src/app/\(dashboard\)/layout.tsx dashboard/src/components/dashboard/Header.tsx dashboard/src/components/dashboard/MobileDrawer.tsx dashboard/.env.example ARCHITECTURE.md
git commit -m "feat(dashboard): admin link on mobile, env docs, architecture notes"
```

---

### Task 18: Full build verification

**Files:** none new.

- [ ] **Step 1: Bot**

Run: `npm run build && npm test`
Expected: tsc clean; telemetry tests pass; `dist/services/telemetry.js` exists; `dist/tests` absent.

- [ ] **Step 2: Dashboard**

Run: `cd dashboard && npm test && npm run lint && npm run build`
Expected: tests pass; lint clean; `next build` succeeds and lists `/admin` and every `/api/admin/*` route as dynamic (ƒ).

- [ ] **Step 3: Docker images build (optional locally, mandatory on the server in Task 19)**

Run: `docker build -f Dockerfile.dashboard -t bypass-dashboard-test . && docker build -t bypass-bot-test .`

- [ ] **Step 4: Fix anything that failed, then commit**

```bash
git status
git commit -am "chore: build fixes for admin console" # only if there were fixes
```

---

### Task 19: Deploy to box83 and verify

**Files:** remote only (`/root/music-bot/dashboard/.env` on box83).

- [ ] **Step 1: Push**

```bash
git push origin music
```

- [ ] **Step 2: Add the dashboard env vars on the server (never echo secrets)**

```bash
ssh root@83.147.54.179 'cd /root/music-bot && git pull --ff-only && \
  TOKEN=$(grep -E "^DEBUG_TOKEN=" .env | cut -d= -f2-) && \
  grep -q "^OWNER_ID=" dashboard/.env || echo "OWNER_ID=1066182746399055993" >> dashboard/.env; \
  grep -q "^DEBUG_PANEL_URL=" dashboard/.env || echo "DEBUG_PANEL_URL=http://music-bot:9090" >> dashboard/.env; \
  grep -q "^DEBUG_TOKEN=" dashboard/.env || echo "DEBUG_TOKEN=$TOKEN" >> dashboard/.env; \
  grep -E "^(OWNER_ID|DEBUG_PANEL_URL|DEBUG_TOKEN)=" dashboard/.env | sed -E "s/=(.{0,6}).*/=\1…/"'
```
Expected: three lines printed with masked values.

- [ ] **Step 3: Rebuild and restart both containers**

```bash
ssh root@83.147.54.179 'cd /root/music-bot && COMPOSE_BAKE=false docker compose up -d --build bot dashboard 2>&1 | tail -5 && docker ps --format "{{.Names}} {{.Status}}" | grep music'
```
Expected: both containers `Up`.

- [ ] **Step 4: Verify heartbeat and telemetry on the server**

```bash
ssh root@83.147.54.179 'docker logs --since 2m music-bot 2>&1 | grep -E "Telemetry|Heartbeat|ready" | tail -5; \
  docker exec music-bot node -e "const R=require(\"ioredis\");const r=new R(process.env.REDIS_URL);r.get(\"bot:status\").then(v=>{const j=JSON.parse(v);console.log(\"heartbeat ts\",j.ts,\"uptime\",j.uptimeSec,\"ytdlp\",j.versions.ytDlp);r.quit()})"'
```
Expected: `[Telemetry] ✅ Heartbeat started` and a heartbeat `ts` within the last minute. Run the Redis check twice 30 s apart and confirm `ts` advances.

- [ ] **Step 5: Verify the dashboard gates**

```bash
ssh root@83.147.54.179 'curl -s -o /dev/null -w "%{http_code} %{header_json}\n" http://127.0.0.1:4123/api/admin/overview | head -c 300; echo; \
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:4123/api/admin/resync; \
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4123/admin'
```
Expected: `401` for both API calls; `307` (redirect to `/login`) for the page.
Public check: `curl -s -o /dev/null -w "%{http_code}\n" https://music-bot.checkleaked.com/api/admin/overview` → `401`.

- [ ] **Step 6: Owner login in the browser**

Open `https://music-bot.checkleaked.com/admin` logged in as the owner: status strip green, KPIs populated (event counters start at 0 and grow as commands run), servers table lists the current guilds, Logs panel streams. Take a screenshot for the summary.

- [ ] **Step 7: Save deployment notes to memory**

Update the `admin-insights-and-real-scale` memory file: `/admin` is now the owner console (Discord login, OWNER_ID), telemetry collections `botevents` / `adminauditlogs`, dashboard env now has `OWNER_ID`, `DEBUG_PANEL_URL`, `DEBUG_TOKEN`.
