# Bypass Bot - Website Setup Guide

This guide explains how to set up and customize the promotional website for the Bypass Discord Music Bot.

## Overview

The bot includes a modern, responsive promotional website built with Next.js that is served by the Express webhook server. The website includes:

- **Hero Section** - Animated landing with bot statistics and CTAs
- **Features Section** - Showcases all bot capabilities with 9 feature cards
- **Commands Section** - Searchable/filterable list of all 22 slash commands
- **Pricing Section** - Free tier, Founder tier ($1.50/month), and Coming Soon tier
- **FAQ Section** - 8 frequently asked questions with accordion UI
- **Invite Page** - Animated redirect page with countdown to Discord OAuth

## Architecture

```
music-bot/
├── website/                    # Next.js promotional website
│   ├── app/
│   │   ├── layout.tsx         # SEO metadata & fonts
│   │   ├── page.tsx           # Main page composition
│   │   ├── globals.css        # Dark theme & animations
│   │   ├── invite/
│   │   │   └── page.tsx       # Discord invite redirect page
│   │   └── components/
│   │       ├── Header.tsx     # Responsive navigation
│   │       ├── Hero.tsx       # Landing section
│   │       ├── Features.tsx   # Feature cards
│   │       ├── Pricing.tsx    # Patreon pricing tiers
│   │       ├── Commands.tsx   # Command list
│   │       ├── FAQ.tsx        # FAQ accordion
│   │       └── Footer.tsx     # Footer with links
│   ├── out/                   # Static export (generated)
│   ├── next.config.ts         # Static export config
│   └── package.json           # Website dependencies
├── services/
│   └── webhookServer.ts       # Express server (serves website)
└── docs/
    └── WEBSITE_SETUP.md       # This guide
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Main promotional website |
| `/invite` | Redirects to Discord OAuth bot invite |
| `/health` | Health check endpoint (JSON) |
| `/webhooks/patreon` | Patreon webhook endpoint |

## Setup Instructions

### 1. Install Website Dependencies

```bash
cd website
npm install
```

### 2. Build the Static Website

```bash
cd website
npm run build
```

This generates the static files in `website/out/` folder.

### 3. Customization

#### Bot Name & Branding

Edit these files to change the bot name:
- `website/app/layout.tsx` - SEO metadata (title, description, OpenGraph)
- `website/app/components/Header.tsx` - Navigation bar logo
- `website/app/components/Hero.tsx` - Hero section title
- `website/app/components/Footer.tsx` - Footer branding
- `website/app/components/FAQ.tsx` - FAQ content
- `website/app/invite/page.tsx` - Invite page title

#### Patreon Link

Update the Patreon URL in:
- `website/app/components/Header.tsx` - Nav Patreon button
- `website/app/components/Footer.tsx` - Footer Patreon link
- `website/app/components/Pricing.tsx` - Pricing tier CTAs

Current Patreon: `https://www.patreon.com/cw/BypassDiscordBot`

#### Discord Links

Update Discord server invite in:
- `website/app/components/Footer.tsx` - Discord social icon & link
- `website/app/components/FAQ.tsx` - Support server CTA

#### Bot Client ID

The bot client ID is used for the Discord OAuth invite URL:
- `website/app/invite/page.tsx` - `botClientId` constant
- `services/webhookServer.ts` - Fallback client ID

Current Client ID: `1315125264786653225`

#### Pricing Tiers

Edit `website/app/components/Pricing.tsx` to modify:
- Tier names and prices
- Feature lists for each tier
- CTA buttons and links
- Badges (e.g., "LIMITED TIME")

#### Commands List

Edit `website/app/components/Commands.tsx` to add/remove/modify commands:
- Each command has: name, description, usage, category
- Categories: Music, Queue, Controls, Utility

#### FAQ Content

Edit `website/app/components/FAQ.tsx` to modify FAQ items:
- Each FAQ has: question, answer
- Accordion UI automatically applied

### 4. Theme Customization

