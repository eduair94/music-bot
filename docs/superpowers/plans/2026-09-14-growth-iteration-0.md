# Growth Iteration 0 — Unblock the Funnel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three defects that stop a free user from ever becoming a paying Founder: a dead support invite, premium copy that advertises tiers and prices that do not exist, and premium gates that name no benefit and link nowhere.

**Architecture:** Public links and commercial facts (support invite, Patreon URL, Founder price and spots) move into `shared/links.ts`, which both the bot and the dashboard already import from. One upsell builder in `utils/upsell.ts` renders every premium gate, so the copy lives in one place. `/perks` renders from the same facts instead of from the stale four-tier table.

**Tech Stack:** TypeScript, discord.js v14, Next.js 15 dashboard, vitest (`npm test` → `vitest run --dir tests/unit`).

**Spec:** `docs/superpowers/specs/2026-09-14-growth-program-design.md`

## Global Constraints

- Patreon reality: two tiers only — Free $0 and "Founder / Beta Tester" $3.00/month, 50 spots, `tierId` 27651691, campaign 4665231.
- Every paying patron gets 320 kbps (set in `services/patreon.ts` and `dashboard/src/lib/patreon.ts`, commit ec016a0). Nothing may advertise a lower number for a paid tier.
- Patreon campaign URL: `https://www.patreon.com/c/u36360623`.
- Support server: guild `1458199268564406487`, the bot is a member.
- `NEXT_PUBLIC_*` is inlined at build time and the Docker build gets no env, so hardcoded defaults are what production serves.
- Another session is working on `dashboard/src/components/landing/*` and the admin console. Touch only the files this plan names, and run `git fetch` before committing.

---

### Task 1: One live support invite

The published invite `https://discord.gg/5w6PErKpyK` is expired (Discord error 50270), so `/info support`, `/about`, the dashboard help page, `/install` and the landing footer all send users to a dead link.

**Files:**
- Create: `shared/links.ts`
- Create: `tests/unit/links.test.ts`
- Modify: `commands/info.ts:107`, `commands_disabled/about.ts:54`, `dashboard/src/lib/site.ts:22-23`, `dashboard/src/app/(dashboard)/help/page.tsx:118,273`, `BOT_LISTING.md:21-22`

**Interfaces:**
- Produces: `SUPPORT_INVITE_URL`, `PATREON_URL`, `FOUNDER_PRICE_USD`, `FOUNDER_SPOTS` from `shared/links.ts`.

- [ ] **Step 1: Mint a permanent invite with the bot**

```bash
ssh root@83.147.54.179 "docker exec -i music-bot node -" <<'JS'
const token = process.env.TOKEN;
const api = (p, init) => fetch(`https://discord.com/api/v10${p}`, { ...init, headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json", ...(init && init.headers) } });
(async () => {
  const channels = await (await api("/guilds/1458199268564406487/channels")).json();
  for (const ch of channels.filter((c) => c.type === 0)) {
    const res = await api(`/channels/${ch.id}/invites`, { method: "POST", body: JSON.stringify({ max_age: 0, max_uses: 0, unique: false }) });
    if (res.ok) { const inv = await res.json(); console.log(`#${ch.name} -> https://discord.gg/${inv.code}`); return; }
  }
  console.error("no channel accepted an invite");
})();
JS
```

Expected: one line with a `https://discord.gg/<code>` URL. Use that exact URL in the next step.

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/links.test.ts
import { describe, expect, it } from "vitest";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL, SUPPORT_INVITE_URL } from "../../shared/links";

