# Bot listing kit

Everything needed to list **Bypass Hi-Fi Music Bot** on bot directories. Every claim below is something the bot does today (checked 2026-11-26). Keep it that way: reviewers test the bot, and users who find a missing feature leave.

## Facts for the forms

| Field | Value |
|---|---|
| Bot / application ID | `1315125264786653225` |
| Name | Bypass Hi-Fi Music Bot |
| Prefix | `/` (slash commands only; no message prefix) |
| Help command | `/help` |
| Library | discord.js (TypeScript) |
| Invite URL | https://music-bot.checkleaked.com/invite |
| Website | https://music-bot.checkleaked.com |
| Support server | https://discord.gg/hjJQKp5zDU (permanent invite) |
| Privacy policy | https://music-bot.checkleaked.com/privacy |
| Terms | https://music-bot.checkleaked.com/terms |
| Source | https://github.com/eduair94/music-bot |
| Premium | Optional. Founder on Patreon ($3/month). Voting unlocks 24/7 and studio quality for 12 h. |
| Permissions | No Administrator. View/Send/Embed/Attach/Read History/External Emojis in text; Connect/Speak/Voice Activity/Request to Speak in voice; Set Voice Channel Status. |
| Tags | Music, Radio, Spotify, YouTube, Lyrics, 24/7, Playlists, Multilingual |
| Languages | 28: English, Spanish, Portuguese (BR), French, German, Italian, Dutch, Polish, Russian, Ukrainian, Turkish, Arabic, Persian, Japanese, Korean, Chinese (Simplified, Singapore, Traditional), Thai, Vietnamese, Indonesian, Czech, Bulgarian, Greek, Romanian, Swedish, Norwegian, Māori |

## Short descriptions

- **≤ 140 chars (top.gg):** Hi-fi music with a button player: YouTube, Spotify, SoundCloud, Apple Music, Deezer. Autoplay radio, lyrics, effects, 24/7, 28 languages.
- **≤ 191 chars (discordbotlist.com, botlist.me):** Hi-fi music bot with a button player that never expires. Play YouTube, Spotify, SoundCloud, Apple Music and Deezer, with live search, autoplay radio, lyrics, effects, playlists and 24/7.
- **≤ 200 chars (discords.com):** Same as above.

## Long description (Markdown)

```markdown
# 🎶 Bypass — hi-fi music for your server

Join a voice channel and type **/play**. Results show up while you type, so you pick the exact song before it plays.

## Play anything
- **YouTube & YouTube Music**: songs, live streams and whole playlists
- **Spotify**: tracks, albums and playlists
- **SoundCloud**, **Apple Music** and **Deezer** links
- Audio files: right-click any message with a link or file → *Apps → Play in voice channel*

## A player you can actually use
Every song gets a live player card with buttons: previous, pause, skip, stop, loop, shuffle, volume, autoplay, queue, lyrics and save-to-DMs. The buttons keep working for as long as the music plays, with no timeouts. The voice channel's status shows what's playing.

## Never runs out
- **Autoplay** queues related songs when your queue ends (from the YouTube mix of the last song)
- **/radio <song>** starts an endless station from one song
- **24/7 mode** keeps the bot in your channel and brings it back after restarts

## Everything else
- **Queue**: /queue with pages, /move, /remove, /shuffle, /jump, /clear, /playnext, /playnow, vote-skip
- **Effects**: bass boost (3 levels), nightcore, vaporwave, 8D, karaoke, and more
- **Lyrics** for what's playing or any song (also works in DMs if you install the app to your account)
- **Saved playlists** with /collections
- **Server settings**: DJ role, allowed channels, volume limits, max queue size, max song length, duplicate blocking, auto-leave timer
- **28 languages**: each member sees the bot in their Discord language, or set one for the server with /language

## Free, with optional perks
Everything above is free. Voting unlocks 24/7 mode and studio quality for 12 hours. Founder supporters ($3/month on Patreon) keep them permanently.

Support: https://discord.gg/hjJQKp5zDU · Website: https://music-bot.checkleaked.com
```

## Plain-sentence description (bots.ondiscord.xyz forbids lists and pipes)

Bypass is a music bot that plays YouTube, Spotify, SoundCloud, Apple Music and Deezer in your voice channel with a button player that keeps working all session. Search results appear while you type in /play, autoplay keeps related songs going when the queue ends, and /radio starts an endless station from one song. It shows lyrics, applies effects such as bass boost and nightcore, saves playlists, and can stay in your channel around the clock. Server admins can set a DJ role, allowed channels and limits, and every member sees the bot in their own language, with 28 to choose from.

