---
version: 1
slug: "dashboard-src-app-dashboard"
primary_target: "dashboard/src/app/(dashboard)"
related_targets: ["dashboard/src/components"]
---

# Surface brief: server dashboard (Operate)

Scope: the signed-in dashboard (`dashboard/src/app/(dashboard)`): servers list, server Fleet home, per-bot Player, Queue, Permissions, Settings, Activity, Collections, Premium, Profile, Help, and the login screen. Landing (`(landing)`), `/admin` and `/insights` keep their own look.

Mode: Operate. Audience: server admins (configure) and DJs (run the music) beside Discord, desktop second screen or phone. Task: see which bot plays what, where and until when; act on it inline; admins invite missing bots, set permissions and settings. Data: live playback per bot instance (SSE), queue, 30-day activity, permission rules, settings. Constraints: true claims only (PRODUCT.md); API contract `docs/plans/2026-11-27-dashboard-api.md`; i18n-ready copy; keyboard-operable transport.

Chosen sketch: `.impeccable/mocks/decision/model-pick.html` (critique reference; code-led build).

## Direction contract

THESIS: The fleet is a festival bill. Each Bypass bot is a stage, every song is a set blocked out on one shared clock, and a red NOW line cuts across all stages at once. It refuses the grey-card Discord dashboard with blurple buttons and the near-black neon console.

OWN-WORLD: Printed timetable stock #f2ede4 with ink #151515 and ruled hairlines #cfc6b8. Stage colours carry data everywhere (blocks, progress, chart series, permission scopes): Bypass red #e8402a, Bypass 2 blue #2a5bd7, Bypass 3 yellow #f5b700, Bypass 4 green #1f9d55, Premium stages magenta, teal, orange, violet. Anybody at condensed width, weight 800, caps, for stage names, titles and times; Public Sans for UI text with tabular numerals. Ink-black primary buttons, 4px corners, dashed outlines for what is absent or ended.

STORY: A DJ opens the server and reads in one glance what each bot plays, in which channel, and when its queue runs out; pauses, skips or adds without leaving the bill. An admin sees which stages are missing or idle, invites or dispatches them, then sets who may do what.

FIRST VIEWPORT: Top bar: wordmark, server switcher, section tabs, search, user. Below: FLEET title with a one-line status summary, Follow NOW and Add to queue at right. Then the timetable: left time axis, one column per bot with its colour rule, name and channel; now-playing block with progress and transport; upcoming blocks sized by duration with start times; dashed queue-end block; bench and not-in-server cards inside their columns. A dark strip at the bottom carries the 30-day numbers.

FORM: Clash Finder (multi-stage festival timetable), position 1 of my ordered list, taken as the pick. seed:b0985ef289ebc3e3. Signature interaction: the NOW line and progress advance in real time from live state, finished sets slide off the top, and new sets drop into place.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
