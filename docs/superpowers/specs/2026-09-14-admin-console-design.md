# Owner Admin Console — Design

**Date:** 2026-09-14
**Status:** design approved in chat; spec written for implementation planning
**Owner gate:** Discord user `1066182746399055993` (`OWNER_ID` env on both bot and dashboard)

## 1. Goal

A single owner-only page at `/admin` (inside the authenticated dashboard shell, Discord OAuth login) that shows everything needed to operate the bot: live health, server inventory, usage and error analytics, premium/linked-bot state, live logs, and a small set of audited admin actions.

## 2. Current state and defects this design fixes

| Area | Today | Problem |
|---|---|---|
| `/admin` | MUI page, servers table only, inline owner check | Thin, old visual style, no health/activity data |
| `/insights` | Password or owner, growth charts | Kept as-is; shares APIs and chart components |
| `bot:status` (Redis) | Written once at startup, TTL 60 s | Dashboard shows bot offline after 1 minute |
| `totalSongsPlayed` / `totalPlaytime` | Defined, never incremented for the main bot | Per-server counters stay at 0 |
| Command usage / errors / track history | Not recorded anywhere | No activity analytics possible |
| Prod `dashboard/.env` on box83 | No `OWNER_ID` | Owner gate can never pass in production |
| Mobile drawer | No Admin link | Owner cannot reach `/admin` on phone |

## 3. Architecture (approach A)

```
Discord ──► Bot (structs/Bot.ts, services/discordPlayer.ts)
               │  services/telemetry.ts
               ├── heartbeat every 20 s ──► Redis  bot:status  (TTL 60 s)
               ├── events (fire-and-forget) ──► Mongo  botevents  (TTL 90 d)
               └── guild sync (existing) ──► Redis  bot:guilds / bot:guild:<id>
                                                  ▲
Dashboard (Next.js) ── /api/admin/* (owner-only) ─┤ reads Redis + Mongo
               ├── /api/admin/logs ──► proxy ──► bot DebugPanel :9090 (DEBUG_TOKEN server-side)
               ├── actions ──► Discord REST (leave) / Mongo botcommands (stop, admin_resync)
               └── adminauditlogs (Mongo, no TTL)
```

Rejected: B) fold everything into `/insights` (password gate, outside shell, contradicts owner-login request); C) Prometheus + Grafana (new infra for ~23 servers).

## 4. Bot changes

### 4.1 `services/telemetry.ts` (new, singleton `TelemetryService`)

- `start(client)`: first heartbeat immediately, then `setInterval` 20 s. Replaces the one-shot `setBotStatus` in `Bot.ts`.
- `stop()`: clears interval (called from graceful shutdown in `index.ts`).
- `resyncNow()`: runs the existing guild sync + one heartbeat. Used by the `admin_resync` command.
- `record(event)`: validates shape, `BotEvent.create()` without awaiting the caller; errors are swallowed and logged at most once per minute (no log spam if Mongo is down). Skips silently when `DatabaseService.isReady()` is false.
- Pure helpers live in `services/telemetry/heartbeat.ts` and `services/telemetry/events.ts` so they can be unit-tested without Discord: `buildHeartbeat(input)`, `cpuPercent(prev, curr, elapsedMs)`, `commandEvent(...)`, `trackEvent(...)`, `guildEvent(...)`, `errorEvent(...)`, `truncate(stack, 2000)`.
- yt-dlp version: resolved once at startup via `execFile(<same binary the player spawns>, ["--version"])`, cached, `null` on failure.

### 4.2 Heartbeat payload (`shared/types/index.ts` → `IBotHeartbeat`)

Superset of today's `bot:status` object so existing readers keep working.

