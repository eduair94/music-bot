---
name: Bypass Dashboard
description: The signed-in server dashboard as a festival bill, with one printed stage per bot instance on a shared clock.
colors:
  stock: "#f2ede4"
  stock-deep: "#e8e1d4"
  paper: "#fbf8f2"
  ink: "#151515"
  ink-2: "#3d3a35"
  ink-3: "#6b665d"
  rule: "#cfc6b8"
  rule-soft: "#e0d8ca"
  rule-absent: "#8a8378"
  now: "#d4001f"
  stage-1: "#e8402a"
  stage-2: "#2a5bd7"
  stage-3: "#f5b700"
  stage-3-text: "#9a7300"
  stage-4: "#1f9d55"
  stage-5: "#c2187a"
  stage-6: "#0f8a8a"
  stage-7: "#f07d16"
  stage-8: "#7c4ddb"
typography:
  display:
    fontFamily: "Anybody, Arial Narrow, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 74"
  headline:
    fontFamily: "Anybody, Arial Narrow, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 74"
  title:
    fontFamily: "Anybody, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 74"
  clock:
    fontFamily: "Anybody, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "'wdth' 75"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  body-sm:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  hairline: "2px"
  tight: "3px"
  base: "4px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "40px"
  button-ink-hover:
    backgroundColor: "{colors.ink-2}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  button-danger:
    textColor: "{colors.now}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "40px"
  text-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "40px"
  nav-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.base}"
  set-block:
    backgroundColor: "{colors.stage-1}"
    textColor: "#ffffff"
    rounded: "{rounded.tight}"
    padding: "10px 12px"
  stats-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    padding: "10px 24px"
---

# Design System: Bypass Dashboard

Scope: this system covers the signed-in dashboard only (`dashboard/src/app/(dashboard)/**` and `dashboard/src/app/(auth)/login`), scoped in code under the `.fest` wrapper. The public landing `(landing)`, `/admin` and `/insights` keep the older studio-console identity (coal/amber) and are not part of this world. Do not mix the two vocabularies on one screen.

## Overview

**Creative North Star: "The Clash Finder"**

The server is a festival bill. Each Bypass bot instance is a stage with its own printed colour, every song is a set blocked out on one shared clock, and a red NOW line cuts across all stages at once. The surface is printed poster stock with paper grain, black ink, and ruled hairlines; everything reads as screen-printed rather than lit. Colour is information: a stage colour means "this bot", everywhere it appears.

Density is that of a timetable: tight condensed caps for names, titles and times; a calm humanist sans for the working text; tabular numerals throughout so clocks and counts never wobble. Absence is drawn, not hidden: a missing stage, an ended queue, or an empty permission cell gets a dashed printer's outline. Motion borrows from print: blocks are pulled onto the bill, finished sets leave upward, permissions land like rubber stamps, toasts are ticket stubs.

The world refuses the grey-card Discord dashboard with blurple buttons and the near-black neon console. It is light-only (`color-scheme: light`).

**Key Characteristics:**
- Warm poster stock with a tiled paper-grain raster, ink-black text and controls, hairline rules.
- Eight stage colours that carry data (set blocks, column rules, progress, chart series, permission stamps), never decoration.
- Anybody at condensed width (wdth 74), weight 800, in caps for the bill voice; Public Sans for UI.
- Dashed outlines and diagonal hatching for what is absent, ended, or already played.
- A single red NOW line and red now-marker as the live-time signal.
- Flat printed surfaces; soft shadows only on things that float above the bill.

## Colors

A printed palette: one warm paper, one ink, and a festival line-up of saturated flat stage inks.

### Primary
- **Bill Ink** (ink): the primary action colour. Primary buttons, the active nav tab, selection highlight, focus outlines, menu-item hover fill, the 30-day stats strip, table header rules. Ink-black buttons are the system's main call to action.
- **NOW Red** (now): live time only. The NOW line across the timetable, the current-time marker on the axis, the text caret, danger buttons and "blocked" verdicts. Distinct from Stage 1 red on purpose.

