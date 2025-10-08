# 🚀 EvoBot Updates & Roadmap

## 🗄️ Storage Architecture

**All persistent storage features will use:**
- **MongoDB** - Primary database for structured data (playlists, user stats, history, configurations)
- **Redis** - Caching layer for temporary data (search results, session data, rate limiting)

**Configuration:**
- Connection URIs provided via `.env` file:
  ```env
  MONGODB_URI=mongodb://localhost:27017/evobot
  REDIS_URI=redis://localhost:6379
  ```
- All database operations will be abstracted through service layers
- Automatic fallback to in-memory storage if database unavailable (development mode)

---

## 🎯 High Priority Features

### Music Source Expansion

#### **Current Status**
- [x] **YouTube Support** (Fully Implemented)
  - Video links with yt-dlp integration
  - Playlist support
  - Search functionality
  - Music.youtube.com support
  - Android client bypass for restrictions

#### **Phase 1: Priority Integrations** 🎯

- [ ] **SoundCloud Enhancement** ⭐ HIGH PRIORITY
  - [x] Basic regex support exists in patterns.ts
  - [ ] Full track download implementation
  - [ ] Playlist support (`soundcloud:playlist`)
  - [ ] User uploads support (`soundcloud:user`)
  - [ ] Search functionality (`soundcloud:search`)
  - [ ] Format selection (HLS vs HTTP, opus vs aac vs mp3)
  - [ ] Related tracks (`soundcloud:related`)
  - **Capabilities**: 1.8B+ tracks, high-quality streaming
  - **Use Case**: DJ mixes, remixes, independent artists

- [ ] **Bandcamp Integration** ⭐ HIGH PRIORITY
  - [ ] Track downloads
  - [ ] Album support (`bandcamp:album`)
  - [ ] Artist/user pages (`bandcamp:user`)
  - [ ] Weekly features (`bandcamp:weekly`)
  - [ ] High-quality FLAC option support
  - [ ] Purchase-required content detection
  - **Capabilities**: Lossless audio available, artist-direct platform
  - **Use Case**: Independent music, album purchases, high-quality audio

- [ ] **Spotify Integration** ⭐ HIGH PRIORITY
  - [ ] Spotify API integration for metadata
  - [ ] YouTube search bridge (Spotify → YouTube)
  - [ ] Track link support
  - [ ] Playlist link support (`spotify:playlist`)
  - [ ] Album link support (`spotify:album`)
  - [ ] Artist top tracks
  - [ ] Metadata preservation (album art, artist info, release date)
  - [ ] Smart matching algorithm
  - **Note**: Spotify uses DRM - we extract metadata and find on YouTube
  - **Use Case**: Playlist imports, metadata-rich experience

#### **Phase 2: Extended Platforms** 🌐

- [ ] **Audiomack Support**
  - [ ] Track downloads
  - [ ] Album support
  - [ ] Playlist support
  - [ ] Trending/charts support
  - **Use Case**: Hip-hop, R&B, Afrobeats

- [ ] **Mixcloud Support**
  - [ ] Mix/set downloads
  - [ ] Playlist support
  - [ ] User uploads
  - [ ] Live stream support
  - **Use Case**: DJ mixes, radio shows, podcasts

- [ ] **Vimeo Music Videos**
  - [ ] Video links with audio extraction
  - [ ] Album/channel support
  - [ ] High-quality audio extraction
  - **Use Case**: Music videos, live performances

- [ ] **Apple Music Bridge** (Metadata Only)
  - [ ] Metadata extraction
  - [ ] YouTube search bridge
  - [ ] Playlist conversion
  - **Note**: Similar to Spotify - metadata only, download from YouTube

- [ ] **Deezer Integration** (Limited)
  - [ ] Metadata extraction
  - [ ] Preview clips (30s samples)
  - **Note**: Full tracks are DRM-protected

#### **Phase 3: Social & Emerging** 📱

- [ ] **TikTok Audio**
  - [ ] Sound/audio extraction
  - [ ] Trending sounds support
  - [ ] Original sound vs music detection
  - **Use Case**: Viral music discovery

