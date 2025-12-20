# Music Bot - Development Guide

This document provides comprehensive information for developers who want to work on or extend this Discord music bot.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Commands](#commands)
5. [Configuration](#configuration)
6. [Database & Guild Settings](#database--guild-settings)
7. [Patreon Integration](#patreon-integration)
8. [Localization](#localization)
9. [Adding New Features](#adding-new-features)
10. [External Dependencies](#external-dependencies)
11. [Development Workflow](#development-workflow)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

This bot uses a clean, service-oriented architecture built on top of **discord-player** for music playback. The architecture follows these key principles:

- **Singleton Pattern**: The `DiscordPlayerService` is a singleton that manages all music playback
- **Separation of Concerns**: Commands are separate from services and core logic
- **Clean Code**: Each file has a single responsibility
- **Extensibility**: Easy to add new commands and features

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Bot Framework | discord.js v14 | Discord API interaction |
| Music Playback | discord-player v7 | Queue management and playback |
| YouTube | discord-player-youtubei + yt-dlp | YouTube extraction and streaming |
| SoundCloud | @discord-player/extractor | SoundCloud playback |
| Spotify | @discord-player/extractor | Spotify metadata (bridges to YouTube) |
| Voice | @discordjs/voice | Voice connection management |
| Database | MongoDB + Mongoose v9 | Persistent guild settings (optional) |
| Language | TypeScript | Type-safe development |
| Runtime | Node.js >= 16.11 | JavaScript runtime |

### Data Flow

```
User Command → Discord.js → Bot.ts → Command Handler → DiscordPlayerService → Voice Channel
                                                              ↓
                                                        Extractors (YouTube, SoundCloud, Spotify)
                                                              ↓
                                                         yt-dlp (Audio Streaming)
```

---

## Project Structure

```
music-bot/
├── index.ts              # Entry point - creates Bot instance
├── config.json           # Configuration file (TOKEN, settings)
├── cookies.txt           # (Optional) YouTube cookies for age-restricted content
│
├── structs/
│   └── Bot.ts            # Main bot class - handles client, commands, events
│
├── services/
│   ├── discordPlayer.ts  # Discord-player service (singleton) - music playback
│   ├── database.ts       # MongoDB connection service (singleton)
│   └── guildSettings.ts  # Guild settings service with caching
│
├── models/               # Mongoose database models
│   └── GuildSettings.ts  # Per-guild settings schema
│
├── commands/             # Slash command handlers
│   ├── play.ts           # Play songs (YouTube, SoundCloud, Spotify)
│   ├── pause.ts          # Pause playback
│   ├── resume.ts         # Resume playback
│   ├── stop.ts           # Stop and clear queue
│   ├── skip.ts           # Skip current track
│   ├── skipto.ts         # Skip to specific position in queue
│   ├── queue.ts          # Display current queue
│   ├── nowplaying.ts     # Show current track
│   ├── volume.ts         # Adjust volume
│   ├── loop.ts           # Toggle loop mode
│   ├── shuffle.ts        # Shuffle queue
│   ├── remove.ts         # Remove track from queue
│   ├── move.ts           # Move track position in queue
│   ├── search.ts         # Search and select from results
│   ├── playlist.ts       # Play entire playlists
│   ├── lyrics.ts         # Fetch song lyrics
│   ├── settings.ts       # Guild settings management (admin)
│   ├── premium.ts        # Premium status and management
│   ├── help.ts           # Show help information
│   ├── ping.ts           # Bot latency
│   ├── uptime.ts         # Bot uptime
│   └── invite.ts         # Bot invite link
│
├── interfaces/           # TypeScript interfaces
│   ├── Command.ts        # Command interface definition
│   └── Config.ts         # Configuration interface
│
├── utils/                # Utility functions
│   ├── config.ts         # Configuration loader (JSON or env)
│   ├── i18n.ts           # Internationalization setup
│   ├── checkPermissions.ts    # Permission validation
│   ├── djPermission.ts   # DJ role permission checker
│   ├── MissingPermissionsException.ts  # Permission error class
│   ├── queue.ts          # Queue helper utilities
│   └── safeReply.ts      # Safe interaction reply wrapper
│
├── locales/              # Language files (28 languages)
│   ├── en.json           # English (default)
│   ├── es.json           # Spanish
│   └── ...               # Other languages
│
├── tests/                # Test files
│   └── testSearch.ts     # Search functionality tests
│
└── dist/                 # Compiled JavaScript (build output)
```

---

## Core Components

### 1. Bot.ts (structs/Bot.ts)

The main bot class that:
- Creates the Discord.js client
- Initializes the DiscordPlayerService on startup
- Loads and registers all slash commands
- Handles command interactions
- Manages cooldowns

**Key Methods:**
- `constructor(client)` - Initializes the bot and sets up event listeners
- `registerSlashCommands()` - Dynamically loads and registers all commands
- `onInteractionCreate()` - Handles incoming interactions and routes to commands

**Usage:**
```typescript
import { Bot } from "./structs/Bot";
import { Client, GatewayIntentBits } from "discord.js";

export const bot = new Bot(
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      // ... other intents
    ]
  })
);
```

### 2. DiscordPlayerService (services/discordPlayer.ts)

A singleton service that manages all music functionality. This is the **heart of the music system**.

**Key Features:**
- Singleton pattern for global access
- Manages discord-player instance
- Custom yt-dlp streaming for reliable YouTube playback
- Registers all extractors (YouTube, SoundCloud, Spotify, Attachments)
- Event handling for player state changes

**Key Methods:**

| Method | Description |
|--------|-------------|
| `getInstance()` | Get the singleton instance |
| `initialize(client)` | Initialize the player (call once on bot start) |
| `isInitialized()` | Check if player is ready |
| `play(voiceChannel, query, textChannel)` | Play a song or add to queue |
| `search(query)` | Search for tracks |
| `getQueue(guildId)` | Get the queue for a guild |
| `skip(guildId)` | Skip current track |
| `pause(guildId)` | Pause playback |
| `resume(guildId)` | Resume playback |
| `stop(guildId)` | Stop and clear queue |
| `setVolume(guildId, volume)` | Set volume (0-100) |

**Usage in Commands:**
```typescript
import { DiscordPlayerService } from "../services/discordPlayer";

// Get the singleton instance
const playerService = DiscordPlayerService.getInstance();

// Check if initialized
if (!playerService.isInitialized()) {
  return interaction.reply("Player not ready!");
}

// Get the queue for the current guild
const queue = playerService.getQueue(interaction.guild!.id);

// Play a song
const result = await playerService.play(voiceChannel, query, textChannel);
```

### 3. Command Interface (interfaces/Command.ts)

Defines the structure for all slash commands:

```typescript
interface Command {
  data: SlashCommandBuilder;       // Discord.js slash command builder
  permissions?: string[];          // Required bot permissions
  cooldown?: number;               // Cooldown in seconds
  execute(...args: any): any;      // Command execution function
}
```

---

## Commands

All commands are slash commands located in the `commands/` directory. Each command file exports a default object that implements the Command interface.

### Command Template

```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("commandname")
    .setDescription(i18n.__("commandname.description")),
  
  cooldown: 3, // Optional: seconds between uses
  
  permissions: [ // Optional: required bot permissions
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
  ],
  
  async execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    // Your command logic here
    
    return interaction.reply("Response");
  }
};
```

### Command Categories

**Playback Control:**
- `/play` - Play a song or add to queue
- `/pause` - Pause playback
- `/resume` - Resume playback
- `/stop` - Stop and clear queue
- `/skip` - Skip current track
- `/skipto` - Jump to position in queue

**Queue Management:**
- `/queue` - View queue
- `/shuffle` - Shuffle queue
- `/remove` - Remove track
- `/move` - Move track position
- `/loop` - Toggle loop mode

**Information:**
- `/nowplaying` - Current track info
- `/lyrics` - Fetch lyrics
- `/search` - Search and select

**Utility:**
- `/volume` - Adjust volume
- `/help` - Show help
- `/ping` - Bot latency
- `/uptime` - Bot uptime
- `/invite` - Get invite link

---

## Configuration

### config.json

```json
{
  "TOKEN": "your-discord-bot-token",
  "MAX_PLAYLIST_SIZE": 10,
  "PRUNING": false,
  "LOCALE": "en",
  "STAY_TIME": 30,
  "DEFAULT_VOLUME": 100
}
```

| Setting | Type | Description |
|---------|------|-------------|
| TOKEN | string | Discord bot token (required) |
| MAX_PLAYLIST_SIZE | number | Max songs to load from a playlist |
| PRUNING | boolean | Delete bot messages after a time |
| LOCALE | string | Default language code |
| STAY_TIME | number | Seconds to stay in VC after queue ends |
| DEFAULT_VOLUME | number | Default volume (0-100) |

### Environment Variables

Configuration can also be set via environment variables:

```bash
TOKEN=your-discord-bot-token
MAX_PLAYLIST_SIZE=10
PRUNING=false
LOCALE=en
STAY_TIME=30
DEFAULT_VOLUME=100
```

### Optional: cookies.txt

For age-restricted YouTube content, place a `cookies.txt` file (Netscape format) in the root directory. The bot will automatically use it if present.

---

## Database & Guild Settings

The bot uses **MongoDB** via **Mongoose** for persistent guild settings. This is **optional** - the bot works without a database, but settings won't persist across restarts.

### Features

- **Per-guild settings**: Each Discord server can customize the bot's behavior
- **DJ Role System**: Restrict music control commands to specific roles
- **Channel Restrictions**: Limit the bot to specific voice/text channels
- **User Blacklist**: Block specific users from using the bot
- **Premium Tiers**: Support for monetization with feature tiers
- **Usage Statistics**: Track songs played and total playtime per guild
- **Caching**: In-memory cache with 5-minute TTL for performance

### Setting Up MongoDB

1. **Install MongoDB** locally or use a cloud provider like [MongoDB Atlas](https://www.mongodb.com/atlas)

2. **Add connection string to config.json**:
```json
{
  "TOKEN": "your-token",
  "MONGODB_URI": "mongodb://localhost:27017/musicbot"
}
```

Or via environment variable:
```bash
MONGODB_URI=mongodb://localhost:27017/musicbot
```

3. **Start the bot** - It will automatically connect and create the necessary collections.

### Guild Settings Schema

The `GuildSettings` model (`models/GuildSettings.ts`) includes:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `guildId` | string | - | Discord guild ID (unique identifier) |
| `djRoleId` | string | null | Role required for DJ commands |
| `adminRoleId` | string | null | Role for managing bot settings |
| `allowedVoiceChannels` | string[] | [] | Restrict to these voice channels (empty = all) |
| `allowedTextChannels` | string[] | [] | Restrict to these text channels (empty = all) |
| `blacklistedUsers` | string[] | [] | Users blocked from using the bot |
| `defaultVolume` | number | 80 | Default playback volume (0-100) |
| `maxVolume` | number | 100 | Maximum allowed volume |
| `maxQueueSize` | number | 100 | Maximum songs in queue |
| `leaveOnEmpty` | boolean | true | Leave voice channel when empty |
| `leaveOnEnd` | boolean | true | Leave after queue ends |
| `leaveOnEmptyDelay` | number | 60000 | Delay before leaving (ms) |
| `language` | string | "en" | Guild's preferred language |
| `embedColor` | string | "#0099ff" | Color for embed messages |
| `totalSongsPlayed` | number | 0 | Usage statistic |
| `totalPlaytime` | number | 0 | Total playback time in seconds |
| `premium.tier` | string | "free" | Premium tier (free/basic/pro/enterprise) |
| `premium.expiresAt` | Date | null | Premium expiration date |

### Using Guild Settings in Commands

```typescript
import { GuildSettingsService } from "../services/guildSettings";

const settingsService = GuildSettingsService.getInstance();

// Get settings for a guild
const settings = await settingsService.getSettings(guildId);

// Check if user has DJ permission
import { hasDJPermission } from "../utils/djPermission";
const canControlMusic = await hasDJPermission(member);

// Check channel restrictions
const canUseChannel = settingsService.isVoiceChannelAllowed(guildId, channelId);
const canUseText = settingsService.isTextChannelAllowed(guildId, channelId);

// Check if user is blacklisted
const isBlocked = settingsService.isUserBlacklisted(guildId, oderId);

// Update settings
await settingsService.updateSettings(guildId, {
  defaultVolume: 75,
  maxVolume: 100
});

// Increment song counter
await settingsService.incrementSongPlayed(guildId);
```

### Admin Commands

The `/settings` command allows server admins to configure the bot:

| Subcommand | Description |
|------------|-------------|
| `/settings view` | View all current settings |
| `/settings djrole set @role` | Set the DJ role |
| `/settings djrole remove` | Remove DJ role (everyone can control) |
| `/settings adminrole set @role` | Set the admin role |
| `/settings volume default 80` | Set default volume |
| `/settings volume max 100` | Set maximum volume |
| `/settings queue max 200` | Set max queue size |
| `/settings voicechannels add #channel` | Restrict to voice channel |
| `/settings voicechannels remove #channel` | Remove channel restriction |
| `/settings voicechannels clear` | Clear all restrictions |
| `/settings textchannels add/remove/clear` | Same for text channels |
| `/settings blacklist add @user` | Block a user |
| `/settings blacklist remove @user` | Unblock a user |
| `/settings language es` | Set guild language |
| `/settings embedcolor #ff0000` | Set embed color |
| `/settings reset` | Reset all settings to defaults |

### Premium Tiers

The bot supports premium tiers for monetization:

| Tier | Features |
|------|----------|
| `free` | Basic playback, 100 song queue |
| `basic` | Larger queue (500), lyrics access |
| `pro` | Unlimited queue, audio filters, priority support |
| `enterprise` | All features, custom branding, API access |

```typescript
// Check premium feature access
const hasAccess = await settingsService.hasPremiumFeature(guildId, "audioFilters");

// Activate premium (bot owner only via /premium activate)
await settingsService.updateSettings(guildId, {
  premium: {
    tier: "pro",
    activatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    activatedBy: ownerId
  }
});
```

### DJ Permission System

The DJ permission system controls who can use music control commands:

**Commands requiring DJ permission:**
- `/skip` - Skip current track
- `/stop` - Stop playback and clear queue
- `/pause` - Pause playback
- `/resume` - Resume playback
- `/shuffle` - Shuffle the queue
- `/remove` - Remove tracks from queue
- `/skipto` - Skip to a specific position
- `/move` - Move tracks in queue
- `/loop` - Toggle loop mode
- `/volume` - Change volume

**Who has DJ permission:**
1. Server administrators (ManageGuild permission)
2. Users with the configured DJ role
3. Everyone (if no DJ role is configured)

```typescript
import { hasDJPermission } from "../utils/djPermission";

// Check permission in command
const hasDJ = await hasDJPermission(member);
if (!hasDJ) {
  return interaction.reply({
    content: "❌ You need the DJ role to use this command.",
    ephemeral: true
  });
}
```

---

## Patreon Integration

The bot includes full Patreon integration for monetization via the **"Founder / Beta Tester"** tier system.

### Overview

- **Automatic Sync**: Patrons are automatically synced from Patreon to the database
- **Real-time Updates**: Webhooks update patron status immediately when pledges change
- **Discord Linking**: Patrons must link their Discord account on Patreon
- **Premium Features**: Unlock exclusive features for patrons

### Setting Up Patreon

1. **Create a Patreon Creator Account**: Go to [patreon.com/create-on-patreon](https://www.patreon.com/create-on-patreon)

2. **Create a Client Application**: Visit [Patreon Developer Portal](https://www.patreon.com/portal/registration/register-clients) and register a new client

3. **Enable Discord Integration**: On your Patreon page, connect the Discord integration and add it as a benefit to your tiers

4. **Add credentials to config.json**:
```json
{
  "PATREON_CLIENT_ID": "your-client-id",
  "PATREON_CLIENT_SECRET": "your-client-secret",
  "PATREON_CREATOR_ACCESS_TOKEN": "your-creator-access-token",
  "PATREON_CAMPAIGN_ID": "your-campaign-id",
  "PATREON_WEBHOOK_SECRET": "your-webhook-secret",
  "PATREON_FOUNDER_TIER_ID": "your-founder-tier-id"
}
```

Or via environment variables:
```bash
PATREON_CLIENT_ID=your-client-id
PATREON_CLIENT_SECRET=your-client-secret
PATREON_CREATOR_ACCESS_TOKEN=your-creator-access-token
PATREON_CAMPAIGN_ID=your-campaign-id
PATREON_WEBHOOK_SECRET=your-webhook-secret
PATREON_FOUNDER_TIER_ID=your-founder-tier-id
```

### Getting Your Patreon IDs

1. **Campaign ID**: Make an API call with your creator token:
   ```bash
   curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     "https://www.patreon.com/api/oauth2/v2/campaigns"
   ```
   The `id` field in the response is your campaign ID.

2. **Tier IDs**: Make an API call to get your tiers:
   ```bash
   curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     "https://www.patreon.com/api/oauth2/v2/campaigns/YOUR_CAMPAIGN_ID?include=tiers&fields[tier]=title,amount_cents"
   ```

### Founder / Beta Tester Tier

The recommended tier structure for launch:

| Tier | Price | Description |
|------|-------|-------------|
| Founder / Beta Tester | $1.50/month | All premium features, exclusive early access |

**Founder Features:**
- Audio Filters (bass boost, nightcore, etc.)
- 24/7 Mode - Bot stays in voice channel
- Maximum Audio Quality
- Priority Queue
- Unlimited Saved Playlists
- No Song Duration Limit
- Vote on New Features
- Exclusive Founder Role
- Direct Support Channel Access

### Using Premium Checks in Commands

```typescript
import { requirePremiumFeature, hasPremiumFeature } from "../utils/premiumCheck";

// Method 1: Block command if no premium (auto-replies with upgrade message)
export async function execute(interaction: ChatInputCommandInteraction) {
  if (!await requirePremiumFeature(interaction, "audio_filters")) {
    return; // Already replied with premium upsell
  }
  // User has premium, continue with command
}

// Method 2: Check silently (for optional premium features)
const isPremium = await hasPremiumFeature(interaction.user.id, "stay_24_7");
if (isPremium) {
  // Enable 24/7 mode
}
```

### Available Premium Features

| Feature Key | Description |
|-------------|-------------|
| `audio_filters` | Audio filters (bass boost, nightcore, etc.) |
| `stay_24_7` | 24/7 mode - bot stays in channel |
| `max_quality` | Maximum audio quality |
| `priority_queue` | Priority in queue |
| `unlimited_playlists` | Unlimited saved playlists |
| `longer_songs` | No song duration limit |
| `vote_features` | Vote on new features |
| `founder_role` | Exclusive Founder role |
| `direct_support` | Direct support channel access |

### Setting Up Webhooks

1. **Create a webhook endpoint** on your server (e.g., `https://your-domain.com/patreon/webhook`)

2. **Register the webhook** on Patreon Developer Portal:
   - Go to your client settings
   - Add the webhook URL
   - Select triggers: `members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`, `members:pledge:delete`

3. **Handle webhooks** in your Express server:
```typescript
import express from "express";
import { PatreonService } from "./services/patreon";

const app = express();

app.post("/patreon/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-patreon-signature"] as string;
  const event = req.headers["x-patreon-event"] as string;
  const body = req.body.toString();

  const patreonService = PatreonService.getInstance();

  // Verify signature
  if (!patreonService.verifyWebhookSignature(body, signature)) {
    return res.status(401).send("Invalid signature");
  }

  // Process webhook
  const result = await patreonService.handleWebhook(event, JSON.parse(body));
  res.json(result);
});
```

### PatreonUser Model

The `PatreonUser` model (`models/PatreonUser.ts`) stores patron data:

| Field | Type | Description |
|-------|------|-------------|
| `discordId` | string | Discord user ID (unique) |
| `patreonId` | string | Patreon user ID |
| `email` | string | Patron's email |
| `fullName` | string | Patron's name |
| `tierId` | string | Current tier ID |
| `tierTitle` | string | Current tier name |
| `patronStatus` | enum | `active_patron`, `declined_patron`, `former_patron`, `not_patron` |
| `pledgeAmountCents` | number | Current pledge amount in cents |
| `lifetimeSupportCents` | number | Total lifetime support |
| `isPremium` | boolean | Has active premium access |
| `isFounder` | boolean | Is Founder tier patron |

### Manual Sync

The bot automatically syncs patrons:
- On startup
- Every 30 minutes

You can trigger a manual sync via the Patreon service:
```typescript
const patreonService = PatreonService.getInstance();
const syncedCount = await patreonService.syncAllPatrons();
console.log(`Synced ${syncedCount} patrons`);
```

---

## Localization

The bot supports 28 languages via the `locales/` directory.

### Supported Languages

ar, bg, cs, de, el, en, es, fa, fr, id, it, ja, ko, mi, nb, nl, pl, pt_br, ro, ru, sv, th, tr, uk, vi, zh_cn, zh_sg, zh_tw

### Using i18n in Commands

```typescript
import { i18n } from "../utils/i18n";

// Simple string
const message = i18n.__("play.description");

// With parameters
const message = i18n.__mf("play.queueAdded", { title: track.title });
```

### Adding New Strings

1. Add the string to `locales/en.json`:
```json
{
  "mycommand": {
    "description": "My command description",
    "success": "Operation completed for {{item}}"
  }
}
```

2. Use in code:
```typescript
i18n.__("mycommand.description")
i18n.__mf("mycommand.success", { item: "example" })
```

---

## Adding New Features

### Adding a New Command

1. Create a new file in `commands/`:

```typescript
// commands/mycommand.ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("mycommand")
    .setDescription("My new command"),
  
  async execute(interaction: ChatInputCommandInteraction) {
    return interaction.reply("Hello!");
  }
};
```

2. Add localization strings to `locales/en.json`

3. Restart the bot - commands are auto-registered!

### Adding a New Extractor

To add support for a new music source:

1. Install the extractor package
2. Register in `services/discordPlayer.ts`:

```typescript
import { NewExtractor } from "new-extractor-package";

// In initialize() method:
await this.player.extractors.register(NewExtractor, {
  // options
});
```

### Adding Utility Functions

Add shared utility functions to `utils/`:

```typescript
// utils/myutil.ts
export function myUtilFunction(param: string): string {
  return param.toUpperCase();
}
```

---

## External Dependencies

### Required System Dependencies

| Dependency | Purpose | Installation |
|------------|---------|--------------|
| Node.js | Runtime | https://nodejs.org (v16.11+) |
| FFmpeg | Audio transcoding | `npm install ffmpeg-static` (bundled) |
| yt-dlp | YouTube streaming | https://github.com/yt-dlp/yt-dlp |

### Installing yt-dlp

**Windows:**
```bash
winget install yt-dlp
# or download from GitHub releases
```

**Linux/Mac:**
```bash
pip install yt-dlp
# or
brew install yt-dlp
```

### Key NPM Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| discord.js | ^14.15.3 | Discord API |
| discord-player | ^7.1.0 | Music queue/playback |
| discord-player-youtubei | ^1.5.0 | YouTube extractor |
| @discord-player/extractor | ^7.1.0 | SoundCloud, Spotify, Attachments |
| @discordjs/voice | ^0.17.0 | Voice connections |
| ffmpeg-static | ^4.4.1 | FFmpeg binary |

---

## Development Workflow

### Prerequisites

1. Node.js 16.11 or higher
2. yt-dlp installed and in PATH
3. Discord bot token

### Setup

```bash
# Clone the repository
git clone https://github.com/eduair94/music-bot.git
cd music-bot

# Install dependencies
npm install

# Copy config template
cp config.json.example config.json

# Edit config.json with your bot token
```

### Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Run tests
npm run test:search

# Format code
npm run format

# Type check
npx tsc --noEmit
```

### Production

```bash
# Build TypeScript
npm run build

# Run production build
npm run prod

# Or run directly with ts-node
npm start
```

### Docker

```bash
docker build -t music-bot .
docker run -d music-bot
```

---

## Troubleshooting

### Common Issues

#### "No extractors registered"

The bot couldn't initialize the music extractors. Check:
- Node.js version >= 16.11
- All npm packages installed correctly
- Restart the bot

#### "yt-dlp: command not found"

yt-dlp is not installed or not in PATH:
```bash
# Check if installed
yt-dlp --version

# Install if missing
pip install yt-dlp
```

#### "Requested format is not available"

yt-dlp format issue. The bot uses format `251/250/249/140/139/ba/b` which should work for most videos. Check:
- yt-dlp is up to date: `yt-dlp -U`
- Video is available in your region
- Try a different video

#### Songs end instantly

Check console for yt-dlp errors:
- Missing JavaScript runtime: Install Node.js or Deno
- Check yt-dlp is working: `yt-dlp -f 251 "video-url" -o -`

#### "Player not initialized"

The DiscordPlayerService hasn't finished initializing. Wait a few seconds after bot startup.

### Debug Mode

Enable debug logging by watching the console output. The bot logs:
- `[DiscordPlayer]` - Player events and errors
- `[play]` - Play command execution
- Extractor registration status

### Useful Debug Commands

```bash
# Test yt-dlp directly
yt-dlp -f "251/250/249/140/139/ba/b" "https://youtube.com/watch?v=VIDEO_ID" -o -

# Check format availability
yt-dlp -F "https://youtube.com/watch?v=VIDEO_ID"
```

---

## Code Patterns

### Getting the Queue

Always use the service singleton:

```typescript
const playerService = DiscordPlayerService.getInstance();
const queue = playerService.getQueue(interaction.guild!.id);

if (!queue || !queue.currentTrack) {
  return interaction.reply("No music playing!");
}
```

### Safe Reply Pattern

Use the safeReply utility for interactions:

```typescript
import { safeReply } from "../utils/safeReply";

await safeReply(interaction, "Message here");
```

### Error Handling

Always catch errors in commands:

```typescript
try {
  await playerService.play(voiceChannel, query, textChannel);
} catch (error) {
  console.error("Play error:", error);
  return interaction.editReply("❌ Failed to play the track");
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run type check: `npx tsc --noEmit`
5. Format code: `npm run format`
6. Commit with conventional commits
7. Push and create a Pull Request

---

## License

MIT License - See [LICENSE](LICENSE) for details.
