# Shared Types

This directory contains TypeScript types and interfaces shared between the music bot, dashboard, and worker processes.

## Structure

```
shared/
└── types/
    └── index.ts    # All shared type definitions
```

## Usage

### In the Bot

```typescript
import type { IGuildSettings, IPlaybackState, ITrack } from "../shared/types";
import { PREMIUM_TIERS, getTierFromPledge } from "../shared/types";
```

### In the Dashboard

```typescript
import type { IGuildSettings, IPlaybackState } from "../../../../shared/types";
import { PREMIUM_TIERS, getMaxLinkedBots } from "../../../../shared/types";
```

## Types Included

### Premium Tiers
- `PremiumTier` - Tier levels: "free" | "basic" | "pro" | "enterprise"
- `PremiumTierConfig` - Full tier configuration
- `PREMIUM_TIERS` - Configuration object with all tier limits

### Guild Settings
- `IGuildSettings` - Full guild settings interface
- `GuildPremiumSettings` - Premium features for a guild

### Playback State
- `ITrack` - Track/song information
- `IPlaybackState` - Current playback state for a guild
- `TrackSource` - Source platforms
- `LoopMode` - Loop options

### Bot Commands
- `IBotCommand` - Command sent from dashboard to bot
- `BotCommandType` - Available command types
- `BotCommandParams` - Command parameters
- `CommandStatus` - Command execution status

### Linked Bots
- `ILinkedBot` - User-linked bot information
- `LinkedBotStatus` - Bot status types

### Patreon Integration
- `IPatreonUser` - Patreon user data
- `PatronStatus` - Patron status types

### Discord API Types
- `DiscordGuild` - Guild information
- `GuildWithBot` - Guild with bot presence
- `DiscordChannel` - Channel information
- `DiscordRole` - Role information

### Utility Types
- `ApiResponse<T>` - Standard API response wrapper
- `PaginationParams` - Pagination parameters
- `PaginatedResponse<T>` - Paginated data response

### Helper Functions
- `getTierFromPledge(cents)` - Get tier from pledge amount
- `getMaxLinkedBots(cents)` - Get max linked bots for pledge
- `getAudioBitrate(tier)` - Get bitrate for tier
- `formatDuration(ms)` - Format duration to string
- `isValidSnowflake(id)` - Validate Discord snowflake ID

## Why Shared Types?

1. **Single Source of Truth** - Types are defined once and used everywhere
2. **Type Safety** - Consistent types across bot, dashboard, and workers
3. **Easy Maintenance** - Update in one place, propagates everywhere
4. **Documentation** - JSDoc comments in shared types serve as documentation
