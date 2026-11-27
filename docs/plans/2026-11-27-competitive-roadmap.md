# Bypass competitive roadmap (2026-11-27)

Goal: make Bypass the music bot a server picks over Jockie Music. Owner decisions on 2026-11-27: four free bots per server and more with Premium; the dashboard serves admins (configure) and DJs (run the music); the dashboard gets a new visual world.

## Where we stand

| | Jockie Music | Bypass today | Bypass after this plan |
|---|---|---|---|
| Bots per server | 4 free (Jockie, 1, 2, 3), more with Premium boost | 1 | 4 free, more with Premium |
| Picking a bot | Each bot has its own prefix/commands; you pick | n/a | One `/play`: Bypass sends a free bot to your channel |
| Permissions | `m!permission allow/deny` per command, per role/user | DJ role on ~20 commands; `permissions` field stored but never enforced | Rule matrix per action group, per role/member, per bot; enforced everywhere, editable on the web |
| Web control | Usage stats; reviews report no live web player | Polling player for one bot, settings form | Live player per bot (server-sent events), queue reorder, effects, lyrics, history, analytics |
| Explaining "no" | Generic denial | Generic denial | Every denial names the rule and who can change it |

## Audit findings to fix first (they break the dashboard today)

1. `botcommands` enum allows 16 commands while the API accepts ~40: `previous`, effects, join, autoplay buttons return 500 (`dashboard/src/lib/models/BotCommand.ts:40-45`).
2. Settings form PATCHes the whole document: saving overwrites `totalSongsPlayed`/`totalPlaytime`; the dashboard schema silently drops `voteSkipPercentage`, `autoplay`, `stay247`, `disabledCommands`, blacklists and `permissions`; maxVolume allows 200 where the bot caps at 100.
3. Bot caches settings for 5 min with no invalidation, so dashboard edits apply late (`services/guildSettings.ts`).
4. Dashboard controls bypass DJ checks and `maxVolume`.
5. `playback:<guildId>` expires mid-song (refreshed only on events); position is stale.
6. Linked-bot workers: start/stop omits `requestedBy` (validation error), stop message mismatch (`shutdown` vs `stop`), `/play` never works because the player service is not initialised in the worker.
7. Unenforced fields: `blacklistedSongs/Authors/Titles`, `permissions`, `premium.*` on guild settings.

## Pillar 1 — Bypass fleet (multi-bot)

**Model.** Every instance is a separate Discord application ("Bypass", "Bypass 2", "Bypass 3", "Bypass 4"; Premium: "Bypass 5"…"Bypass 8") running the same image with `BOT_INSTANCE=<n>` and its own token. Instance 1 is the primary.

**Dispatch.** Only the primary registers slash commands, so a server sees one `/play`. When `/play` comes from a member in voice channel V:
1. An instance already in V takes it.
2. Else a channel binding (admin pinned "Bypass 2 serves #Gaming") decides.
3. Else the first idle instance that is in the guild and allowed in V takes it.
4. Else the request is refused with the list of busy bots and channels, plus the invite for missing instances (and Premium for 5+).
The primary hands the job to the chosen instance through the command bus; the instance joins, posts its own player card and owns its buttons (component interactions go to the app that posted them, so each instance handles its own panel with the same code).

**State keyed by instance.** `playback:<guildId>:<n>`, `PlaybackState {guildId, instance}` unique pair, `botcommands.instance`, `bot:status:<n>`, `bot:guilds:<n>`, stay-24/7 per instance, panel registry per instance, vote-skip per instance. Instance 1 keeps the legacy keys readable during the migration.

**Process.** One compose service per instance (`bot`, `bot-2`, `bot-3`, `bot-4`), same image, env from `.env` (`TOKEN_2`…). Secondary instances skip: command registration, list posting (top.gg etc.), support-server service, vote/Patreon services, telemetry of global counters.

**Dashboard.** Fleet page: which instances are in the server (invite buttons for the missing ones), what each is playing and where, channel bindings, per-instance player.

**Owner action.** Create the extra applications in the Developer Portal (I can do it in the logged-in browser), set their avatars and names, put tokens in box83 `.env`.

## Pillar 2 — Permissions

**Action groups** (each slash command, panel button and dashboard action maps to one): `play` (add songs), `playback` (pause/resume/seek/previous), `skip`, `queue` (remove/move/shuffle/clear), `volume`, `effects`, `loop_autoplay`, `stop_leave`, `lyrics_view`, `settings` (dashboard and `/settings`).

**Rules.** Per group: allow/deny lists of roles and members, plus modes:
- `everyone` (default for play, lyrics), `dj` (DJ roles, multiple allowed), `admins` (Manage Server or admin role).
- Escape hatches, each toggleable: requester may skip/remove their own songs; a member alone with the bot counts as DJ; vote-skip for non-DJs at the configured percentage.
- Optional per-instance channel scope (which voice channels each bot may serve).

**One gate.** `utils/permissions.ts → canUse(member, group, ctx)` returns `{ok, reason, rule}`; used by slash commands, panel buttons and the dashboard API (the dashboard resolves the member's roles through the bot token, never trusting the client). Denials say which rule blocked and who can change it.

**Migration.** Existing `djRoleId` becomes `dj` mode on playback/skip/queue/volume/effects/stop groups so behaviour does not change on deploy.

## Pillar 3 — Dashboard v2 (new visual world)

Users: admins configure; DJs run music. Access: anyone in the server can open the server; what they can do follows Pillar 2 (`settings` group = admin screens).

Screens:
1. **Servers** — every server you share with Bypass, live state per server (bots playing / idle), add-to-server for the rest.
2. **Server home (Fleet)** — the instances as first-class players: channel, now playing, progress, listeners, quick controls; invite missing instances.
3. **Player** (per instance) — now playing, transport, volume, seek, loop, autoplay, effects, synced lyrics, queue with drag reorder, search with autocomplete, collections, history "play again".
4. **Permissions** — matrix of action groups × roles/members, modes, escape hatches, preview "what can @role do", audit of changes.
5. **Settings** — every bot setting, including the fields dropped today; per-field save with validation; immediate apply (cache invalidation via Redis pub/sub).
6. **Activity** — 30-day plays, top tracks/requesters, hours, skips, commands (from `playhistory` and `botevents`).
7. **Collections**, **Premium**, **Profile** — kept, restyled.

Transport: server-sent events from Redis pub/sub (`playback:<guild>:<n>` updates publish), position interpolated client-side; commands keep the `botcommands` bus with instance targeting and a shorter poll (or Redis list) on the bot.

## Pillar 4 — Next (after the three pillars)

- Premium per server (the Premium instances need a server-level entitlement, today premium is per user).
- Shared queue sessions: link two channels to one queue (watch parties).
- Scheduled playlists (e.g. "lo-fi in #study every weekday 9–17") using the fleet.
- Web listen-along preview (no audio relay; sync view only).

## Order of work

1. Fix audit findings 1–5 (they also block the new dashboard).
2. Permissions core + migration + enforcement in commands/buttons/dashboard API.
3. Instance-aware state and command bus; dispatcher in the primary; compose services; works with one instance (no behaviour change), then with N.
4. Dashboard v2 on top of the new APIs (direction round → build → review).
5. Create Bypass 2–4 applications, deploy instances, update listings and landing copy only once live.

Claims rule: landing, listings and Patreon mention multi-bot and the permission system only after they run in production.