describe("public links", () => {
  it("points at a support invite that is not the expired one", () => {
    expect(SUPPORT_INVITE_URL).toMatch(/^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
    expect(SUPPORT_INVITE_URL).not.toContain("5w6PErKpyK");
  });

  it("states the Patreon campaign and the Founder offer", () => {
    expect(PATREON_URL).toBe("https://www.patreon.com/c/u36360623");
    expect(FOUNDER_PRICE_USD).toBe(3);
    expect(FOUNDER_SPOTS).toBe(50);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run --dir tests/unit`
Expected: FAIL, cannot resolve `../../shared/links`.

- [ ] **Step 4: Create the module**

```ts
// shared/links.ts
/**
 * Public links and commercial facts shared by the bot and the dashboard.
 * The invite is permanent (max_age 0); the previous one expired and shipped
 * dead in six places.
 */
export const SUPPORT_INVITE_URL = "https://discord.gg/<code from step 1>";
export const PATREON_URL = "https://www.patreon.com/c/u36360623";
/** Founder / Beta Tester tier, as charged on Patreon. */
export const FOUNDER_PRICE_USD = 3;
/** Member limit set on the Patreon tier. */
export const FOUNDER_SPOTS = 50;
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run --dir tests/unit`
Expected: PASS.

- [ ] **Step 6: Replace every hardcoded copy of the dead invite**

- `commands/info.ts:107`: `const supportUrl = process.env.SUPPORT_SERVER || SUPPORT_INVITE_URL;` with `import { SUPPORT_INVITE_URL } from "../shared/links";`
- `commands_disabled/about.ts:54`: same substitution.
- `dashboard/src/lib/site.ts`: `export const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || SUPPORT_INVITE_URL;` importing from `../../../shared/links`, and re-export `PATREON_URL`, `FOUNDER_PRICE_USD`, `FOUNDER_SPOTS` from there so the landing keeps one import site.
- `dashboard/src/app/(dashboard)/help/page.tsx:118,273`: replace both literals with `DISCORD_INVITE` from `@/lib/site`.
- `BOT_LISTING.md:21-22`: replace the placeholder with the new URL.

- [ ] **Step 7: Verify nothing still ships the dead code**

Run: `grep -rn "5w6PErKpyK" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next .`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add shared/links.ts tests/unit/links.test.ts commands/info.ts commands_disabled/about.ts dashboard/src/lib/site.ts "dashboard/src/app/(dashboard)/help/page.tsx" BOT_LISTING.md
git commit -m "fix(support): publish a support invite that still works"
```

---

### Task 2: Stop advertising tiers that do not exist

`PREMIUM_TIERS` still describes basic $3 → 192 kbps, pro $10 and enterprise $25, and `site.ts` still prices the Founder tier at $1.50. `/perks view` prints all of it.

**Files:**
- Modify: `shared/types/index.ts:42-79`, `dashboard/src/lib/site.ts:29-30`, `commands/perks.ts`
- Create: `utils/perksEmbed.ts`, `tests/unit/perks.test.ts`

**Interfaces:**
- Consumes: `FOUNDER_PRICE_USD`, `FOUNDER_SPOTS`, `PATREON_URL` from Task 1.
- Produces: `buildPerksOverview(): EmbedBuilder` from `utils/perksEmbed.ts`.
- `getTierFromPledge`, `getMaxLinkedBots` and the `PremiumTier` union keep their current shape: `services/botManager.ts` and `dashboard/src/lib/models/PatreonUser.ts` index by tier name, and stored documents carry those strings.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/perks.test.ts
import { describe, expect, it } from "vitest";
import { PREMIUM_TIERS, getTierFromPledge } from "../../shared/types";
import { buildPerksOverview } from "../../utils/perksEmbed";

describe("premium tiers", () => {
  it("gives the $3 paid tier everything the pricing page promises", () => {
    expect(getTierFromPledge(300)).toBe("basic");
    expect(PREMIUM_TIERS.basic).toMatchObject({ audioBitrate: 320, audioFilters: true, stayMode: true });
  });

  it("keeps the free tier at 128kbps", () => {
    expect(PREMIUM_TIERS.free).toMatchObject({ audioBitrate: 128, audioFilters: false, stayMode: false });
  });
});

describe("/perks view", () => {
  const embed = buildPerksOverview().toJSON();
  const text = JSON.stringify(embed);

  it("shows only the two plans that exist on Patreon", () => {
    expect(embed.fields?.map((f) => f.name)).toEqual(["Free — $0", "Founder / Beta Tester — $3/month"]);
  });

  it("quotes the real quality and the Patreon link", () => {
    expect(text).toContain("320kbps");
    expect(text).not.toContain("192kbps");
    expect(text).toContain("https://www.patreon.com/c/u36360623");
    expect(text).toContain("50");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --dir tests/unit`
Expected: FAIL — `utils/perksEmbed` missing, and `PREMIUM_TIERS.basic.audioBitrate` is 192.

- [ ] **Step 3: Correct the tier table**

In `shared/types/index.ts`, `basic` becomes the Founder tier as sold: `minPledgeCents: 300`, `maxLinkedBots: 1`, `audioBitrate: 320`, `audioFilters: true`, `stayMode: true`. Leave `pro` and `enterprise` entries in place for stored data, but drop their price claims from anything user-facing (Task 2 Step 4). Add a comment above the table stating that Patreon sells only Free and Founder today.

- [ ] **Step 4: Write the perks embed**

```ts
// utils/perksEmbed.ts
import { EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../shared/links";

/** The two plans Patreon actually sells, rendered for `/perks view`. */
export function buildPerksOverview(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Premium perks")
    .setColor(0xf8aa2a)
    .setDescription(`Founder is limited to ${FOUNDER_SPOTS} spots and the price is locked in.\n[Become a Founder](${PATREON_URL})`)
    .addFields(
      {
        name: "Free — $0",
        value: ["128kbps audio", "Queue, playlists and lyrics", "All 84 commands"].join("\n"),
        inline: true,
      },
      {
        name: `Founder / Beta Tester — $${FOUNDER_PRICE_USD}/month`,
        value: ["320kbps audio", "Audio filters", "24/7 mode", "Priority queue", "Founder role and direct support"].join("\n"),
        inline: true,
      },
    );
}
```

- [ ] **Step 5: Use it in the command**

In `commands/perks.ts`, replace the `PREMIUM_TIERS` loop in the `view` subcommand with `await interaction.reply({ embeds: [buildPerksOverview()] });` and drop the now-unused `PREMIUM_TIERS` import.

- [ ] **Step 6: Fix the landing price constant**

`dashboard/src/lib/site.ts`: `export const FOUNDER_PRICE_USD = 3;` (re-exported from `shared/links` per Task 1).

- [ ] **Step 7: Run the tests**

Run: `npx vitest run --dir tests/unit` and `npx tsc --noEmit -p tsconfig.json`
Expected: PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add shared/types/index.ts utils/perksEmbed.ts commands/perks.ts dashboard/src/lib/site.ts tests/unit/perks.test.ts
git commit -m "fix(premium): advertise the two tiers Patreon actually sells"
```

---

### Task 3: Turn the premium walls into an offer

`/247` replies with one i18n line, `/importplaylist` links to `patreon.com` (not the campaign), and `requirePremiumFeature` says "Use /premium to learn more" without price, spots or link.

**Files:**
- Create: `utils/upsell.ts`, `tests/unit/upsell.test.ts`
- Modify: `utils/premiumCheck.ts:37-60`, `commands/247.ts:25-33`, `commands/importplaylist.ts:15-29`

**Interfaces:**
- Consumes: `PREMIUM_FEATURES`, `PremiumFeature` from `utils/premiumCheck.ts`; links from Task 1.
- Produces: `premiumUpsell(feature: PremiumFeature): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; ephemeral: true }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/upsell.test.ts
import { describe, expect, it } from "vitest";
import { premiumUpsell } from "../../utils/upsell";

describe("premium upsell", () => {
  const reply = premiumUpsell("stay_24_7");
  const json = JSON.stringify(reply.embeds.map((e) => e.toJSON()));

  it("names the feature, the price and the scarcity", () => {
    expect(json).toContain("24/7 Mode");
    expect(json).toContain("$3");
    expect(json).toContain("50");
  });

  it("tells the user how to get it and how to link Discord", () => {
    expect(json).toContain("/premium link");
    expect(json).toMatch(/link your Discord/i);
  });

  it("offers a button straight to the campaign", () => {
    const row = reply.components[0].toJSON() as { components: Array<{ url?: string; label?: string }> };
    expect(row.components[0].url).toBe("https://www.patreon.com/c/u36360623");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --dir tests/unit`
Expected: FAIL, cannot resolve `../../utils/upsell`.

- [ ] **Step 3: Write the builder**

```ts
// utils/upsell.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../shared/links";
import { PREMIUM_FEATURES, PremiumFeature } from "./premiumCheck";

/**
 * One reply for every premium wall: what the user just hit, what the Founder
 * tier costs, and the two steps that turn a pledge into working perks.
 */
export function premiumUpsell(feature: PremiumFeature) {
  const embed = new EmbedBuilder()
    .setTitle(`${PREMIUM_FEATURES[feature]} is a Founder perk`)
    .setColor(0xf8aa2a)
    .setDescription(
      `Founder is $${FOUNDER_PRICE_USD}/month, limited to ${FOUNDER_SPOTS} spots, and unlocks 320kbps audio, audio filters, 24/7 mode, priority queue and the Founder role.`,
    )
    .addFields({
      name: "After you join",
      value: `1. link your Discord account in your Patreon settings\n2. run \`/premium link\` in this server`,
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Become a Founder").setStyle(ButtonStyle.Link).setURL(PATREON_URL),
  );

  return { embeds: [embed], components: [row], ephemeral: true as const };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --dir tests/unit`
Expected: PASS.

- [ ] **Step 5: Route the three gates through it**

- `utils/premiumCheck.ts`: `requirePremiumFeature` replies with `premiumUpsell(feature)` instead of its own embed.
- `commands/247.ts`: replace the `i18n.__("247.premiumRequired")` reply with `interaction.reply(premiumUpsell("stay_24_7"))`.
- `commands/importplaylist.ts`: replace the inline embed with `interaction.reply(premiumUpsell("unlimited_playlists"))`.

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit -p tsconfig.json` then `npx vitest run --dir tests/unit`
Expected: exit 0, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add utils/upsell.ts utils/premiumCheck.ts commands/247.ts commands/importplaylist.ts tests/unit/upsell.test.ts
git commit -m "feat(premium): make every premium wall a real offer"
```

---

### Task 4: Ship it and prove it in production

**Files:** none (deployment)

- [ ] **Step 1: Full check before pushing**

Run: `npx vitest run --dir tests/unit`, `npx tsc --noEmit -p tsconfig.json`, and `cd dashboard && npx tsc --noEmit -p tsconfig.json`
Expected: all exit 0. Restore `dashboard/tsconfig.tsbuildinfo` afterwards with `git checkout -- dashboard/tsconfig.tsbuildinfo`.

- [ ] **Step 2: Push, rebuild both containers**

```bash
git fetch -q origin music && git rebase origin/music
git push origin music
ssh root@83.147.54.179 "cd /root/music-bot && git pull --ff-only origin music && COMPOSE_BAKE=false docker compose up -d --build bot dashboard"
```

- [ ] **Step 3: Verify in production**

- `ssh root@83.147.54.179 'docker ps --format "{{.Names}} | {{.Status}}" | grep music-bot'` — both up, bot healthy.
- `curl -s -o /dev/null -w "%{http_code}" https://discord.com/api/v10/invites/<code>` — 200, and the JSON has no `expires_at`.
- `curl -s https://music-bot.checkleaked.com/ | grep -c '5w6PErKpyK'` — 0.
- Bot logs show no new errors: `ssh root@83.147.54.179 'docker logs --since 5m music-bot | grep -iE "error" | head'`.

- [ ] **Step 4: Report**

Write the iteration report: what shipped, what it fixes in the funnel, and the next backlog item.
