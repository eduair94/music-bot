# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Server admins** (Discord "Manage Server"): add Bypass and its extra instances to a server, decide which bot serves which voice channel, set who may control music (DJ role, per-command rules), and tune server limits (volume, queue size, song length, language, 24/7).
- **DJs and members with music permission**: run the music live while they sit in a voice channel — search and queue songs, reorder, skip, change volume and effects — usually from a second screen or a phone next to Discord.
- Confirmed by the owner (2026-11-27): the dashboard serves both levels; admins configure, DJs control playback.

## Product Purpose

Bypass is a hi-fi Discord music bot. The web dashboard is where a server is run from: live player and queue for every bot instance in the server, the permission system, and every server setting, without typing commands. Success: an admin can set up multi-channel music and permissions in minutes, and a DJ can run a session from the browser as easily as from Discord.

## Positioning

Jockie Music's edge is several bots per server (four free) with permissions set through text commands; reviews report it has no live web player. Bypass offers the same multi-instance model (four free bots: Bypass plus three instances, more with Premium) and adds what Jockie does not: a real-time web player per instance and a visual permission system, both in one dashboard.

## Operating Context

- Used beside Discord: desktop browser on a second monitor during a gaming or hangout session, or a phone while in voice.
- Live state comes from the bot (Redis/Mongo sync); controls are sent back as commands the bot executes.
- Login is Discord OAuth (next-auth). Server pages require the member to share the guild with the bot; configuration requires Manage Server.
- The same Next.js app also serves the public landing (studio-console identity), `/admin` (owner console) and `/insights` (password-gated analytics).

## Capabilities and Constraints

- Sources: YouTube / YouTube Music, Spotify, SoundCloud, Apple Music, Deezer, audio files. Autoplay and `/radio`, 24/7 mode, effects (bass boost, nightcore, vaporwave, 8D, karaoke…), synced lyrics, `/history`, collections (saved playlists with import), guess-the-song game, 28 languages.
- Premium: Patreon "Founder" tier (USD 3, 50 spots), vote perks (12 h of 24/7 + max quality), support-server booster perks.
- Multi-bot (decided 2026-11-27): four free bots per server, more for Premium servers. The extra Discord applications do not exist yet and need the owner's Developer Portal session.
- Undecided: exact number of Premium instances; per-instance Premium pricing.
- Never claim: priority queue, "unlimited playlists", or scale beyond the real number (about 23 servers in Nov 2026; the old "10k servers" copy is false).
- Bitrate is real since 2026-11-27 (`services/audioEncoder.ts`): the Opus encoder sends the session's tier, 128 kbps standard and 320 kbps with Premium, a vote or a support-server boost, held to the voice channel's bitrate setting but never under 96 kbps (before that every server got ~99 kbps whatever the tier said). So say "up to 320 kbps" and tie it to Premium/vote/boost; never promise 320 kbps to free users or in every channel. YouTube's source is Opus ~130-160 kbps: the higher rate removes re-encoding loss, it does not add detail the source lacks.

## Brand Commitments

- Name: **Bypass**. Logo: `assets/brand/bypass-logo-1024.png` (violet mark), emoji `:bypass:`.
- The landing keeps its studio-console identity for now; the owner chose a new visual world for the dashboard (2026-11-27), and the landing may align with it later.
- Discord-branded buttons (login, add to server) may use Discord blurple.

## Evidence on Hand

- Real numbers: `/api/stats` (servers, users reached, songs played), Mongo `playhistory` (30 days), `botevents` (90 days), Redis `bot:status` heartbeat.
- No testimonials, reviews, press or customer logos exist. Do not invent them.

## Product Principles

1. Live first: what is playing, where, and who controls it is always one glance away.
2. Every control the bot has, the dashboard has; nothing in the dashboard the bot cannot do.
3. Permissions are visible: anyone can see why they can or cannot do something.
4. Multi-channel is native, not an add-on: each bot instance is a first-class player.
5. True claims only.

## Accessibility & Inclusion

- Interface in English today; the bot speaks 28 languages, so dashboard copy should be i18n-ready.
- Keyboard-operable player controls; WCAG AA contrast.