```ts
interface IBotHeartbeat {
  online: true;
  id: string; username: string; avatar: string | null;
  startedAt: string;        // ISO, process start
  ts: string;               // ISO, this tick
  uptimeSec: number;
  guildCount: number; memberCount: number;
  ws: { ping: number; status: number };
  queues: { total: number; playing: number; paused: number; voiceConnections: number };
  process: { rss: number; heapUsed: number; heapTotal: number; cpuPercent: number; node: string; platform: string; pid: number };
  versions: { bot: string; discordJs: string; discordPlayer: string; ytDlp: string | null };
  services: { mongo: boolean; patreon: boolean; debugPanel: boolean };
  lastError?: { ts: string; scope: string; message: string };
}
```

### 4.3 Events collection `botevents` (`models/BotEvent.ts`, mirrored in `dashboard/src/lib/models/BotEvent.ts`)

Flat schema, one document per event, `kind` discriminator. Types in `shared/types/index.ts` as a discriminated union `BotEvent`.

| kind | fields |
|---|---|
| `command` | `guildId, userId, command, subcommand?, ok, durationMs, error?` |
| `track` | `guildId, event: start/finish/skip/error, title, author, url, source, trackDurationMs, requestedById?, reason?, error?` |
| `guild` | `guildId, event: join/leave, name, memberCount` |
| `error` | `guildId?, scope: command/player/process, message, stack? (≤2000 chars), command?, track?` |

Common: `ts: Date` (indexed). Indexes: `{kind:1, ts:-1}`, `{guildId:1, ts:-1}`, TTL on `ts` with `expireAfterSeconds = BOT_EVENTS_TTL_DAYS (default 90) * 86400`. Changing the TTL later requires dropping the index (documented in the model file).

Privacy: only Discord IDs, command names and track metadata are stored. Never message content, never tokens.

### 4.4 Hook points

| Where | Event |
|---|---|
| `structs/Bot.ts` interaction handler | `command` (ok/failed + duration) around `command.execute`; `error` scope `command` on throw |
| `services/discordPlayer.ts` | `track` on `playerStart` / `playerFinish` / `playerSkip` / `playerError`; `error` scope `player` on `error` and `playerError` |
| `services/discordPlayer.ts` `playerStart` / `playerFinish` | call `GuildSettingsService.incrementSongPlayed` / `addPlaytime(track.durationMS/1000)` (fixes dead counters) |
| `structs/Bot.ts` `guildCreate` / `guildDelete` | `guild` join / leave |
| `index.ts` `unhandledRejection` / `uncaughtException` | `error` scope `process`; also stored as `lastError` for the next heartbeat |

### 4.5 `admin_resync` command

Guild-less `BotCommand` with `type: "admin_resync"` (same shape as linked-bot commands). `dashboardSync.processCommands` adds it to the `type: $in` list and dispatches to `TelemetryService.resyncNow()`, marking the command `completed` / `failed`. Shared type `AdminCommandType = "admin_resync"` added to `BotCommandType`.

## 5. Dashboard changes

### 5.1 Auth helpers (`lib/admin-auth.ts`)

- `requireOwner()` → `{ session } | NextResponse` (401 no session, 403 not owner). Every `/api/admin/*` route uses it. `/api/admin/analytics` keeps `hasAdminAccess()` because `/insights` also consumes it.
- `requireOwnerAction(request)` → `requireOwner` + same-origin check (`Sec-Fetch-Site` in {same-origin, none} or `Origin` host equals request host) + in-memory rate limit (10 actions / minute / actor). Pure pieces in `lib/admin/guards.ts`: `isSameOrigin(headers, host)`, `isSnowflake(id)`, `RateLimiter`.
- All admin responses set `Cache-Control: no-store`.

### 5.2 Read endpoints