- [ ] **Twitch Music Streams**
  - [ ] Live stream audio extraction
  - [ ] VOD audio extraction
  - [ ] Clip support
  - **Use Case**: Live DJ sets, music streams

#### **Phase 4: International Platforms** 🌏

- [ ] **NetEase Music** (网易云音乐) - China
  - [ ] Track support (`netease:song`)
  - [ ] Album support (`netease:album`)
  - [ ] Playlist support (`netease:playlist`)
  - [ ] Artist support (`netease:singer`)

- [ ] **QQ Music** (QQ音乐) - China
  - [ ] Track support (`qqmusic`)
  - [ ] Album support (`qqmusic:album`)
  - [ ] Playlist support (`qqmusic:playlist`)
  - [ ] Toplist support (`qqmusic:toplist`)

- [ ] **Bilibili** - China/Japan
  - [ ] Video audio extraction
  - [ ] Music section support
  - [ ] Bangumi (anime) music

- [ ] **Niconico** - Japan
  - [ ] Track support (`niconico`)
  - [ ] Playlist support
  - [ ] Tag-based search

#### **Phase 5: Niche & Special** 🎸

- [ ] **Jamendo** (Free Music)
  - [ ] Track downloads
  - [ ] Album support
  - [ ] License-friendly content

- [ ] **Hearthis.at**
  - [ ] Track support
  - [ ] User uploads
  - **Use Case**: Electronic music, DJ sets

- [ ] **Clyp**
  - [ ] Audio clip support
  - **Use Case**: Quick audio sharing

- [ ] **ReverbNation**
  - [ ] Artist tracks
  - [ ] Album support
  - **Use Case**: Independent artists

- [ ] **Newgrounds**
  - [ ] Audio portal support
  - [ ] User tracks
  - **Use Case**: Game music, independent creators

#### **Phase 6: Radio & Podcasts** 📻

- [ ] **Radio Platforms**
  - [ ] Mixlr (live radio)
  - [ ] RadioFrance
  - [ ] BBC iPlayer Radio
  - [ ] NPR

- [ ] **Podcast Platforms**
  - [ ] Apple Podcasts
  - [ ] Spotify Podcasts (via bridge)
  - [ ] Generic RSS feeds

#### **Technical Implementation Notes**

**Multi-Platform Detection System:**
```typescript
// Platform detection with priority order
const platformPriority = [
  'youtube',      // Primary (already implemented)
  'soundcloud',   // Phase 1
  'bandcamp',     // Phase 1
  'spotify',      // Phase 1 (bridge)
  'audiomack',    // Phase 2
  'mixcloud',     // Phase 2
  // ... etc
];
```

**YT-DLP Integration:**
- Over 1,800 sites supported by yt-dlp
- Extractor-specific arguments available
- Format selection per platform
- Automatic fallback mechanisms

**Quality Tiers by Platform:**
- **Lossless**: Bandcamp FLAC, Deezer HiFi (if available)
- **High**: SoundCloud HQ, YouTube Music Premium
- **Standard**: Most platforms default
- **Low**: Mobile/data-saver modes

**Important Considerations:**
- DRM Protection: Spotify, Tidal, Apple Music, Deezer (most content)
- Rate Limiting: Per-platform limits to avoid bans
- Geographic Restrictions: Some content region-locked
- Legal Compliance: Respect platform ToS and copyright
- Metadata Preservation: Rich info from each platform

### Enhanced Loop Functionality
- [ ] **Single Song Loop** (`/loopsong`)
  - Loop only the current song indefinitely
  - Different from queue loop
  - Toggle on/off with visual indicator

- [ ] **Loop Count** (`/loop [count]`)
  - Loop queue/song for specific number of times
  - Auto-disable after reaching count

- [ ] **Loop Range** (`/looprange [start] [end]`)
  - Loop specific section of queue
  - Useful for DJ-style playlists

### Queue Management Enhancements
- [ ] **Queue Save/Load** (`/savequeue`, `/loadqueue`)
  - Save current queue with a custom name
  - Load previously saved queues
  - Share queues between servers (optional)
  - **Store in MongoDB** with queue schema

- [ ] **Queue Export** (`/exportqueue`)
  - Export queue as text file
  - Export as Spotify/YouTube playlist
  - Share queue link

