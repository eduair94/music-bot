# Growth kit

What was built on 2026-11-28 to measure and grow Bypass, what the owner has to switch on, and the plan for using it. Event details: [TRACKING_PLAN.md](TRACKING_PLAN.md).

## What's in the code

| Piece | Where | What it gives you |
|---|---|---|
| GA4 + Consent Mode v2 | `dashboard/src/components/analytics/` | Traffic, sources, funnel, key events. EEA/UK/CH get a consent banner. |
| Microsoft Clarity | same | Session replays, heatmaps, rage/dead clicks on landing and dashboard. |
| Click tracking | delegated listener, `data-track-*` | `add_bot_click`, `support_click`, `premium_click`, `vote_click`… with the button's location. |
| Invite attribution | `/invite?ref=<code>` + bot `services/growth/acquisition.ts` | Which source brought each server, server-side `bot_added` conversion in GA4. |
| Activation + churn | same | `first_play` and `bot_removed` per server and per source. |
| Referral loop | `/invite` command | Each user's Invite button is a personal link (`ref=u-<id>`); a referred server that plays music gives the referrer 12 h of vote perks (max 5 a week). |
| Share nudge | bot, after a session of 5+ songs | One "vote / add to another server / feedback" card per server every 14 days. |
| Feedback | footer + dashboard button, `/feedback` in Discord | Messages land in Mongo `feedbacks` and in a private staff channel. Optional "you can quote this" for testimonials. |
| NPS | dashboard, after 3 days of use | Score + reason; promoters are asked for a top.gg review. |
| Admin | `/admin` → Growth, Feedback | Clicks → joins → activated → retained per source; NPS; feedback inbox. |
| Testimonials | `/admin` → Feedback → *Feature on site* | Quotable feedback (the author ticked the box) appears in the home page's Trust section, message only, never the username. Nothing shows until you feature one. |
| Weekly digest | bot `services/growth/digest.ts` → `#📈・growth` | Every Monday 13:00 UTC: joins by source, first songs, removals, NPS, feedback, and what to look at. Manual run: `npx ts-node --transpile-only scripts/growthDigest.ts --dry-run`. |
| Command guides | `/commands/<name>` (16 pages, `data/commandDocs.ts`) | Search entry points for "discord bot play/lyrics/24/7 command"; CTA `ref=site-command`. |
| Comparison | `/compare` + home table (`data/comparison.ts`) | Bypass vs Jockie Music, Uzox, Green-bot; every claim sourced, checked 2026-11-28. Re-check every few months. CTA `ref=site-compare`. |
| SEO extras | root metadata, `public/llms.txt` | Search Console / Bing verification tags; a factual summary for AI assistants, now linking the command guides and `/compare`. |
| Outreach drafts | [OUTREACH.md](OUTREACH.md) | Reddit post, partner-server DM, review ask, each with its own `ref`. |