`GET /api/admin/overview`
```ts
{
  status: { heartbeat: IBotHeartbeat | null; fresh: boolean; ageSec: number | null };
  infra: { redis: { ok: boolean; ms: number | null }; mongo: { ok; ms }; debugPanel: { configured: boolean; ok: boolean; ms } };
  totals: { guilds; members; playing; paused; premiumUsers; premiumGuilds; linkedBots: Record<LinkedBotStatus, number>; guildsWithSettings };
  activity: { commands24h; commandsPrev24h; tracks24h; tracksPrev24h; errors24h; errorRate24h; uniqueUsers7d; uniqueGuilds7d };
  series14d: { date: string; commands: number; tracks: number; errors: number }[];   // UTC days, zero-filled
  topCommands7d: { command: string; count: number; failed: number }[];              // top 10
  sources7d: { source: string; starts: number; errors: number }[];
  recentErrors: { ts; kind; scope?; guildId?; guildName?; command?; track?; message }[]; // last 20
  membership30d: { joins: number; leaves: number; recent: { ts; event; guildId; name; memberCount }[] }; // last 10
}
```
Redis and Mongo degrade independently (existing pattern in `analytics`): if one is down, its fields are `null`/empty and `infra` says so.

`GET /api/admin/guilds` (extend existing) adds per guild: `premium: { active, bitrate, tier? } | null`, `settingsSummary: { djRoleId, language, maxQueueSize, logChannelId, totalSongsPlayed, totalPlaytime } | null`, `activity7d: { commands, tracks }`, `playback: { isPlaying, isPaused, currentTrack, queueSize, voiceChannelName } | null`, `lastActive` (max of playback update and last event). Stats add `premiumGuilds`. Owner check moves to `requireOwner()`.

`GET /api/admin/guilds/[guildId]` → `{ guild, settings, premium, playback, events (last 30), activity: { commands7d, tracks7d, topCommands, topRequesters } }`. 404 when the bot is not in the guild and no data exists.

`GET /api/admin/logs?last=200&level=&search=` → proxies `${DEBUG_PANEL_URL}/api/logs?token=${DEBUG_TOKEN}` with a 3 s timeout. 501 `{ error: "not_configured" }` when env is missing, 502 when unreachable. Token never leaves the server.

`GET /api/admin/audit?limit=50` → latest audit entries.

`GET /api/admin/analytics` unchanged (growth charts; consumed by both pages).

### 5.3 Action endpoints (POST, `requireOwnerAction`, audited)

| Route | Effect |
|---|---|
| `POST /api/admin/guilds/[guildId]/leave` | Validate snowflake; 404 if not in Redis; Discord `DELETE /users/@me/guilds/{id}` with bot token; on 204 also remove the Redis keys; audit `guild.leave` |
| `POST /api/admin/guilds/[guildId]/stop` | Enqueue `BotCommand { guildId, command: "stop" }`, wait ≤ 5 s (helper `lib/bot-commands.ts: enqueueAndWait`); audit `guild.stop` |
| `POST /api/admin/resync` | Enqueue `{ type: "admin_resync" }`, wait ≤ 5 s; audit `bot.resync` |

Audit model `adminauditlogs` (`lib/models/AdminAuditLog.ts`): `{ ts, actorId, actorName, action, targetGuildId?, targetName?, ok, result?, error?, ip?, userAgent? }`, index `{ts:-1}`, no TTL. Failed attempts are logged too.

### 5.4 Page `/admin`