- [ ] **Smart Queue** (`/smartqueue`)
  - Add similar songs based on current queue
  - Integration with Spotify recommendations
  - YouTube related videos

- [ ] **Queue Filters** (`/filter [nightcore/bass/8d]`)
  - Apply audio filters to playback
  - Nightcore, bassboost, 8D audio effects
  - Speed control, pitch control

### Advanced Playback Features
- [ ] **Seek Command** (`/seek [timestamp]`)
  - Jump to specific time in current song
  - Format: MM:SS or seconds

- [ ] **Rewind/Fast Forward** (`/rewind [seconds]`, `/forward [seconds]`)
  - Skip backward/forward by specified seconds
  - Button controls for ±10s, ±30s

- [ ] **Replay Current Song** (`/replay`)
  - Restart the currently playing song from beginning

- [ ] **Autoplay** (`/autoplay`)
  - Automatically add similar songs when queue ends
  - YouTube related videos or Spotify radio

- [ ] **Crossfade** (`/crossfade [seconds]`)
  - Smooth transition between songs
  - Configurable fade duration

## 📊 Statistics & Analytics

### User Statistics
- [ ] **Personal Stats** (`/mystats`)
  - Total songs played
  - Most played songs
  - Most played artists
  - Total listening time
  - Favorite genres
  - **Stored in MongoDB** - user statistics collection

- [ ] **Server Stats** (`/serverstats`)
  - Most active users
  - Most played songs globally
  - Peak usage times
  - Total server listening time
  - **Stored in MongoDB** - server statistics collection

- [ ] **Leaderboard** (`/leaderboard`)
  - Top song requesters
  - Most active music listeners
  - Weekly/monthly/all-time rankings

### Playback History
- [ ] **History Command** (`/history`)
  - Show recently played songs
  - Per-user history
  - Server-wide history
  - Paginated display
  - **Stored in MongoDB** - playback history collection

- [ ] **Replay from History** (`/replayfrom history`)
  - Quickly replay songs from history
  - Interactive selection menu

## 🎨 User Experience Improvements

### Interactive Controls
- [ ] **Enhanced Button Controls**
  - Add song info button (shows details)
  - Add lyrics button
  - Add favorite/like button
  - Add share button

- [ ] **Voice Channel Activity**
  - Display "Listening to [Song]" status
  - Show current song in voice channel status
  - Update bot activity with current track

### Visual Enhancements
- [ ] **Rich Embeds**
  - Better formatted now playing embeds
  - Animated progress bars
  - Album artwork thumbnails
  - Color coding by mood/genre

- [ ] **Queue Visualization**
  - Show estimated wait time for each song
  - Visual indicators for looped songs
  - User avatars next to their requested songs

### Notifications
- [ ] **DM Notifications** (`/notify`)
  - Notify user when their song starts
  - Configurable notification preferences
  - Option for queue position updates

- [ ] **Announcement Channel** (`/setannounce`)
  - Dedicated channel for now playing updates
  - Customizable announcement format

## 🎵 Playlist Features

### Collaborative Playlists
- [ ] **Server Playlists** (`/serverplaylist`)
  - Create server-wide playlists
  - Multiple users can add songs
  - Voting system for song additions
  - Playlist moderation
  - **Stored in MongoDB** - collaborative playlists collection

- [ ] **Favorite Songs** (`/favorite`, `/favorites`)
  - Users can favorite songs
  - Quick access to favorite list
  - Auto-playlist from favorites
  - **Stored in MongoDB** - user favorites

- [ ] **Import/Export**
  - Import Spotify playlists directly
  - Import YouTube playlists
  - Export to various formats

## 🔧 Technical Improvements

### Performance & Stability
- [ ] **Better Error Handling**
  - More descriptive error messages
  - Auto-retry on network failures
  - Fallback sources if primary fails

- [ ] **Caching System**
  - Cache song metadata **(Redis)**
  - Cache search results **(Redis - 1 hour TTL)**
  - Reduce API calls
  - Cache popular queries **(Redis)**