### Secondary (stage inks)
Assigned per bot instance in `dashboard/src/lib/dash/stages.ts`, each with an "on" text colour and a quiet tint:
- **Bypass Red** (stage-1), on white, tint #f7d9cf.
- **Bypass 2 Cobalt** (stage-2), on white, tint #d5dff5.
- **Bypass 3 Sun Yellow** (stage-3), on ink, tint #f6e5b0. When yellow must be text or an icon on stock, use **Mustard Text** (stage-3-text) instead; raw yellow fails contrast there.
- **Bypass 4 Green** (stage-4), on white, tint #cfe7d6. Also the LIVE connection dot.
- **Premium stages 5-8:** Magenta (stage-5), Teal (stage-6), Orange (stage-7, on ink), Violet (stage-8).

### Neutral
- **Poster Stock** (stock): page ground, under the paper-grain tile; also text on ink.
- **Deep Stock** (stock-deep): recessed bands and sunk areas.
- **Clean Paper** (paper): raised fields: inputs, selects, menus, toasts, outline-button fill.
- **Ink 2** (ink-2): secondary text, ink-button hover.
- **Ink 3** (ink-3): hints, metadata, placeholders, column headers, scrollbar thumb.
- **Rule** (rule) and **Soft Rule** (rule-soft): hairline dividers between rows, columns and sections.
- **Absent Grey** (rule-absent): the dashed rule over a stage that is not in the server, and the default dot for colourless roles.

### Named Rules
**The Stage Owns Its Colour Rule.** A stage colour always means that bot instance, on every screen. Never use a stage ink for generic emphasis, status, or decoration; use ink for emphasis and NOW red for live time.

