/**
 * Offline check of everything the bot sends to Discord at startup and in its
 * main UI, without logging in:
 *  - loads every command and context menu and builds the registration payload
 *    (same code path as Bot.buildCommandPayload), then checks Discord's limits;
 *  - renders the help menu, welcome card, queue view and player panel with a
 *    mock queue and validates the Components V2 JSON.
 *
 * Usage: npx ts-node scripts/dryRunCommands.ts [--dump]
 */
import { readdirSync } from "fs";
import { join } from "path";
import { Collection } from "discord.js";

process.env.TOKEN ||= "dry-run";

async function main() {
  const { commands, contextMenus } = await import("../structs/commandRegistry");
  const isModule = (f: string) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts");

  for (const file of readdirSync(join(__dirname, "..", "commands")).filter(isModule)) {
    const mod = await import(join(__dirname, "..", "commands", file));
    if (mod.default?.data) commands.set(mod.default.data.name, mod.default);
  }
  for (const file of readdirSync(join(__dirname, "..", "contextMenus")).filter(isModule)) {
    const mod = await import(join(__dirname, "..", "contextMenus", file));
    if (mod.default?.data) contextMenus.set(mod.default.data.name, mod.default);
  }

  // Reuse the real payload builder without constructing (and logging in) a Bot.
  const { Bot } = await import("../structs/Bot");
  const payload: any[] = Bot.prototype.buildCommandPayload.call({});

  const problems: string[] = [];
  const names = new Set<string>();
  let chatInput = 0;
  for (const cmd of payload) {
    const type = cmd.type ?? 1;
    if (type === 1) chatInput++;
    if (names.has(`${type}:${cmd.name}`)) problems.push(`duplicate name ${cmd.name}`);
    names.add(`${type}:${cmd.name}`);
    if (type === 1) {
      if (!/^[-_\p{L}\p{N}]{1,32}$/u.test(cmd.name)) problems.push(`bad name ${cmd.name}`);
      if (!cmd.description || cmd.description.length > 100) problems.push(`${cmd.name}: description length ${cmd.description?.length}`);
      for (const [loc, text] of Object.entries(cmd.description_localizations ?? {})) {
        if (!text || (text as string).length > 100) problems.push(`${cmd.name}: ${loc} description length`);
      }
      const walk = (opts: any[], path: string) => {
        if (opts.length > 25) problems.push(`${path}: ${opts.length} options`);
        let seenOptional = false;
        for (const o of opts) {
          if (!o.description || o.description.length > 100) problems.push(`${path} ${o.name}: description length ${o.description?.length}`);
          if (o.type !== 1 && o.type !== 2) {
            if (o.required && seenOptional) problems.push(`${path} ${o.name}: required after optional`);
            if (!o.required) seenOptional = true;
          }
          if (o.options) walk(o.options, `${path} ${o.name}`);
        }
      };
      walk(cmd.options ?? [], `/${cmd.name}`);
    }
    if (!cmd.contexts || !cmd.integration_types) problems.push(`${cmd.name}: missing contexts/integration_types`);
  }
  if (chatInput > 100) problems.push(`${chatInput} slash commands (max 100)`);
  const size = JSON.stringify(payload).length;

  console.log(`commands: ${chatInput} slash + ${payload.length - chatInput} context menus, payload ${(size / 1024).toFixed(1)} KB`);
  console.log(`user-installable: ${payload.filter((c) => c.integration_types.includes(1)).map((c) => c.name).join(", ")}`);
  console.log(`with localized descriptions: ${payload.filter((c) => c.description_localizations).length}`);

  // ---- UI renders
  const { buildHelp } = await import("../services/helpMenu");
  const { buildWelcome } = await import("../services/welcome");
  const { buildQueueView } = await import("../services/queueView");
  const { PlayerPanelService } = await import("../services/playerPanel");
  const { runWithLocale } = await import("../utils/i18n");

  const check = (label: string, components: any[]) => {
    try {
      const json = components.map((c) => (typeof c.toJSON === "function" ? c.toJSON() : c));
      const count = (nodes: any[]): number =>
        nodes.reduce((n, c) => n + 1 + count(c.components ?? []) + (c.accessory ? 1 : 0), 0);
      const total = count(json);
      if (total > 40) problems.push(`${label}: ${total} components (max 40)`);
      const text = JSON.stringify(json);
      if (text.length > 6000 * 2) problems.push(`${label}: very large (${text.length} chars)`);
      console.log(`✓ ${label}: ${total} components`);
      if (process.argv.includes("--dump")) console.log(JSON.stringify(json, null, 1).slice(0, 3000));
    } catch (error) {
      problems.push(`${label}: ${(error as Error).message}`);
    }
  };

  for (const locale of ["en", "es", "pt_br"] as const) {
    runWithLocale(locale, () => {
      check(`help (${locale})`, buildHelp("Bypass").components);
      check(`help music (${locale})`, buildHelp("Bypass", "music").components);
      check(`welcome (${locale})`, [buildWelcome("Bypass")]);
      check(`welcome, no voice status (${locale})`, [buildWelcome("Bypass", { missingVoiceStatus: true })]);
    });
  }

  const user = { id: "1066182746399055993", bot: false, username: "tester" };
  const mkTrack = (i: number) => ({
    id: `t${i}`,
    title: `Song number ${i} [Official Video] *bold* @everyone`,
    author: `Artist ${i}`,
    url: `https://www.youtube.com/watch?v=dQw4w9WgXc${i % 10}`,
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationMS: 200_000 + i * 1000,
    requestedBy: user,
    metadata: null
  });
  const tracks = Array.from({ length: 23 }, (_, i) => mkTrack(i + 1));
  const mockQueue: any = {
    guild: { id: "1", preferredLocale: "en-US", name: "Test" },
    metadata: { autoplay: true },
    currentTrack: mkTrack(0),
    repeatMode: 0,
    deleted: false,
    tracks: { size: tracks.length, toArray: () => tracks, at: (i: number) => tracks[i] },
    history: { tracks: { toArray: () => [] }, isEmpty: () => true },
    node: { isPaused: () => false, volume: 80, getTimestamp: () => ({ current: { value: 61_000 } }) }
  };

  check("queue view p1", (await buildQueueView(mockQueue, 0)).components);
  check("queue view p3", (await buildQueueView(mockQueue, 2)).components);
  const panel = PlayerPanelService.getInstance();
  check("player panel", [await panel.render(mockQueue)]);
  mockQueue.node.isPaused = () => true;
  mockQueue.repeatMode = 1;
  mockQueue.currentTrack = { ...mkTrack(99), durationMS: 0, thumbnail: "" };
  check("player panel (paused, live, no thumb)", [await panel.render(mockQueue)]);

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
  process.exit(0);
}

void Collection;
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
