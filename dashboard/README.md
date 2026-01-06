# Music Bot Dashboard

A modern, clean web dashboard for managing your Discord music bot. Built with Next.js 15, Material UI 6, Auth.js v5, and Tailwind CSS.

## Features

- **Marketing Landing Page**: Beautiful landing page with features, pricing, and FAQ
- **Discord OAuth Login**: Secure authentication via Discord
- **Server Management**: View all servers where you have management permissions
- **Bot Configuration**: Configure bot settings per server
  - Voice & text channel restrictions
  - DJ and admin role settings
  - Volume limits and defaults
  - Queue settings
  - Auto-leave behavior
  - Language settings
  - Embed color customization
- **User Profile**: View your account information
- **Premium Tiers**: Subscribe to premium features via Patreon
- **Help Center**: Complete command documentation and FAQ
- **Patreon Webhooks**: Handles Patreon membership updates via API routes
- **Music Player Controls**: Full player interface with:
  - Play, pause, skip, stop, volume controls
  - Queue management (view, remove, move, clear)
  - Seek, shuffle, loop controls
- **Collections System**: Save and manage track collections
  - Create, edit, delete collections
  - Add/remove tracks from collections
  - Load collections into the queue
  - Save current queue to a collection
  - Public/private collections with share codes
- **Advanced Commands Panel**: Execute all bot commands from the dashboard
  - Audio settings (bass boost, nightcore, speed, bitrate)
  - Playback controls (forward, rewind, wind, replay, previous, loop, repeat)
  - Session controls (join, leave, autoplay)
  - Info commands (now playing, lyrics, history, recently played)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: Material UI 6 (Dashboard), Tailwind CSS v4 (Landing)
- **Authentication**: Auth.js v5 (NextAuth) with Discord provider
- **Database**: MongoDB with Mongoose
- **Styling**: Emotion (MUI) + Tailwind (Landing)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MongoDB database (same one used by the bot)
- Discord application with OAuth2 configured

### Installation

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file from the example:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables:
   ```env
   # Auth.js
   AUTH_SECRET=your-auth-secret-generate-with-openssl-rand-base64-32

   # Discord OAuth
   AUTH_DISCORD_ID=your-discord-client-id
   AUTH_DISCORD_SECRET=your-discord-client-secret

   # MongoDB (same as the bot uses)
   MONGODB_URI=mongodb://localhost:27017/music-bot

   # Bot Token (for fetching guild info)
   DISCORD_BOT_TOKEN=your-bot-token

   # URLs
   NEXT_PUBLIC_APP_URL=http://localhost:3001
   ```

5. Configure Discord OAuth2:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Go to OAuth2 settings
   - Add redirect URL: `http://localhost:3001/api/auth/callback/discord`
   - For production, add your production URL

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3001](http://localhost:3001)

## Project Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── (landing)/               # Marketing pages (Tailwind CSS)
│   │   │   ├── layout.tsx           # Landing layout
│   │   │   ├── page.tsx             # Home page (/)
│   │   │   └── invite/
│   │   │       └── page.tsx         # Bot invite redirect
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx         # Login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # Dashboard layout with sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx         # Main dashboard
│   │   │   ├── servers/
│   │   │   │   ├── page.tsx         # Server list
│   │   │   │   └── [guildId]/
│   │   │   │       ├── settings/
│   │   │   │       │   └── page.tsx # Server settings
│   │   │   │       └── player/
│   │   │   │           └── page.tsx # Music player
│   │   │   ├── profile/
│   │   │   │   └── page.tsx         # User profile
│   │   │   ├── premium/
│   │   │   │   └── page.tsx         # Premium tiers
│   │   │   └── help/
│   │   │       └── page.tsx         # Help & docs
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/   # Auth.js API routes
│   │   │   ├── webhooks/
│   │   │   │   └── patreon/         # Patreon webhook handler
│   │   │   ├── health/              # Health check endpoint
│   │   │   ├── guilds/
│   │   │   │   └── [guildId]/       # Guild settings & commands API
│   │   │   └── user/
│   │   │       └── bots/            # Linked bots API
│   │   ├── layout.tsx               # Root layout with providers
│   │   └── globals.css              # Tailwind + custom styles
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginButton.tsx      # Discord login button
│   │   │   └── SessionProvider.tsx  # NextAuth session provider
│   │   ├── landing/                 # Landing page components (Tailwind)
│   │   │   ├── Header.tsx           # Navigation header
│   │   │   ├── Hero.tsx             # Hero section
│   │   │   ├── Features.tsx         # Features grid
│   │   │   ├── Comparison.tsx       # Comparison table
│   │   │   ├── Pricing.tsx          # Pricing cards
│   │   │   ├── Commands.tsx         # Commands showcase
│   │   │   ├── FAQ.tsx              # FAQ accordion
│   │   │   └── Footer.tsx           # Site footer
│   │   └── dashboard/               # Dashboard components (MUI)
│   │       ├── Sidebar.tsx          # Navigation sidebar
│   │       ├── Header.tsx           # Dashboard header
│   │       └── ServerSettingsForm.tsx # Settings form
│   ├── lib/
│   │   ├── discord.ts               # Discord API utilities
│   │   ├── mongodb.ts               # MongoDB connection
│   │   ├── patreon.ts               # Patreon webhook handling
│   │   └── models/                  # Mongoose models
│   ├── theme/
│   │   └── theme.ts                 # MUI theme configuration
│   ├── types/
│   │   ├── discord.ts               # Discord types
│   │   └── next-auth.d.ts           # Auth.js type extensions
│   ├── auth.ts                      # Auth.js configuration
│   └── middleware.ts                # Auth middleware
├── public/                          # Static assets
├── postcss.config.mjs               # Tailwind PostCSS config
├── package.json
├── tsconfig.json
└── .env.example
```

## Available Scripts

- `npm run dev` - Start development server on port 3001
- `npm run build` - Build for production
- `npm run start` - Start production server on port 3001
- `npm run lint` - Run ESLint

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Secret for encrypting session tokens |
| `AUTH_DISCORD_ID` | Discord OAuth application client ID |
| `AUTH_DISCORD_SECRET` | Discord OAuth application client secret |
| `MONGODB_URI` | MongoDB connection string |
| `DISCORD_BOT_TOKEN` | Bot token for API calls |
| `NEXT_PUBLIC_APP_URL` | Base URL of the dashboard |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### PM2

```bash
npm run build
pm2 start npm --name "dashboard" -- start
```

## Security

- All routes under `/dashboard` are protected by middleware
- Discord OAuth with `guilds` scope for server access
- Server management permissions checked before allowing settings changes
- Bot token used server-side only

## License

MIT - Same as the main bot project
