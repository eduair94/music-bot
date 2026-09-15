# Growth Program — Design

**Date:** 2026-09-14
**Status:** approved in chat; iterations execute one at a time
**Goal:** first paying Founder, then more installs
**Autonomy:** mixed — low-risk work ships on its own; public copy, figures, prices and external accounts are proposed first

## 1. Where we are

| Metric | Value |
|---|---|
| Servers | 22 |
| Members reached | ~94,000 |
| Premium users / patrons | 0 |
| Support server members | 4 |
| Bot list presence | none (`/vote` disabled) |
| Patreon page | published 2026-09-14, Founder tier $3, 50 spots |

## 2. Funnel defects this program fixes

| Area | Today | Why it costs us users |
|---|---|---|
| Support invite `discord.gg/5w6PErKpyK` | Expired (Discord code 50270) | Dead link in /help, /install, terms, privacy, FAQ and `/about`; nobody can reach support, and the community never grows |
| `PREMIUM_TIERS` (`shared/types`) | free / basic $3 192kbps / pro $10 / enterprise $25 | `/perks view` advertises three tiers that do not exist on Patreon, at a lower quality than patrons actually get (320kbps) |
| Premium gates (`/247`, `/importplaylist`, filters) | One-line "premium required" reply | No benefit, no price, no link, no next step |
| Patreon page | No cover image, no welcome note, no one-liner, no posts, Free tier undescribed | Looks abandoned to anyone who arrives from the landing |
| Landing hero | "10K+ servers", "99.9% uptime", unsourced competitor claims | Contradicts a Patreon page with 0 patrons; bot-list reviewers check these |
| Telemetry | `command` and `error` events, daily snapshot | No funnel data: which gate was hit, who saw the upsell, who linked |

## 3. Approach

Conversion first, acquisition in parallel but owner-driven.

At 22 servers and 0% conversion, more traffic through a leaking funnel is wasted; the leaks are cheap to fix and mostly low-risk. Bot-list submissions need the owner's logins on each site, so those run in parallel as prepared material.

Rejected: A) acquisition first — installs would rise while conversion stays at zero; B) quality/reliability first — slower, and no current evidence that playback quality is what blocks the first sale.

## 4. Iterations

### Iteration 0 — unblock the funnel (low risk, ships on its own)

1. Create a permanent invite to the support server with the bot (it is already a member of `1458199268564406487`), replace the expired link in `commands/info.ts`, `commands_disabled/about.ts`, `dashboard/src/lib/site.ts`, the dashboard help page and `BOT_LISTING.md`. `site.ts` holds the default that production actually serves, because `NEXT_PUBLIC_*` is inlined at build time.
2. Align `PREMIUM_TIERS` with Patreon: Free ($0, 128kbps) and Founder ($3, 320kbps, filters, 24/7). Check every consumer (`/perks`, `services/guildSettings.ts`, linked-bot limits) before changing shape.
3. Rewrite the premium gates as an upsell: what the feature does, that Founder is $3 with 50 spots, a button to the Patreon page, and the two steps to link Discord to Patreon.
4. Unit tests for tier limits and gate copy; deploy and verify on box83.

### Iteration 1 — Patreon page (public content, proposed before publishing)

Cover image 1600×400 in the site's visual identity, welcome note (`thanks_msg`), one-liner, Free tier description, Discord role mapping for the Founder tier through the already-connected integration, and a launch post with the roadmap. Requires the owner to log in again in the Playwright window.

### Iteration 2 — honest landing

A public stats endpoint served from the daily `MetricsSnapshot`, the hero showing real servers and members, and unsourced competitor claims removed or labelled. Coordinate with the session working on landing and SEO.

### Iteration 3 — acquisition

Prepared listings for top.gg, discordbotlist.com, discords.com and botlist.me: short and long copy, images, and steps. The owner submits them. Re-enable `/vote` once listed.

## 5. Measurement

Add funnel events to the existing telemetry: `premium_gate_hit` (feature, user, guild), `premium_cta_shown`, `/premium link` outcomes. The daily snapshot already records guilds, members, active guilds, premium users and founders. Each iteration reports installs, active servers, gate hits and patrons.

## 6. Loop mechanics

Self-paced loop inside the session: measure, pick the highest-impact backlog item, implement, test, deploy low-risk work, batch public changes for approval, verify, report. The backlog lives in `docs/superpowers/plans/2026-09-14-growth-backlog.md` so another session can pick it up.

## 7. Owner decisions still open

- Rename of the Patreon page was done; the 50-spot limit is set. No further pricing changes assumed.
- Bot-list submissions need the owner's Discord logins.
- Client secret rotation needs Patreon support (see the Patreon memory).