- [ ] **Multi-Server Improvements**
  - Better queue isolation
  - Memory optimization for multiple servers
  - Connection pooling

### Audio Quality
- [ ] **Quality Selection** (`/quality [low/medium/high]`)
  - Let users choose audio quality
  - Balance between quality and bandwidth
  - Automatic quality based on connection

- [ ] **Equalizer** (`/eq [preset]`)
  - Built-in EQ presets (Rock, Pop, Jazz, etc.)
  - Custom EQ settings
  - Save personal EQ preferences

### Database Integration
- [x] **Database Architecture Defined**
  - **MongoDB** for persistent storage
  - **Redis** for caching and session management
  - Configuration via `.env` file
  - Connection URIs: `MONGODB_URI` and `REDIS_URI`
  
- [ ] **MongoDB Collections**
  - `users` - User profiles and preferences
  - `guilds` - Server configurations
  - `playlists` - Saved queues and playlists
  - `history` - Playback history with timestamps
  - `statistics` - Aggregated stats and analytics
  - `favorites` - User favorite songs

- [ ] **Redis Keys Structure**
  - `cache:search:{query}` - Search results (1h TTL)
  - `cache:song:{id}` - Song metadata (24h TTL)
  - `session:{userId}` - Active sessions (30min TTL)
  - `ratelimit:{userId}:{command}` - Rate limiting counters
  - `nowplaying:{guildId}` - Current playback state (no TTL)

## 🎮 Fun & Social Features

### Music Games
- [ ] **Song Quiz** (`/quiz`)
  - Guess the song from audio clips
  - Leaderboard for quiz scores
  - Custom quiz categories

- [ ] **Lyrics Game** (`/lyricsgame`)
  - Complete the lyrics challenge
  - Team-based gameplay

### Social Features
- [ ] **Music Sharing** (`/share [user]`)
  - Share current song with friends
  - Song recommendations
  - Social feed of what friends are listening to

- [ ] **Duets/Karaoke** (`/karaoke`)
  - Play instrumental versions
  - Display lyrics in real-time
  - Recording feature (optional)

## 🛡️ Moderation & Control

### Advanced Permissions
- [ ] **DJ Role** (`/setdjrole`)
  - Specific role with extended music controls
  - Skip vote exemption
  - Queue manipulation permissions
  - **Config stored in MongoDB** - guild settings

- [ ] **Blacklist/Whitelist** (`/blacklist`, `/whitelist`)
  - Block specific songs/artists
  - Block explicit content
  - Server-specific restrictions
  - **Lists stored in MongoDB** - guild configurations

### Limits & Restrictions
- [ ] **Per-User Limits** (`/userlimit`)
  - Max songs per user in queue
  - Cooldown between requests
  - Daily request limits
  - **Tracked via Redis** for real-time enforcement

- [ ] **Time Restrictions** (`/timelock`)
  - Schedule bot availability
  - Auto-disconnect at certain times
  - Quiet hours mode

## 🌐 Integration & API

### Web Dashboard
- [ ] **Web Interface**
  - Control bot from web browser
  - View queue and stats online
  - Remote control from mobile
  - OAuth login with Discord

### Voice Recognition
- [ ] **Voice Commands**
  - "Hey Bot, play [song]"
  - Voice-activated controls
  - Language support for commands

### Webhooks & Events
- [ ] **Webhook Integration**
  - Send now playing to Discord webhooks
  - Integration with other bots
  - Custom event triggers

## 📱 Mobile & Accessibility

### Mobile Optimization
- [ ] **Mobile-Friendly Commands**
  - Shorter command aliases
  - Touch-optimized button layouts
  - Quick action menus

### Accessibility
- [ ] **Screen Reader Support**
  - Better embed descriptions
  - Alternative text for images
  - Keyboard navigation hints

- [ ] **Language Support**
  - More locale translations
  - Auto-detect user language preference
  - Mixed-language queue support

## 🔐 Privacy & Security

### Data Protection
- [ ] **GDPR Compliance**
  - User data export
  - Right to deletion
  - Transparent data usage

- [ ] **Privacy Settings** (`/privacy`)
  - Hide listening history
  - Anonymous statistics
  - Opt-out options

