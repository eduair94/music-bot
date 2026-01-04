# Music Bot Architecture

This document describes the architecture of the Music Bot project, including its components, services, and data flow.

## Overview

The project consists of three main components:

1. **Bot** - The main Discord music bot
2. **Dashboard** - Next.js web dashboard for managing the bot (includes landing pages)
3. **Workers** - Spawned processes for user-linked bots

## Directory Structure

```
music-bot/
├── commands/           # Slash command handlers
│   └── settings/       # Settings subcommand handlers
├── dashboard/          # Next.js dashboard + landing pages
│   └── src/
│       ├── app/        # App router pages and API routes
│       │   ├── (landing)/    # Marketing pages (/, /invite)
│       │   ├── (dashboard)/  # Authenticated dashboard pages
│       │   └── api/          # API routes (webhooks, settings, etc.)
│       ├── components/ # React components
│       │   ├── landing/      # Landing page components (Tailwind)
│       │   └── dashboard/    # Dashboard components (MUI)
│       ├── lib/        # Utilities, database, models
│       └── types/      # TypeScript types (re-exports shared)
├── interfaces/         # Bot-specific TypeScript interfaces
├── locales/           # i18n translation files (25+ languages)
├── models/            # Mongoose models for bot
├── services/          # Bot services
├── shared/            # Shared types between bot/dashboard
│   └── types/         # Consolidated TypeScript interfaces
├── structs/           # Core bot structures
├── utils/             # Utility functions
└── workers/           # Worker processes for linked bots
```

## Core Services

### Bot Services (`services/`)

| Service | Description |
|---------|-------------|
| `database.ts` | MongoDB connection management |
| `discordPlayer.ts` | discord-player integration and configuration |
| `dashboardSync.ts` | Syncs playback state with dashboard via MongoDB |
| `botManager.ts` | Manages user-linked bot processes |
| `guildSettings.ts` | Guild settings CRUD operations |
| `patreon.ts` | Patreon API integration for premium features |
| `premiumGuild.ts` | Premium guild management |
| `spotify.ts` | Spotify authentication for track extraction |

### Dashboard Services (`dashboard/src/lib/`)

| Service | Description |
|---------|-------------|
| `mongodb.ts` | MongoDB connection with connection caching |
| `patreon.ts` | Patreon webhook handling for dashboard |
| `models/` | Mongoose models (import shared types) |

### Dashboard API Routes (`dashboard/src/app/api/`)

| Route | Description |
|-------|-------------|
| `/api/webhooks/patreon` | Patreon webhook endpoint |
| `/api/health` | Health check endpoint |
| `/api/guilds/[guildId]/settings` | Guild settings management |
| `/api/guilds/[guildId]/player` | Player state and commands |
| `/api/user/bots` | Linked bots management |

## Data Models

### Shared Types (`shared/types/index.ts`)

All major interfaces are defined in the shared types module and used by both bot and dashboard:

- **IGuildSettings** - Server configuration
- **IPlaybackState** - Real-time playback state
- **ITrack** - Song/track information
- **IBotCommand** - Dashboard-to-bot commands
- **ILinkedBot** - User-linked bot configuration
- **IPatreonUser** - Patreon membership data

### MongoDB Collections

| Collection | Description | Written By | Read By |
|------------|-------------|-----------|---------|
| `guildsettings` | Guild configuration | Bot, Dashboard | Bot, Dashboard |
| `playbackstates` | Real-time playback | Bot | Dashboard |
| `botcommands` | Dashboard commands | Dashboard | Bot |
| `linkedbots` | User-linked bots | Dashboard, Bot | Bot, Dashboard |
| `patreonusers` | Premium users | Bot (webhooks) | Bot, Dashboard |
| `premiumguilds` | Premium servers | Bot | Bot |

## Data Flow

### Bot → Dashboard (Playback State)

```
Player Event → DashboardSyncService → MongoDB → Dashboard API → UI
```

The bot writes playback state to `playbackstates` collection on player events:
- Track start/end
- Play/pause/resume
- Volume change
- Queue modifications