The website uses a dark theme defined in `website/app/globals.css`:

```css
/* Main colors */
--background: #0f0f23;      /* Dark background */
--primary: #5865f2;         /* Discord blurple */
--accent: #eb459e;          /* Pink accent */
--patreon: #f96854;         /* Patreon orange */

/* Custom animations */
@keyframes float { ... }           /* Floating background orbs */
@keyframes pulse-glow { ... }      /* Glowing buttons */
@keyframes gradient-shift { ... }  /* Gradient text animation */
```

### 5. Rebuild After Changes

After making any changes to the website, rebuild the static files:

```bash
cd website
npm run build
```

The Express server serves files from `website/out/`, so changes are live after rebuild.

### 6. Development Mode

For local development with hot reload:

```bash
cd website
npm run dev
```

This starts a development server at `http://localhost:3000`.

**Note:** In dev mode, the `/invite` route shows the animated redirect page. In production (served by Express), `/invite` performs an actual redirect to Discord.

## Express Server Integration

The webhook server (`services/webhookServer.ts`) serves the static website:

```typescript
// Serve static website from website/out folder
const websitePath = path.join(__dirname, "..", "..", "website", "out");
this.app.use(express.static(websitePath));

// /invite route redirects to Discord OAuth
this.app.get("/invite", (req, res) => {
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=36700160&scope=bot%20applications.commands`;
  res.redirect(inviteUrl);
});
```

The server automatically:
1. Serves static files from `website/out/` at the root `/`
2. Handles `/invite` with a redirect to Discord OAuth
3. Serves `/health` for health checks
4. Handles `/webhooks/patreon` for Patreon webhooks

## Production Deployment

### Prerequisites
- Node.js 18+
- The main bot compiled (`npm run build` in root)
- Website built (`npm run build` in website folder)

### Deploy Steps

1. Build the main bot:
   ```bash
   npm run build
   ```

2. Build the website:
   ```bash
   cd website && npm run build && cd ..
   ```

3. Start the bot:
   ```bash
   npm start
   ```

The webhook server starts automatically with the bot and serves the website at the configured port (default: 4123).

### Public URL

Configure your reverse proxy (nginx, Cloudflare, etc.) to forward traffic to the webhook server:

```
Public URL: https://music-bot.checkleaked.com
             ↓
Webhook Server: http://localhost:4123
```

## Troubleshooting

### Website not loading
- Ensure `website/out/` folder exists (run `npm run build` in website folder)
- Check that the bot is running and webhook server started
- Verify path resolution: `dist/services/webhookServer.js` → `../../website/out`

### Static assets not loading
- Check browser console for 404 errors
- Ensure `npm run build` completed successfully
- Verify `_next` folder exists in `website/out/`

### Invite not redirecting
- Check if Discord client is connected (fallback uses hardcoded client ID)
- Verify the client ID is correct in `webhookServer.ts`

### Build errors
- Run `npm install` in website folder
- Check for TypeScript errors: `npx tsc --noEmit`
- Ensure all required files exist in `website/app/components/`

## File Reference

| File | Purpose |
|------|---------|
| `website/next.config.ts` | Static export configuration |
| `website/app/layout.tsx` | Root layout, SEO metadata, fonts |
| `website/app/page.tsx` | Main page component composition |
| `website/app/globals.css` | Theme, colors, animations |
| `website/app/invite/page.tsx` | Invite redirect with countdown |
| `website/app/components/Header.tsx` | Navigation bar |
| `website/app/components/Hero.tsx` | Landing hero section |
| `website/app/components/Features.tsx` | Feature cards grid |
| `website/app/components/Pricing.tsx` | Pricing tiers |
| `website/app/components/Commands.tsx` | Command list |
| `website/app/components/FAQ.tsx` | FAQ accordion |
| `website/app/components/Footer.tsx` | Footer |
| `services/webhookServer.ts` | Express server integration |
| `tsconfig.json` | Excludes website from root TS compilation |