- `app/(dashboard)/admin/page.tsx`: server component. `if (!(await isOwnerSession())) redirect("/dashboard")`. `metadata.robots = { index: false, follow: false }`. Renders `<AdminConsole />`.
- Client: `components/admin/AdminConsole.tsx` fetches `overview` (poll 30 s), `guilds` (poll 60 s), `analytics` (once), `audit` (on demand). Refresh button forces all. Polling pauses when the tab is hidden.
- Sections (sticky anchor sub-nav `SectionNav`): Overview · Servers · Activity · Premium & Bots · Logs · Audit.
- Components (`components/admin/`): `StatusStrip`, `KpiGrid`, `ActivityCharts`, `ServersTable`, `GuildDrawer`, `ErrorsList`, `PremiumPanel`, `LogsPanel`, `AuditPanel`, `ConfirmDialog`, `SectionNav`. Charts reuse `components/insights/AreaChart` and `BarRow`.
- Visual: studio-console tokens and utility classes (`console-panel`, `console-label`, `stat-readout`, `led`), Bricolage/Instrument/JetBrains fonts, amber accents; no MUI cards. Mobile: KPI grid 2 columns, servers table scrolls horizontally inside its own container, drawer becomes full-width sheet.
- Status strip: LED colour = green when heartbeat fresh (< 90 s), amber when stale (90 s – 10 min), red/offline otherwise. Shows uptime, ws ping, RSS, CPU, versions, and infra chips.
- Servers table: search (name/id), sort (members, joined, last active, tracks 7d, commands 7d), row click opens `GuildDrawer` with settings summary, premium, playback, recent events and the two actions. "Leave server" requires typing the server name in `ConfirmDialog`.
- Logs panel: level filter, search, auto-refresh toggle (5 s), newest at bottom with sticky scroll. Shows a "not configured" panel on 501.
- `DashboardSidebar` unchanged; `MobileDrawer` gets the Admin item (layout passes `isOwner` through `DashboardHeader`).

### 5.5 Pure modules (unit-tested)

- `lib/admin/format.ts`: `relTime`, `compact`, `bytes`, `uptime`, `pct`.
- `lib/admin/aggregate.ts`: `fillDailySeries(rows, days)`, `delta(curr, prev)`, `errorRate(errors, total)`, `freshness(ts, now)`.
- `lib/admin/guards.ts`: `isSameOrigin`, `isSnowflake`, `RateLimiter`.

## 6. Environment

Dashboard (`dashboard/.env`, `.env.example` updated):
```
OWNER_ID=1066182746399055993
DEBUG_PANEL_URL=http://music-bot:9090     # compose service name; bot's DebugPanel
DEBUG_TOKEN=<same value as bot .env>
```
Bot (optional): `BOT_EVENTS_TTL_DAYS=90`.

## 7. Error handling and degradation

- Telemetry never throws into the bot: all writes are `void`-ed with a catch; Mongo down → events dropped, heartbeat still written to Redis; Redis down → heartbeat skipped, events still stored.
- Dashboard: each data source is wrapped; partial data renders with an inline "source unavailable" chip rather than a blank page.
- Actions return structured `{ ok, error }`; UI shows a toast and re-fetches. Discord REST 429 → surfaced as "rate limited, retry later".

## 8. Testing

- Root: add `vitest` (devDependency), script `npm test` → `vitest run`. Tests in `tests/unit/*.test.ts`. `tsconfig.json` excludes `**/*.test.ts` and `tests/unit` from the build so `dist/` stays clean. Coverage: heartbeat builder, cpu percent, event shaping, stack truncation.
- Dashboard: add `vitest`, script `npm test`. Tests beside the pure modules (`src/lib/admin/*.test.ts`). Coverage: series fill, deltas, freshness, same-origin check, snowflake validation, rate limiter, formatters.
- Manual verification after deploy: heartbeat `ts` advances in Redis; `/api/admin/overview` returns 401 unauthenticated; owner login renders the page; screenshot of `/admin` in the browser.

## 9. Deployment (box83, `/root/music-bot`, branch `music`)

1. Commit and push.
2. `ssh root@83.147.54.179`, `git pull`.
3. Append `OWNER_ID`, `DEBUG_PANEL_URL`, `DEBUG_TOKEN` to `dashboard/.env` (copy `DEBUG_TOKEN` from the bot `.env`).
4. `COMPOSE_BAKE=false docker compose up -d --build bot dashboard` (bot restarts ≈ 30 s; current playback is interrupted).
5. Verify per §8.

## 10. Out of scope (v1)

Manual premium toggle, broadcast messages, CSV export, multi-shard support, per-user analytics, alerting/notifications, retention beyond 90 days for events.
