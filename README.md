# 🎶 Bypass — hi-fi Discord music bot

**[Add to Discord](https://music-bot.checkleaked.com/invite)** · [Website](https://music-bot.checkleaked.com) · [Commands](https://music-bot.checkleaked.com/commands) · [Support server](https://discord.gg/hjJQKp5zDU)

Join a voice channel and type `/play`. Results appear while you type.

## Features

- **Sources:** YouTube and YouTube Music (songs, live streams, playlists), Spotify (tracks, albums, playlists), SoundCloud, Apple Music, Deezer, and audio files. Right-click a message → *Apps → Play in voice channel*.
- **Player card** (Components V2) under every song with buttons that never time out: previous, pause, skip, stop, queue, loop, shuffle, volume, autoplay, lyrics, save to DMs. The voice channel status shows the current song.
- **Autoplay** and **`/radio`**: related songs keep playing when the queue ends, prefetched so there's no gap.
- **24/7 mode**: stays in the channel and rejoins it after restarts (Founder, or 12 h after a vote).
- **Queue tools:** `/queue` with pages, `/playnext`, `/playnow`, `/move`, `/remove`, `/jump`, `/shuffle`, `/clear`, `/voteskip`.
- **Effects:** bass boost (3 levels), nightcore, vaporwave, 8D, karaoke and more.
- **Lyrics** for the current song or any song; installable to your own account so it works in DMs.
- **28 languages:** every member sees the bot in their Discord language, or a server picks one with `/language`.
- **Server settings:** DJ role, allowed channels, volume limits, queue size, max song length, duplicate blocking, auto-leave timer — also editable from the web dashboard.

## Architecture

| Path | What it is |
|---|---|
| `structs/Bot.ts` | Startup and the interaction router (slash commands, autocomplete, context menus, buttons, selects, modals) |
| `structs/componentRouter.ts` | Persistent component handlers by custom-id namespace (`player:`, `queue:`, `help:`, `search:`) |
| `services/discordPlayer.ts` | discord-player setup; streams through yt-dlp with an 8 MB buffer |
| `services/playerPanel.ts` | The now-playing card, voice channel status, autoplay hooks |
| `utils/playFlow.ts` | The single play pipeline behind every way of starting music |
| `utils/i18n.ts` | Per-request language (AsyncLocalStorage) over `locales/*.json` |
| `dashboard/` | Next.js website, dashboard, Patreon and vote webhooks |

More in [ARCHITECTURE.md](ARCHITECTURE.md) and [BOT_LISTING.md](BOT_LISTING.md).

## Running your own copy

Requirements: Node.js 22, FFmpeg, [yt-dlp](https://github.com/yt-dlp/yt-dlp), MongoDB and Redis. No privileged gateway intents are needed.

```sh
cp .env.example .env     # TOKEN, MONGODB_URI, REDIS_URL, ...
npm ci
npm run dev              # or: docker compose up -d --build bot dashboard
```

Checks before deploying:

```sh
npx tsc --noEmit
npm test
npx ts-node --transpile-only scripts/dryRunCommands.ts   # command payload + UI render limits
npx ts-node --transpile-only scripts/testSources.ts      # each music source resolves
```

`node scripts/translateLocales.mjs` fills keys missing from any locale with Claude (only missing keys; placeholders are verified).

## Credits

Started from [EvoBot](https://github.com/eritislami/evobot) by Erit Islami (MIT). See [LICENSE](LICENSE).