**The One Red Line Rule.** NOW red (#d4001f) marks the present moment and refusals. It is never a fill for content blocks; Stage 1 red does that job.

## Typography

**Display Font:** Anybody, variable width axis, loaded with next/font (with Arial Narrow, sans-serif)
**Body Font:** Public Sans (with ui-sans-serif, system-ui, sans-serif)

**Character:** Condensed heavy grotesque caps that look set for a festival poster, paired with a plain, legible public-sector sans for everything you read or operate. Tabular numerals are on globally inside the dashboard.

### Hierarchy
- **Display** (800, 56px mobile / 64px desktop, 0.92): page titles such as FLEET and PERMISSIONS. Condensed (wdth 74), caps.
- **Headline** (800, 40px, 0.92): stage names at the top of each column, major section heads (WHO CAN DO WHAT, CHECK A MEMBER).
- **Title** (800, 20-28px, 0.92): set titles inside blocks, sub-sections, card heads (ON THE BENCH).
- **Clock** (700, 17-34px, tabular, wdth 75): start times, remaining time, queue-end times, the big stat numbers on the strip.
- **Body** (400-600, 15px / 14px): row labels, descriptions, button text (600). Long text capped at 52-68ch.
- **Body small** (400, 13px): hints under field labels, metadata lines (artist, duration, requester).
- **Label** (600-700, 11.5-12px, 0.06em, caps): table column headers and short status verdicts (ALLOWED / BLOCKED, LIVE) only.

### Named Rules
**The Bill Voice Rule.** Anybody caps is reserved for names, titles and times: things that would be printed on the bill. Controls, descriptions and form text stay in Public Sans, sentence case.

**The Wide Variant Rule.** A wider cut (wdth 90) exists for the rare line that needs to read as a banner; the default bill voice is wdth 74.

## Layout

The signature layout is the timetable: a narrow left time axis, then one column per stage, each column headed by a 6-8px colour rule, the stage name in headline caps, and its voice channel and listener count. Set blocks stack down the column with heights proportional to duration; the NOW line runs horizontally across all columns. Columns are separated by hairline rules; a column without a playing set is tinted with its stage tint, a column for an absent bot is drawn with dashed rules. A dark ink stats strip is pinned to the bottom of the Fleet view (sticky on mobile).

Pages open with a title row: display-size page title, a one-line status summary in body text beside it, and actions right-aligned. Settings and permission screens use a two-zone grid: a main column of ruled rows (label and hint left, control right, `minmax(0,1fr) / 18rem`) and a side panel on wide screens.

The top bar holds the wordmark, server switcher, section tabs, search and user, and is closed by a 2px ink rule. On mobile it splits into a compact bar plus a horizontally scrolling tab row; the timetable collapses to stacked stage sections, each keeping its colour rule, now-playing block and a "Next / queued / ends" line.

Spacing runs on a 4px base: 6-8px between inline elements, 12-16px between related blocks, 24px page gutters on desktop (16px on mobile). Breakpoints are Tailwind defaults (sm 640, md 768, lg 1024, xl 1280).

## Elevation & Depth

The bill is flat. Depth comes from print: ink against stock, hairline rules, stage tints, paper grain, hatching over the played part of a set. Shadows appear only on things that physically float above the bill: menus, popovers and chart tooltips, the toast stub, the add-song drawer, the sticky permission save bar, and the range-slider thumb. All shadows are soft, warm-ink (`rgb(21 21 21 / …)`), negative-spread and short; none are hard offset blocks.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: 0 12px 32px -12px rgb(21 21 21 / 0.35)`): dropdown menus and the server switcher.
- **Stub lift** (`box-shadow: 0 10px 28px -14px rgb(21 21 21 / 0.45)`): toasts.
- **Tooltip lift** (`box-shadow: 0 8px 20px -10px rgb(21 21 21 / 0.6)`): ink chart tooltips.
- **Edge lift** (`box-shadow: -16px 0 40px -20px rgb(21 21 21 / 0.45)` / `0 -12px 40px -16px …`): side drawer and bottom save bar, cast toward the bill.

### Named Rules
**The Flat Bill Rule.** Anything printed on the bill (set blocks, cards, rows, stamps) carries no shadow. A shadow means the element is lifted off the paper and will go away.

## Shapes

Corners are barely softened: 4px on buttons, inputs, menus, toasts and cards; 3px on set blocks, stamps and small badges; 2px on focus outlines. Pills (fully round) are used only for the switch, avatars and status dots. Borders are 1px ink or ink at 30% for fields, 1px rule for dividers, and 1.5px dashed (currentColor or absent grey) for absence: the queue-end block, the not-in-server card, empty permission cells, "add" affordances. Diagonal hatching (`-45deg`, ink at 8%, 2px on 7px) marks off-air and already-played areas. Stage column heads use a solid bar; an absent stage's head uses a dashed bar.

## Components

### Buttons
Ink-printed and decisive.
- **Shape:** gently squared (4px), heights 32 / 40 / 48px, 600 weight Public Sans.
- **Ink (primary):** ink fill, stock text; hover to Ink 2. Follow NOW, Invite, Start actions.
- **Outline:** 1px ink border on translucent paper; hover inverts to ink fill with stock text.
- **Stage:** fills with the stage colour and its "on" colour; used only for an action tied to one stage (Start music here on a yellow stage).
- **Danger:** 1px NOW-red border and text; hover fills red.
- **Ghost:** ink text, hover a 6% ink wash.
- **States:** 150ms colour transition, press scales to 0.97; busy state draws a thin ink line along the bottom using the print-pull motion. Focus is a 2px ink outline offset 2px.

### Inputs / Fields
- **Style:** paper fill, 1px ink-at-30% border, 4px corners, 40px tall, placeholder in Ink 3, caret in NOW red.
- **Focus:** border goes to full ink (plus the global ink focus outline).
- **Select:** same field with a hand-drawn chevron. **Switch:** 44x24 pill with ink border; on fills with ink or a stage colour, knob flips from ink to paper. **Slider:** 6px rounded track, stage-coloured fill, 16px square-ish ink thumb with a paper border.

### Navigation
Top bar on stock with a 2px ink bottom rule. Section tabs are plain ink text; the active tab is a solid ink block with stock text (4px corners), hover a 7% ink wash. Server switcher is an outlined 4px box with a guild initials chip. Search is a paper field with a `/` key hint. On mobile, tabs move to their own scrolling row under the bar.

### Set Block (signature)
A stage-coloured block on the timetable whose height is its duration. Title in bill caps, artist / duration / requester in small bold text, start time in clock type at the top right, an overflow menu. The now-playing block adds remaining time in large clock type, transport controls and hatching over the elapsed portion. Blocks enter with **print-pull** (620ms, clip wiping down with a brief over-saturation) and leave with **set-off** (clip up, 12px rise, fade). Fleet-to-player navigation morphs the block via view transitions (420ms).

### Queue End and Absence Cards
A dashed outline in the stage colour (queue end: big clock time, one line of what happens next, an outline Add songs button) or in absent grey (not in this server: headline, short invite copy, ink Invite button). The bench card uses the stage tint, a 2px stage border, and a stage illustration.

### Permission Stamp
The permission matrix is a grid of dashed cells per audience (Everyone, DJs, Admins, each represented by a wristband illustration). The required minimum audience is a stamped block in that audience's stage ink with bill-caps text; higher audiences that inherit show a quiet ink check. Stamps land with **stamp-in** (circle clip expanding from the click point, 420ms).

### Ticket Stub Toast
Bottom-right, max 360px, paper with ink border and a 12px dashed-perforation tab at the left; enters with **stub-in** (rise and slight tilt) and tears off with **stub-out** (slide right, 4deg rotation, 220ms ease-in).

### Stats Strip
A full-width ink band with stock text: big clock numerals followed by small body labels (plays, listened, requesters), a link to the 30-day view at right.

### Motion
Easing out `cubic-bezier(0.16, 1, 0.3, 1)`, in `cubic-bezier(0.7, 0, 0.84, 0)`. The LIVE dot pulses at 2s. All print motions collapse to 1ms and the pulse stops under `prefers-reduced-motion`.

### Imagery
Raster art lives in `dashboard/public/dash/*.webp`: flat screen-print illustrations on stock (empty stages per stage colour, band art, crowd silhouette strip, wristbands, setlist, login bill, paper grain). Each file ships with a `.json` provenance sidecar holding its generation prompt. Art uses only the palette's flat inks with ink overprint, halftone and grain: no photography, 3D, glow, text or logos.

## Do's and Don'ts

### Do:
- **Do** keep each bot instance on its stage colour from `stages.ts` everywhere it appears: column rule, blocks, progress, chart series, stamps.
- **Do** use ink-black (#151515) for primary buttons and the active tab, and Public Sans 600 for their labels.
- **Do** draw absence with a 1.5px dashed outline and played/off-air time with diagonal hatching instead of hiding it.
- **Do** set names, titles and times in Anybody condensed caps, and use tabular numerals for every time and count.
- **Do** swap Sun Yellow for Mustard Text (#9a7300) when yellow sits as text or an icon on stock.
- **Do** give new raster art a `.json` provenance sidecar and keep it in flat screen-print inks.
- **Do** respect reduced motion: print, stamp and stub motions collapse to 1ms.

### Don't:
- **Don't** use stage colours as generic accents, status colours or decoration.
- **Don't** use NOW red for anything but live time, the caret, danger and refusals.
- **Don't** put shadows on printed elements; shadows belong to menus, tooltips, toasts, drawers and the save bar only, and are never hard offset blocks.
- **Don't** add a dark mode or neon glow, or use Discord blurple outside Discord-branded login and add-to-server buttons.
- **Don't** set small caps tracked labels above titles; caps micro-labels are for table column headers and verdict words only.
- **Don't** bring the landing's studio-console styling (coal/amber) into `.fest` screens, or this bill vocabulary into the landing, `/admin` or `/insights`.
