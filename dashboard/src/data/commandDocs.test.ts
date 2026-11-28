import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Relative imports keep this test loadable from the repo root's vitest run (no "@/" alias there).
import { commandDocs, commandPageSlugs, getCommandDoc } from "./commandDocs";
import { commands } from "./commands";

/** The bot's slash commands (repo root commands/, i.e. ../commands/ from the dashboard). */
const BOT_COMMANDS_DIR = fileURLToPath(new URL("../../../commands/", import.meta.url));

const words = (text: string) => text.replace(/`/g, "").split(/\s+/).filter(Boolean).length;

describe("commandDocs", () => {
  it("has a sensible number of pages", () => {
    expect(commandDocs.length).toBeGreaterThanOrEqual(12);
    expect(commandDocs.length).toBeLessThanOrEqual(18);
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = commandDocs.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("documents each command once", () => {
    const names = commandDocs.map((d) => d.command);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(commandDocs.map((d) => [d.slug, d] as const))("%s maps to the public catalogue and to a bot command file", (_, doc) => {
    expect(doc.command).toMatch(/^\/[a-z0-9_]+$/);
    const listed = commands.some((c) => c.name === doc.command || c.name.startsWith(`${doc.command} `));
    expect(listed, `${doc.command} is not in data/commands.ts`).toBe(true);
    const file = `${BOT_COMMANDS_DIR}${doc.command.slice(1)}.ts`;
    expect(existsSync(file), `${file} does not exist`).toBe(true);
  });

  it.each(commandDocs.map((d) => [d.slug, d] as const))("%s has the required content", (_, doc) => {
    expect(doc.title).toContain(doc.command);
    expect(doc.description.length).toBeGreaterThan(50);
    expect(doc.description.length).toBeLessThanOrEqual(155);
    expect(doc.description).not.toContain("`");
    expect(doc.summary.trim()).not.toBe("");
    expect(doc.usage.startsWith(doc.command)).toBe(true);
    expect(words(doc.intro.join(" "))).toBeGreaterThanOrEqual(60);
    expect(doc.examples.length).toBeGreaterThanOrEqual(2);
    for (const example of doc.examples) {
      expect(example.input.startsWith(doc.command)).toBe(true);
      expect(example.result.trim()).not.toBe("");
    }
    expect(doc.permissions.length).toBeGreaterThan(0);
    expect(doc.premium.trim()).not.toBe("");
  });

  it.each(commandDocs.map((d) => [d.slug, d] as const))("%s describes every option", (_, doc) => {
    const options = [...doc.options, ...(doc.subcommands ?? []).flatMap((s) => s.options)];
    for (const option of options) {
      expect(option.name).toMatch(/^[a-z0-9_]+$/);
      expect(option.description.trim()).not.toBe("");
      if (option.type === "choice") expect(option.choices?.length).toBeGreaterThan(0);
    }
    for (const sub of doc.subcommands ?? []) expect(sub.description.trim()).not.toBe("");
  });

  it("links only to related pages that exist", () => {
    const slugs = new Set(commandDocs.map((d) => d.slug));
    for (const doc of commandDocs) {
      expect(doc.related.length).toBeGreaterThan(0);
      expect(new Set(doc.related).size).toBe(doc.related.length);
      for (const slug of doc.related) {
        expect(slugs.has(slug), `${doc.slug} → ${slug}`).toBe(true);
        expect(slug).not.toBe(doc.slug);
      }
    }
  });

  it("looks pages up by slug and commands up by name", () => {
    expect(getCommandDoc("play")?.command).toBe("/play");
    expect(getCommandDoc("nope")).toBeUndefined();
    expect(commandPageSlugs["/play_file"]).toBe("play-file");
    expect(Object.keys(commandPageSlugs)).toHaveLength(commandDocs.length);
  });
});