### Security
- [ ] **Rate Limiting**
  - Prevent spam/abuse
  - DDoS protection
  - Command cooldowns enhancement
  - **Implemented with Redis** - sliding window counters

## 🎓 Educational Features

### Music Discovery
- [ ] **Song Info** (`/songinfo`)
  - Detailed song metadata
  - Artist biography
  - Album information
  - Release date, genre tags

- [ ] **Similar Songs** (`/similar`)
  - Find similar songs
  - Artist radio
  - Genre exploration

### Learning
- [ ] **Music Theory** (`/theory [song]`)
  - Show song key, BPM, time signature
  - Chord progressions
  - Musical analysis

## 🚀 Performance Metrics

### Monitoring
- [ ] **Health Check** (`/health`)
  - Bot performance metrics
  - Memory usage
  - Active connections
  - Queue processing speed

- [ ] **Admin Dashboard**
  - Real-time bot statistics
  - Error logging
  - Performance graphs
  - User activity tracking

## 🔄 Migration & Upgrades

### Backward Compatibility
- [ ] **Config Migration**
  - Auto-upgrade old config files
  - Preserve user settings
  - Smooth update process

### Documentation
- [ ] **Better Documentation**
  - Interactive command guide
  - Video tutorials
  - FAQ section
  - Troubleshooting guide

## 📦 Distribution Improvements

### Deployment
- [ ] **One-Click Deploy**
  - Heroku button
  - Railway.app template
  - Replit template enhancement

- [ ] **Cloud Service Integration**
  - AWS Lambda support
  - Google Cloud Functions
  - Azure Functions

### Monetization (Optional)
- [ ] **Premium Features**
  - Extended queue size for supporters
  - High-quality audio
  - Priority support
  - Custom bot name/avatar per server

## 🎯 Quick Wins (Easy Implementations)

1. **Auto-Pause** - Pause when everyone leaves voice channel
2. **Timestamp Links** - Share song with timestamp
3. **Volume Memory** - Remember last volume setting per server
4. **Quick Search Results** - Show top 3 results with numbered reactions
5. **Shuffle on Add** - Option to shuffle when adding multiple songs
6. **Clear Queue** - Command to clear entire queue at once
7. **Song Position** - Show current position of songs in queue
8. **Duplicate Detection** - Warn when adding duplicate songs
9. **Connection Status** - Show connection quality/ping to voice server
10. **Command Aliases** - Shorter versions of popular commands (p, s, q, etc.)

## 📋 Priority Matrix

### Must Have (Q1)
- Spotify integration
- Single song loop
- Queue save/load
- User statistics

### Should Have (Q2)
- Seek command
- History feature
- DJ role system
- Enhanced error handling

### Nice to Have (Q3)
- Music quiz games
- Web dashboard
- Advanced filters
- Collaborative playlists

### Future Ideas (Q4+)
- Voice commands
- AI recommendations
- Music theory features
- Mobile app

---

## 🏁 Implementation Notes

**Current Tech Stack:**
- Discord.js v14
- TypeScript
- yt-dlp for YouTube
- Voice connections via @discordjs/voice

**Required Additions:**
- **MongoDB** - Primary database (`mongodb` npm package)
  - URI configured via `MONGODB_URI` in `.env`
  - Mongoose for schema modeling
- **Redis** - Caching layer (`ioredis` npm package)
  - URI configured via `REDIS_URI` in `.env`
  - Used for rate limiting, sessions, and caching
- Spotify API SDK
- Express.js for web dashboard
- Socket.io for real-time updates

**Environment Variables Required:**
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/evobot
REDIS_URI=redis://localhost:6379

# Existing variables
TOKEN=your_discord_bot_token
# ... other existing variables
```

**Database Services Architecture:**
```
src/
├── services/
│   ├── database/
│   │   ├── mongodb.service.ts    # MongoDB connection & operations
│   │   ├── redis.service.ts      # Redis connection & caching
│   │   ├── models/               # MongoDB schemas
│   │   └── repositories/         # Data access layer
│   └── cache/
│       └── cache.service.ts      # Unified caching interface
```

---

*This roadmap is a living document and should be updated as features are completed or priorities change.*