**Known cost:** gtag.js itself costs about 7 Lighthouse mobile performance points on `/` (blocking time +330 ms under Lighthouse's CPU throttle; CLS stays 0). The alternative is loading GA on the visitor's first interaction, which stops counting visitors who leave without clicking. Kept accurate counting for now.

## Switch it on (owner, ~10 minutes)

Already done on 2026-11-28: staff channels `#📮・feedback` and `#📈・growth` (support server → BOT LOGS, admins and developers only) with webhooks, `FEEDBACK_WEBHOOK_URL` and `GROWTH_DIGEST_WEBHOOK_URL` in box83's `.env`, `FEEDBACK_WEBHOOK_URL` and a generated `ANALYTICS_SALT` in `dashboard/.env` (backups `*.bak-growth-20261128T045219`). Steps 3 and the salt below are therefore done; what's left needs your Google/Microsoft logins.

1. **GA4 property.** analytics.google.com → Admin → account *EduAir* → Create property *Bypass Music Bot* (time zone Montevideo, USD) → Web stream `https://music-bot.checkleaked.com`. Copy the **Measurement ID** (`G-…`). In the stream: *Measurement Protocol API secrets* → Create → copy the **secret**.
   (The Composio Google Analytics connection is read-only, so this couldn't be done for you. Reconnect it with edit access and an agent can create the property, stream, secret, key events and custom dimensions in one go.)
2. **Clarity project.** clarity.microsoft.com → New project *Bypass*, site `music-bot.checkleaked.com` → copy the **project ID** from Settings → Setup. Then Settings → Setup → *Google Analytics integration* → connect the new property.
3. ~~**Feedback channel.**~~ Done (see above). The channels are managed by `scripts/setupSupportServer.ts` (`ID.feedback`, `ID.growth`).
4. **Search engines (optional).** Search Console → add `https://music-bot.checkleaked.com` → HTML tag method → copy the `content` value. Same for Bing Webmaster Tools (`msvalidate.01`).
5. **Env on box83** (never commit these):
   - `/root/music-bot/.env` (read by the bots *and* by compose as dashboard build args):
     ```
     NEXT_PUBLIC_GA_ID=G-XXXXXXX
     NEXT_PUBLIC_CLARITY_ID=xxxxxxxxxx
     GA_API_SECRET=…            # bots send bot_added / first_play / bot_removed
     FEEDBACK_WEBHOOK_URL=…     # /feedback in Discord
     NEXT_PUBLIC_GSC_VERIFICATION=…    # optional
     NEXT_PUBLIC_BING_VERIFICATION=…   # optional
     ```
   - `/root/music-bot/dashboard/.env`: `FEEDBACK_WEBHOOK_URL=…`, `ANALYTICS_SALT=<long random string>` (hashes Discord ids before GA/Clarity see them), `GA_API_SECRET=…` (only so /admin → Growth can show "server events: configured").
6. **Deploy** (the `NEXT_PUBLIC_*` values are baked at build time, so the dashboard must be rebuilt):
   `COMPOSE_BAKE=false docker compose --profile fleet up -d --build bot bot-2 bot-3 bot-4 dashboard`
7. **GA4 admin, once data flows** (see TRACKING_PLAN → GA4 configuration): mark key events, register custom dimensions, activate the *Internal Traffic* filter, set retention to 14 months, add the channel group, link Search Console.
8. **Point bot lists at tracked links.** In each listing's "invite URL" field:

   | Site | Invite URL |
   |---|---|
   | top.gg | `https://music-bot.checkleaked.com/invite?ref=topgg` |
   | discordbotlist.com | `…/invite?ref=discordbotlist` |
   | discord.bots.gg | `…/invite?ref=discordbotsgg` |
   | botlist.me | `…/invite?ref=botlistme` |
   | voidbots.net | `…/invite?ref=voidbots` |
   | discordlist.gg | `…/invite?ref=discordlistgg` |
   | discord.place | `…/invite?ref=discordplace` |
   | radarcord.net | `…/invite?ref=radarcord` |
   | GitHub README "Add to Discord" | `…/invite?ref=github` |

   Without this, joins from bot lists show up as `direct`.

## Check it works (after deploy)

- Open the site in a private window → GA4 *Realtime* shows you; Clarity shows a live session within ~2 minutes.
- Click "Add to Discord" on the hero → GA4 Realtime event `add_bot_click` with `location=hero`. Redis: `LRANGE growth:invite_clicks 0 0` shows the click.
- Add the bot to a test server within 30 minutes → `/admin` → Growth shows the join under `site-hero`; GA4 Realtime shows `bot_added`.
- From a VPN in Germany: the consent banner appears; Reject keeps `_ga`/`_clck` cookies off.
- `/feedback` in Discord and "Send feedback" on the site → message in `#feedback` and in `/admin` → Feedback.

## Plan: how to use this to grow

Real starting point (Nov 2026): 25 servers, ~13 active users a month. At this size, every server is worth a look, and the order of work is: make installs convert into active servers, then pour more traffic in.

**Week 1-2: measure the leak.**
- `/admin` → Growth: what share of new servers reach `first_play`, and how fast? If under ~60% within 24 h, the welcome card / first command is the problem: watch Clarity replays of `/install` and the dashboard first visit, and read every `/feedback`.
- GA4: compare `add_bot_click` ÷ landing sessions per source, and `bot_added` ÷ `add_bot_click` (people who open Discord's screen but don't finish usually balk at permissions; `/install#permissions` already explains each one).

**Ongoing: feed the loops that already exist.**
- **Bot lists are the main channel for Discord bots**, and top.gg ranks by votes. Votes come from the share nudge, the upsell, vote perks and now referral perks. Watch `vote_click` and top.gg vote counts.
- **Reviews:** NPS promoters get a top.gg review prompt. Reviews are what a bot-list visitor reads before clicking Add.
- **Testimonials:** feedback marked "you can quote this" is the first real social proof the site can show (the landing has none, by rule). Feature it from `/admin` → Feedback; it appears in the Trust section within about 1.5 minutes. Add an attribution ("runs a 300-member gaming server") only after asking the person.
- **Referrals:** `/admin` → Growth → top referrers. If someone brings several servers, thank them in the support server.

**Milestones to plan for.**
- **75 servers:** Discord app verification opens, which unlocks the App Directory (set its install link to `/invite?ref=app-directory`).
- **100 servers:** bot-list "trending/new" sections and Discord's 100-server intent checks; apply for verification early.

**Channels worth testing (one at a time, each with its own `ref`/UTM so the Growth panel can judge it):**
- Reddit (r/discordapp, r/Discord_Bots, music-community subs): one honest "I built a hi-fi bot with a live web dashboard" post, not ads. `utm_source=reddit&utm_medium=social`.
- Partner servers: offer Premium to mid-size music/gaming communities in exchange for using Bypass as their music bot (`ref=partner-<name>`).
- Search: the 16 command guides and `/compare` are live. When the i18n branch merges, move them under `app/[locale]/`. Watch Search Console → Pages for indexing and → Performance for which guides get impressions; write more guides for commands that people search for (`/ai`, `/guess`, `/history` have none yet).
