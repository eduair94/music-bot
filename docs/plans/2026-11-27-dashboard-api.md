# Dashboard v2 API contract (2026-11-27)

Shared contract between the bot work (permissions, fleet) and the new dashboard UI. All routes live under `dashboard/src/app/api/guilds/[guildId]/`. Auth: next-auth session (Discord). A route returns 401 without a session, 403 when the user is not in the guild or lacks the permission group, 404 when Bypass (instance 1) is not in the guild.

Access model: any member of a guild that has Bypass can open the guild. What they may do is decided server-side by `canUse(member, group)` (see roadmap Pillar 2) using the member's roles fetched with the bot token (never trusted from the client). `settings` group = admin screens (Manage Server, admin role, or the `settings` rule).

## Types

```ts
type Group = "play" | "playback" | "skip" | "queue" | "volume" | "effects"
  | "loop_autoplay" | "stop_leave" | "lyrics_view" | "settings";

interface GroupRule {
  mode: "everyone" | "dj" | "admins";
  allowRoles: string[]; denyRoles: string[];
  allowUsers: string[]; denyUsers: string[];
}

interface PermissionConfig {
  djRoles: string[];
  groups: Record<Group, GroupRule>;
  options: {
    requesterCanSkipOwn: boolean;   // requester may skip/remove own songs
    aloneIsDj: boolean;             // member alone with the bot counts as DJ
    voteSkip: { enabled: boolean; percentage: number }; // non-DJs may vote-skip
  };
  instanceChannels: Record<string, string[]>; // instance number -> allowed voice channel ids ([] = any)
}

interface Track { title: string; author: string; url: string; thumbnail?: string;
  duration: string; durationMs?: number; source?: string;
  requestedBy?: { id: string; username: string; avatar?: string } }

interface PlaybackState { guildId: string; instance: number; isConnected: boolean;
  voiceChannelId?: string; voiceChannelName?: string; textChannelId?: string;
  isPlaying: boolean; isPaused: boolean; volume: number; currentTrack?: Track;
  currentPosition: number; positionAt: number; // ms position measured at positionAt (epoch ms)
  queue: Track[]; queueSize: number; loopMode: "off" | "track" | "queue";
  autoplay?: boolean; filters?: string[]; listeners?: number; lastUpdated: number }

interface FleetInstance { instance: number; name: string; applicationId: string;
  avatarUrl?: string; inGuild: boolean; online: boolean; premium: boolean;
  inviteUrl: string; binding: { voiceChannelId: string | null };
  playback: PlaybackState | null }
```

## Routes

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /me` | | `{ userId, username, avatar, isAdmin, voiceChannelId: string \| null, groups: Record<Group, { ok: boolean; reason?: string }> }` |
| `GET /fleet` | | `{ guild: { id, name, icon }, instances: FleetInstance[], limits: { free: 4, max: 8, premiumActive: boolean } }` |
| `PUT /fleet/bindings` | `{ instance, voiceChannelId \| null }` | `{ ok }` (settings group) |
| `GET /playback` | `?instance=n` (default 1) | `PlaybackState` |
| `GET /stream` | | `text/event-stream`: `event: playback` data `PlaybackState`; `event: fleet` data `{ instance, online, inGuild }`; `event: settings` data `{ keys: string[] }`; comment ping every 15 s |
| `POST /commands` | `{ command, params, instance? }` | `{ success, message?, data? }`; 403 `{ error, reason, group }` when `canUse` denies |
| `GET /permissions` | | `PermissionConfig` |
| `PUT /permissions` | `PermissionConfig` | `{ ok, config }` (settings group); writes an audit entry |
| `GET /meta` | | `{ roles: { id, name, color, position, managed }[], voiceChannels: { id, name, parentName? }[], textChannels: { id, name }[] }` |
| `GET /settings` | | settings document (all bot fields, see `models/GuildSettings.ts`) |
| `PATCH /settings` | partial `{ field: value }` | `{ ok, settings }`; validated, never touches counters; publishes `settings:changed` so the bot drops its cache |
| `GET /activity` | `?days=7\|30` | `{ totals: { plays, listeningMs, requesters, skips, byInstance }, daily: { date, plays, listeningMs, byInstance }[], hours: number[24], topTracks: { title, author, url, thumbnail, plays, byInstance, instance }[], topRequesters: { id, username, avatar, plays }[], sources: Record<string, number> }`. `byInstance: Record<string, number>` = plays per fleet bot keyed by instance number (`{ "1": 40, "2": 12 }`, zero counts omitted); `topTracks[].instance` = the bot that played it most (ties to the lower number). Play-history rows without `instance` (written before the bot recorded it) count as 1. |
| `GET /history` | `?limit=50` | `{ items: { title, author, url, thumbnail, duration, source, requestedBy, playedAt, autoplay, instance }[] }`; `instance` = the fleet bot that played it (bot writes `INSTANCE` from `utils/instance.ts` into `playhistory.instance`, default 1; old rows read as 1) |
| `GET /audit` | `?limit=50` | `{ items: { ts, userId, username, action, summary }[] }` (settings, permissions, bindings changes) |

Commands accepted by `POST /commands` (bot executes, instance-targeted): `play {query, voiceChannelId?}`, `pause`, `resume`, `skip`, `previous`, `stop`, `volume {volume}`, `seek {position}`, `shuffle`, `loop {loopMode}`, `autoplay {enabled}`, `filter {name, enabled}`, `remove {position}`, `move {from, to}`, `skipto {position}`, `clear`, `join {voiceChannelId}`, `leave`, `search {query}` (returns `data: { results: Track[] }`, no permission beyond `play`).

Command → group: play/search→play; pause/resume/seek/previous→playback; skip/skipto→skip; remove/move/shuffle/clear→queue; volume→volume; filter→effects; loop/autoplay→loop_autoplay; stop/leave/join→stop_leave.
