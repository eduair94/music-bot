# Outreach drafts

Ready-to-post copy for the channels in [README.md](README.md) → *Channels worth testing*. Every link carries its own `ref`/UTM so `/admin` → Growth can judge the channel on its own. Post one channel at a time and give each a week before judging it.

Before posting anywhere:

- Read the community's self-promotion rules. Many Discord subreddits only allow bots in a weekly thread or not at all; a removed post costs more than it brings.
- Keep every number current. The server count must match `/status` on the day you post (25 servers in Nov 2026). Never write "10k servers", "unlimited playlists", "priority queue" or "320 kbps" (PRODUCT.md, *Never claim*).
- Post from your own account, answer every comment in the first few hours, and copy useful comments into `/feedback` so they land in `#feedback`.

## Reddit: "I built" post

Link: `https://music-bot.checkleaked.com/?utm_source=reddit&utm_medium=social&utm_campaign=built-post`
Invite (if the sub allows direct links): `https://music-bot.checkleaked.com/invite?ref=reddit`

**Title:** I built an open-source Discord music bot with a live web player for each bot in your server

**Body:**

> I've been building Bypass, a Discord music bot. It's at 25 servers, so I'm looking for people who'll tell me what's broken.
>
> What's different from the bots I used before:
>
> - A web dashboard with a live player and queue. You can run the music from your phone or a second monitor without typing commands.
> - Up to four bots per server for free, so two voice channels can have different music at the same time. Each one gets its own player on the dashboard.
> - Permissions you can see: a DJ role and per-command rules, set from the dashboard.
> - YouTube, Spotify, SoundCloud, Apple Music, Deezer and audio files. Synced lyrics, a guess-the-song game, 24/7 mode, effects (bass boost, nightcore, 8D...).
> - 128 kbps audio for everyone, up to 256 kbps with Premium or after a top.gg vote.
> - It speaks 28 languages and the code is MIT on GitHub.
>
> Site: [link above]. If something annoys you, `/feedback` in Discord comes straight to me.

Adjust the first line to your own voice; the list is the factual part.

## Partner servers

For mid-size music, gaming or study communities (roughly 200–5,000 members) that already have a music bot. Make one link per partner: `https://music-bot.checkleaked.com/invite?ref=partner-<name>` (lowercase, hyphens, e.g. `partner-lofi-lounge`). Their joins and first songs show up under that code in `/admin` → Growth.

**DM to the server owner or admin:**

> Hi! I run Bypass, a Discord music bot with a live web player, up to four bots per server and synced lyrics. I'm looking for a few communities to try it and tell me what's missing.
>
> If you add it and use it for a few weeks, you'd get a direct line to me: your bugs get fixed first and your requests go to the top of the list. Happy to credit your server as a partner in the Bypass support server too.
>
> Invite link for your server: [partner link]. No pressure if it's not a fit.

Check real use after a week: `/admin` → Growth → *Recent joins* shows whether the server played a song. Thank them in the support server if they agree to be named.

Free Premium isn't in this offer on purpose: Premium is attached to a Patreon member (per user, `services/patreon.ts`), and there is no admin tool to comp a server. Vote perks (12 h, `recordVote`) are the only perk that can be granted from code today.

## Asking for a review

NPS promoters are already asked for a top.gg review in the dashboard. For people who praise the bot in the support server or in `#feedback`:

> Thanks, that's great to hear! If you have a minute, a short review on top.gg helps other servers find Bypass: https://top.gg/bot/1315125264786653225#reviews

And for quotable feedback (`quoteOk`): feature it from `/admin` → Feedback, then reply to thank them and say where it appears.