Dashboard polls this collection or uses real-time subscriptions for updates.

### Dashboard → Bot (Commands)

```
UI Action → API Route → MongoDB → Bot Command Polling → Player
```

Dashboard creates commands in `botcommands` collection. Bot polls for pending commands and executes them:
- play, pause, resume, skip, stop
- volume, shuffle, loop
- queue management (remove, move, clear)

### Linked Bot Flow

```
Dashboard → Link Request → BotManager → Spawn Worker → Linked Bot Active
```

1. User provides bot token via dashboard
2. BotManager validates token and encrypts it
3. Worker process spawned with decrypted token
4. Worker connects to Discord as the linked bot
5. Parent monitors health, restarts on failure

## Authentication

### Dashboard Authentication (Auth.js v5)

- Discord OAuth2 for user login
- JWT sessions stored in cookies
- Access to user's Discord guilds via API

### Premium/Patreon

- Patreon OAuth2 for linking accounts
- Webhook handling for real-time membership updates
- Tier-based feature gating

### Webhook Handling

Patreon webhooks are handled by the Next.js dashboard at `/api/webhooks/patreon`.

Configure your Patreon webhook URL to point to:
```
https://your-dashboard-url.com/api/webhooks/patreon
```

Set `DASHBOARD_URL` in your `config.json` to enable the `/patreonadmin createwebhook` command to register webhooks automatically.

## Premium Tiers

| Tier | Pledge | Max Linked Bots | Audio Bitrate | Filters | 24/7 Mode |
|------|--------|-----------------|---------------|---------|-----------|
| Free | $0 | 0 | 128 kbps | ❌ | ❌ |
| Basic | $3+ | 1 | 192 kbps | ✅ | ❌ |
| Pro | $10+ | 3 | 256 kbps | ✅ | ✅ |
| Enterprise | $25+ | 10 | 320 kbps | ✅ | ✅ |

## Security Considerations

### Token Encryption

Linked bot tokens are encrypted using AES-256-CBC:
- 32-byte encryption key from `BOT_ENCRYPTION_KEY` environment variable
- Random IV per token
- Encrypted token and IV stored in database
- Decrypted only in memory when spawning worker

### API Security

- All dashboard API routes require authentication
- Guild management requires MANAGE_GUILD permission
- Bot token validation before linking
- Rate limiting on sensitive endpoints

## Environment Variables

```env
# Discord
TOKEN=bot_token
CLIENT_ID=discord_app_client_id

# Database
MONGODB_URI=mongodb://...

# Dashboard
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Patreon (Optional)
PATREON_CLIENT_ID=...
PATREON_CLIENT_SECRET=...
PATREON_CREATOR_ACCESS_TOKEN=...
PATREON_CAMPAIGN_ID=...
PATREON_WEBHOOK_SECRET=...

# Linked Bots
BOT_ENCRYPTION_KEY=64_character_hex_string
```

## Development

```bash
# Install dependencies
npm install

# Start bot in development
npm run dev

# Start dashboard (includes landing page)
cd dashboard && npm run dev

# Build for production
npm run build
cd dashboard && npm run build

# Type check
npx tsc --noEmit
```

## Dashboard Architecture

The dashboard uses Next.js App Router with two styling approaches:

- **Landing Pages** (`/`, `/invite`): Tailwind CSS for modern marketing design
- **Dashboard Pages** (`/dashboard`, `/servers/*`): MUI (Material UI) for consistent admin interface

Route groups separate concerns:
- `(landing)/` - Public marketing pages
- `(dashboard)/` - Authenticated admin pages
- `api/` - Backend API routes

## Scaling

The architecture supports horizontal scaling:

1. **Bot** - Single instance (Discord gateway limitation per token)
2. **Dashboard** - Multiple instances behind load balancer
3. **Workers** - Multiple processes managed by BotManager
4. **Database** - MongoDB replica set for high availability

For multiple bot shards, modify `Bot.ts` to use `ShardingManager`.
