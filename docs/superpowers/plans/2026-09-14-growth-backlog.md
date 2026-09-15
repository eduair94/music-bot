# Growth Backlog

Living list behind `docs/superpowers/specs/2026-09-14-growth-program-design.md`. Each loop iteration picks the top unblocked item, ships it, and updates this file.

**Autonomy:** low-risk work (code, tests, deploys) ships on its own. Public copy, figures, prices and anything needing an external account is proposed to the owner first.

## Done

- **Iteration 0 — unblock the funnel** (2026-09-14, commits fe62ee0, 23e749d, 100f85a)
  - Support invite `hjJQKp5zDU` replaces the expired `5w6PErKpyK` in the bot, the dashboard and `BOT_LISTING.md`; both now read it from `shared/links.ts`.
  - `PREMIUM_TIERS.basic` is the real Founder tier (320kbps, filters, 24/7) and `/perks view` shows only the two plans Patreon sells; the landing's structured data stopped quoting $1.50.
  - `/247`, `/importplaylist` and `requirePremiumFeature` all reply with one upsell: the feature hit, $3, 50 spots, a button to the campaign, and the two linking steps.

## Next

| # | Item | Why it matters | Who | Effort |
|---|---|---|---|---|
| 1 | Patreon page: cover image, welcome note, one-liner, Free tier text, launch post | The page is the checkout; it currently looks abandoned | me, owner approves copy and logs in | M |
| 2 | Patreon → Discord role for the Founder tier | The tier promises a Founder role and direct support; the integration is already connected to the support server | me, owner logs in | S |
| 3 | Real numbers on the landing hero | "10K+ servers" against 22 destroys trust with anyone who checks | me | M |
| 4 | Funnel telemetry: `premium_gate_hit`, `/premium link` outcome | Without it, no iteration can tell whether an upsell worked | me | M |
| 5 | Bot list submissions: top.gg, discordbotlist.com, discords.com, botlist.me | Discovery: 22 servers with no listing presence | owner submits, me prepares copy and images | M |
| 6 | Re-enable `/vote` once listed, with a reward loop | Votes drive listing rank, which drives installs | me | S |
| 7 | Rewrite `BOT_LISTING.md` long copy | It still describes "150+ commands", games and leaderboards the bot does not have | me | S |
| 8 | Onboarding message when the bot joins a server | First-run experience decides whether a server keeps it | me | M |
| 9 | Support server: welcome channel, roles, pinned FAQ | 4 members; an empty server converts nobody | owner, me drafts | S |

## Watch list

- Another session owns the admin console and landing SEO. Check `git log origin/music` before touching `dashboard/src/components/landing/*`.
- The creator token auto-refreshes; do not press "Actualiza el token" in the Patreon portal.
- The bot restarts on every deploy, which interrupts playback. Batch deploys when possible.
