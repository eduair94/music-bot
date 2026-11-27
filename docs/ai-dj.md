# AI DJ, radio and server playlists

How the 3.2.0 features work and what the bot needs in its `.env`.

## Commands

| Command | What it does | Who |
|---|---|---|
| `/ai playlist prompt:` `[count] [play] [next]` | Claude writes a playlist (artist + title) for the description. It is queued through the collection loader (fleet-aware) and shown as a card with **Save to my collections** and **Save as server playlist** buttons. `play:False` only shows the card, with a **Play** button. | Anyone (daily limit) |
| `/ai radio prompt:` / `/radio prompt:` | AI radio: the first batch of 10 songs plays, and each time the queue runs out the next batch is asked for, excluding what already played. When the session is out of batches (or Claude doesn't answer) it falls back to normal autoplay. | Anyone (daily limit) |
| `/radio station:` | One of 18 genre stations (`services/radioLogic.ts`). | Anyone |
| `/radio song:` / `/radio` | Radio from a song, or from the song playing now. | Anyone |
| `/playlists …` | Server playlists. List/view/play/copy for everyone; create/save/add/remove/rename/delete/import need a DJ role (permission rules) or server admin. | See left |
| `/library …` | The user's own Spotify/YouTube playlists — see `docs/connected-accounts.md`. Hidden until configured. | Anyone |

## Radio sessions stay on genre

Plain autoplay seeds each pick from the current song, so a station drifts. A radio session (`QueueMetadata.radio`) keeps the YouTube ids of its seed songs as anchors; every third pick is seeded from an anchor (`radioSeedId`). The session is carried to another fleet instance in `params.radio` when the primary hands the play over.

## Limits and cost

- Premium (`ai_dj` perk: Founder, support-server boosters, premium servers, bot owner): `AI_PREMIUM_DAILY` uses per server per UTC day (default 50) and AI radio sessions of `AI_RADIO_BATCHES_PREMIUM` batches (default 40 × 10 songs).
- Everyone else: `AI_FREE_DAILY` per server per day (default 3) and `AI_RADIO_BATCHES_FREE` batches (default 3).
- Radio refills count in their own bucket, `AI_REFILLS_DAILY` per server (default 150).
- Counters live in Mongo `aiquota` (atomic across instances, expire after 2 days). A failed generation is refunded.
- Measured 2026-11-27 on `claude-opus-5-5`, effort low: 4–6 s and about US$0.01 per 8–10 song playlist.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `CLAUDE_CREDIT_KEYS` | — | `label=sk-ant-…,label2=…`: plan credit keys, rotated; a key that runs out, is rejected or rate limited rests and the next one answers. Falls back to `ANTHROPIC_API_KEY` when unset. Without any key `/ai` is hidden and `/radio prompt:` says the AI DJ isn't set up. |
| `CLAUDE_CREDIT_KEY_MONTHLY_CAP_USD` | 90 | Estimated spend per key per month before it is skipped (Mongo `claudeusage`), so purchased credits are never spent. 0 = no cap. |
| `CLAUDE_CREDIT_EXHAUSTED_RETRY_MIN` | 360 | Rest for a key that ran out of credits. |
| `AI_MODEL` | `claude-opus-5-5` | Model for playlists and radio. |
| `AI_EFFORT` | `low` | `output_config.effort`. |
| `AI_FREE_DAILY`, `AI_PREMIUM_DAILY`, `AI_REFILLS_DAILY`, `AI_RADIO_BATCHES_FREE`, `AI_RADIO_BATCHES_PREMIUM` | 3, 50, 150, 3, 40 | Limits above. |

Connected accounts need `LINKED_ACCOUNTS_KEY` and the OAuth clients in **both** the bot and dashboard `.env` — see `docs/connected-accounts.md`.
