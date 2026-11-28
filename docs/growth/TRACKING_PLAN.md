# Tracking plan

Tools: **GA4** (funnel, sources, conversions), **Microsoft Clarity** (session replays, heatmaps, rage/dead clicks), **own data** (Mongo `guildacquisitions`, `feedbacks`; Redis invite clicks), shown in `/admin` → Growth and Feedback.

Last updated: 2026-11-28.

## The funnel and what answers each question

| Stage | Question | Measured by |
|---|---|---|
| Visit | Where do visitors come from? | GA4 session source/medium, `bp_ft` first-touch cookie |
| Intent | Which page/button makes people click "Add to Discord"? | `add_bot_click` {location, ref} |
| Install | Which source actually brings servers? | `bot_added` (server-side, attributed to the click's GA session), `guildacquisitions.ref` |
| Activation | Do new servers play music? How fast? | `first_play` {hours_to_first_play}, `guildacquisitions.firstPlayAt` |
| Retention | Which sources bring servers that stay? | `bot_removed` {days_installed}, `guildacquisitions.leftAt` |
| Referral | Do users spread it? | `/invite` referral links (`ref=u-<id>`), share nudge (`ref=bot-share`) |
| Satisfaction | Would they recommend it? What's broken? | NPS (`nps_submit`), `feedback_submit`, `/feedback`, Clarity rage clicks |
| Revenue | Who goes to Premium? | `premium_click`; Patreon webhook (existing) |

## Events

Names are lowercase snake_case. Params never carry PII (no usernames, emails, raw Discord ids; logged-in users get a salted 16-hex hash as GA `user_id`).

### Browser (gtag + Clarity, via `dashboard/src/lib/analytics/track.ts` and the delegated click listener)

| Event | Params | Trigger |
|---|---|---|
| `page_view` | `page_group` (landing/dashboard/auth) | Automatic (GA4 enhanced measurement, incl. client-side navigation) |
| `add_bot_click` | `location`, `ref` | Any link to `/invite` or Discord's OAuth authorize URL. **Key event.** |
| `support_click` | `location` | Links to `/support` or discord.gg |
| `premium_click` | `location` | Links to Patreon |
| `vote_click` | `location`, `site` | Links to top.gg / discordbotlist.com |
| `github_click` | `location` | Links to GitHub |
| `login_start` | `location` | "Log in with Discord" |
| `feedback_open` / `feedback_submit` | `kind`, `source` | Feedback dialog. `feedback_submit` is a **key event**. |
| `nps_shown` / `nps_submit` / `nps_dismiss` | `score` | Dashboard NPS card (3+ days of use, every 90 days) |
| `review_prompt_click` | — | Promoter (9-10) clicks "review on top.gg" |
| `consent_choice` | `choice` | Consent banner accept (EEA/UK/CH only) |

`location` = nearest `data-track-location`, else the section id / landmark, else the path.

### Server-side (GA4 Measurement Protocol, sent by the bot — `shared/gaMeasurement.ts`)

| Event | Params | Trigger |
|---|---|---|
| `bot_added` | `source`, `campaign`, `member_bucket` | Primary bot joins a server. Uses the invite click's `_ga` client id + session id, so GA credits the visitor's original source. **Key event (the real conversion).** |
| `first_play` | `source`, `hours_to_first_play` | First track ever played in that server. **Key event (activation).** |
| `bot_removed` | `source`, `days_installed` | Bot removed from a server |

Joins with no matching click (bot-list buttons that skip our site, Discord's "Add App", shared raw links) arrive as `source=direct` with a pseudo client id per server.

## Invite attribution

Every "Add to Discord" link goes through `https://music-bot.checkleaked.com/invite?ref=<code>`. The route logs the click (ref, UTMs, GA ids, country) to Redis and redirects to Discord. When the bot joins within 30 minutes of a click, that click is the source (`shared/growth.ts` → `pickAttribution`). At our volume the time match is reliable.

Ref codes (one spelling per source; full list with labels in `REF_LABELS`):

| Where the link lives | Code |
|---|---|
| Website buttons | `site-header`, `site-hero`, `site-pricing`, `site-install`, `site-footer`, `site-cta`, `site-status` |
| Bot | `bot-invite` / `u-<discord id>` (personal referral link from `/invite`), `bot-help`, `bot-welcome`, `bot-share` |
| Bot lists | `topgg`, `discordbotlist`, `discordbotsgg`, `botlistme`, `voidbots`, `discordlistgg`, `discordplace`, `radarcord` |
| Other | `app-directory`, `github`, `support`, `patreon`, `llms` |

New campaigns: use `?ref=<code>` for invite links and standard UTMs for site links (`utm_source` = who sent it, `utm_medium` = kind of deal: `newsletter`, `creator`, `community`, `social`; lowercase, hyphens).

Links the bot posts to the website carry `utm_source=discord&utm_medium=bot&utm_campaign=<surface>` (`help`, `welcome`, `invite`, `fleet`, `library`).

## GA4 configuration (Admin)

- **Key events:** `add_bot_click`, `bot_added`, `first_play`, `feedback_submit`.
- **Custom definitions → event-scoped dimensions:** `location`, `ref`, `source`, `campaign`, `member_bucket`, `hours_to_first_play`, `kind`, `site`, `page_group`, `choice`. **Metrics:** `score` (standard), `days_installed` (standard). **User-scoped dimension:** `logged_in`.
- **Internal traffic:** the owner's browser sends `traffic_type=internal` (set when the owner opens the dashboard). Admin → Data collection → Data filters → *Internal Traffic* → switch from Testing to **Active**.
- **Data retention:** Admin → Data retention → 14 months.
- **Channel group** (Admin → Channel groups → copy default, add above the defaults):
  - *Bot lists*: source matches regex `top\.?gg|discordbotlist|discord\.?bots\.?gg|botlist\.?me|voidbots|discordlist|discord\.?place|radarcord`
  - *Discord*: source matches `discord` (incl. `discord.com`, `discord.gg`, our `utm_source=discord`)
  - *AI assistants*: source matches `chatgpt|openai|perplexity|claude|gemini|copilot|you\.com`
  - *Referral program*: campaign or source starts with `u-`
- **Links:** Search Console (Admin → Product links), Clarity (Clarity → Settings → Setup → Google Analytics integration).

## Clarity configuration

- Masking: **Balanced** (default). Form fields are masked; the dashboard also masks the logged-in user's name/avatar with `data-clarity-mask`.
- Custom tags available for filtering: `page_group`, `internal`, `<event>_location`.
- Exclude internal traffic in filters with `internal = 1`.
- Review recordings with the `clarity-session-review` skill (question first: "why do visitors on /install not click Add?").

## Privacy

Disclosed in `/privacy#cookies`. EEA/UK/CH visitors get a consent banner (Reject as easy as Accept); until they accept, GA runs cookieless (Consent Mode v2) and Clarity sets no cookies. Owner pages (`/admin`, `/insights`) load no analytics.
