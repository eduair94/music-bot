# Bypass Bot - Website & Dashboard Setup Guide

This guide explains how to set up and customize the promotional landing page and dashboard for the Bypass Discord Music Bot.

## Overview

The bot includes a unified web application that combines:
- **Landing Page** - Modern promotional website with marketing content
- **Dashboard** - Server management, bot configuration, and premium features
- **API Routes** - REST endpoints for webhooks, settings, and playback control

All components are served by a single Next.js application on port 3001.

## Architecture

```
music-bot/
├── dashboard/                      # Next.js unified application
│   └── src/
│       ├── app/
│       │   ├── (landing)/         # Marketing pages (Tailwind CSS)
│       │   │   ├── layout.tsx     # Landing layout
│       │   │   ├── page.tsx       # Home page (/)
│       │   │   └── invite/        # Bot invite redirect
│       │   ├── (auth)/            # Authentication pages
│       │   │   └── login/         # Discord OAuth login
│       │   ├── (dashboard)/       # Authenticated dashboard (MUI)
│       │   │   ├── dashboard/     # Main dashboard
│       │   │   ├── servers/       # Server management
│       │   │   ├── profile/       # User profile
│       │   │   ├── premium/       # Premium features
│       │   │   └── help/          # Help & documentation
│       │   └── api/               # API routes
│       │       ├── webhooks/      # Patreon webhooks
│       │       ├── health/        # Health check
│       │       └── guilds/        # Guild settings API
│       ├── components/
│       │   ├── landing/           # Landing page components (Tailwind)
│       │   │   ├── Header.tsx     # Navigation bar
│       │   │   ├── Hero.tsx       # Hero section
│       │   │   ├── Features.tsx   # Feature cards
│       │   │   ├── Pricing.tsx    # Pricing tiers
│       │   │   ├── Commands.tsx   # Commands list
│       │   │   ├── FAQ.tsx        # FAQ accordion
│       │   │   └── Footer.tsx     # Site footer
│       │   └── dashboard/         # Dashboard components (MUI)
│       ├── lib/                   # Utilities & services
│       └── theme/                 # MUI theme
│   ├── globals.css                # Tailwind + custom styles
│   └── postcss.config.mjs         # Tailwind PostCSS config
└── docs/
    └── WEBSITE_SETUP.md           # This guide
```

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Landing | Main promotional website |
| `/invite` | Landing | Redirects to Discord OAuth bot invite |
| `/login` | Auth | Discord OAuth login |
| `/dashboard` | Dashboard | Main dashboard (authenticated) |
| `/servers` | Dashboard | Server list (authenticated) |
| `/servers/[guildId]/settings` | Dashboard | Server settings |
| `/servers/[guildId]/player` | Dashboard | Music player control |
| `/profile` | Dashboard | User profile |
| `/premium` | Dashboard | Premium features |
| `/help` | Dashboard | Help & documentation |
| `/api/webhooks/patreon` | API | Patreon webhook endpoint |
| `/api/health` | API | Health check endpoint |

## Setup Instructions

### 1. Install Dashboard Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment Variables

Create `.env.local` from the example:

```bash
cd dashboard
cp .env.example .env.local
```

Fill in the required values:

```env
# Auth.js
AUTH_SECRET=your-auth-secret

# Discord OAuth
AUTH_DISCORD_ID=your-discord-client-id
AUTH_DISCORD_SECRET=your-discord-client-secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/music-bot

# Bot Token
DISCORD_BOT_TOKEN=your-bot-token

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Patreon (optional)
PATREON_WEBHOOK_SECRET=your-webhook-secret
```

### 3. Configure Discord OAuth2

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to OAuth2 settings
4. Add redirect URL: `http://localhost:3001/api/auth/callback/discord`
5. For production, add your production URL

### 4. Start Development Server

```bash
cd dashboard
npm run dev
```

This starts the server at `http://localhost:3001`.

## Customization

### Bot Name & Branding

Edit these files in `dashboard/src/components/landing/`:
- `Header.tsx` - Navigation bar logo and name
- `Hero.tsx` - Hero section title and description
- `Footer.tsx` - Footer branding
- `FAQ.tsx` - FAQ content referencing bot name

### Patreon Links

Update the Patreon URL in:
- `Header.tsx` - Navigation Patreon button
- `Footer.tsx` - Footer Patreon link
- `Pricing.tsx` - Pricing tier CTAs

Current Patreon: `https://patreon.com/u36360623`

### Discord Links

Update Discord server invite in:
- `Footer.tsx` - Discord social icon & link
- `FAQ.tsx` - Support server CTA

### Pricing Tiers

Edit `Pricing.tsx` to modify:
- Tier names and prices
- Feature lists for each tier
- CTA buttons and links
- Badges (e.g., "LIMITED TIME")

### Commands List

Edit `Commands.tsx` to add/remove/modify commands:
- Each command has: name, description, usage, category
- Categories: Music, Queue, Controls, Utility

### FAQ Content

Edit `FAQ.tsx` to modify FAQ items:
- Each FAQ has: question, answer
- Accordion UI automatically applied

### Theme Customization

The landing page uses Tailwind CSS with custom theme in `globals.css`:

```css
/* Main colors */
:root {
  --background: #0f0f23;      /* Dark background */
  --primary: #5865f2;         /* Discord blurple */
  --secondary: #f96854;       /* Patreon orange */
  --accent: #9b59b6;          /* Purple accent */
  --gradient-start: #5865f2;  /* Gradient start */
  --gradient-end: #eb459e;    /* Gradient end (pink) */
}

/* Custom animations */
@keyframes float { ... }           /* Floating background orbs */
@keyframes pulse-glow { ... }      /* Glowing buttons */
@keyframes gradient-shift { ... }  /* Gradient text animation */
```

The dashboard uses MUI theme in `dashboard/src/theme/theme.ts`.

## Production Deployment

### Build for Production

```bash
cd dashboard
npm run build
npm run start
```

### Docker Deployment

The dashboard can be deployed alongside the bot:

```bash
# Build bot
npm run build

# Build dashboard
cd dashboard && npm run build

# Run both
npm run start
cd dashboard && npm run start
```

### Environment Variables for Production

```env
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_DISCORD_ID=your-production-client-id
AUTH_DISCORD_SECRET=your-production-secret
MONGODB_URI=mongodb://your-production-db
DISCORD_BOT_TOKEN=your-bot-token
NEXT_PUBLIC_APP_URL=https://your-domain.com
PATREON_WEBHOOK_SECRET=your-webhook-secret
```

### Patreon Webhook Configuration

Configure Patreon webhooks to point to:
```
https://your-domain.com/api/webhooks/patreon
```

Set `DASHBOARD_URL` in `config.json` to enable automatic webhook registration via the `/patreonadmin createwebhook` command.

## Styling Architecture

The application uses two styling systems:

### Landing Pages (Tailwind CSS)
- Modern, utility-first styling
- Responsive design built-in
- Custom animations and gradients
- Files: `globals.css`, `components/landing/*`

### Dashboard Pages (Material UI)
- Consistent component library
- Dark theme matching landing page
- Pre-built components for admin UIs
- Files: `theme/theme.ts`, `components/dashboard/*`

Both systems coexist seamlessly within the same Next.js application using route groups.