## Reviewer note

Slash commands only. To test: join a voice channel, run `/play song:never gonna give you up`, then use the buttons on the player card. `/help` lists every command. Premium is not needed for review; to try 24/7, vote once on this site, then run `/247`.

## Status (2026-11-26)

| Site | State | Wired |
|---|---|---|
| top.gg | Listed; copy, tags, 18 languages, support invite and repo updated | v1 token (stats + command sync), signed vote webhook verified (200 signed / 401 forged) |
| discordbotlist.com | Listed; copy, tags, invite and support updated | Vote webhook + secret set. API token still missing (the "Generate token" link on the bot page didn't respond to automation; one click by the owner) |
| discord.bots.gg | Listed; copy updated | API key set, stats posting (200) |
| botlist.me | Submitted 2026-11-26, in review queue (~1 day). Owner joined their server (required) | Token after approval |
| discords.com | Not listed: their "Add bot" lookup answers "not found" for our public ID | Retry later |
| discordlist.gg, voidbots.net, discord.place, radarcord.net, bots.ondiscord.xyz | Not submitted yet | — |

## Where to list it

Approval needs an owner login on each site. Order by reach:

| Site | Submit at | Notes |
|---|---|---|
| top.gg | https://top.gg/bot/new | ~1 week review. After approval: Project → Integrations & API → create a v1 token → `TOPGG_TOKEN`; Webhooks → URL below, secret → `TOPGG_WEBHOOK_SECRET`. Max 3–5 vote-locked commands (we have one: /247). |
| discordbotlist.com | https://discordbotlist.com/bots/new | Token → `DISCORDBOTLIST_TOKEN`; webhook secret → `DISCORDBOTLIST_WEBHOOK_SECRET`. |
| discord.bots.gg | https://discord.bots.gg/bots/add | Token → `DISCORDBOTSGG_TOKEN`. Owner must stay in their server. No voting. |
| discords.com | https://discords.com/bots/add | Token → `DISCORDS_TOKEN`; webhook secret → `DISCORDS_WEBHOOK_SECRET`. |
| botlist.me | https://botlist.me/add | Token → `BOTLISTME_TOKEN`; webhook → `BOTLISTME_WEBHOOK_SECRET`. Owner must join their server. |
| discordlist.gg | https://discordlist.gg | Token → `DISCORDLISTGG_TOKEN`. |
| voidbots.net | https://voidbots.net | Token → `VOIDBOTS_TOKEN`; webhook → `VOIDBOTS_WEBHOOK_SECRET`. |
| discord.place | https://discord.place | Token → `DISCORDPLACE_TOKEN` (the bot posts at most once per 6 h; more gets the key revoked). |
| radarcord.net | https://radarcord.net | Token → `RADARCORD_TOKEN`. |
| bots.ondiscord.xyz | https://bots.ondiscord.xyz | Use the plain-sentence description. Token → `BOTSONDISCORD_TOKEN`. |

**Skip:** omniplex.gg (ex-Infinity Bot List) rejects YouTube music bots. discordservices.net, disforge.com, discord-botlist.eu and wonderbotlist.com are dead. The Discord App Directory needs a verified app, which opens around 75 servers.

## Wiring after approval

1. Put each site's API token in the **bot** `.env` (names above). The bot posts the server count every 30 minutes and syncs its command list to top.gg and discordbotlist.com.
2. Put each webhook secret in the **dashboard** `.env`. Vote webhook URLs:
   - top.gg: `https://music-bot.checkleaked.com/api/webhooks/vote/topgg` (v1 signed webhooks and the legacy secret both work)
   - discordbotlist.com: `.../api/webhooks/vote/discordbotlist`
   - discords.com: `.../api/webhooks/vote/discords`
   - botlist.me: `.../api/webhooks/vote/botlistme`
   - voidbots.net: `.../api/webhooks/vote/voidbots`
   - discord.place: `.../api/webhooks/vote/discordplace`
3. Optional: `VOTE_LOG_WEBHOOK_URL` (dashboard) = a Discord channel webhook in the support server, to thank voters publicly.
4. `/vote` and the Vote button in `/help` appear automatically once a site's token is set.
