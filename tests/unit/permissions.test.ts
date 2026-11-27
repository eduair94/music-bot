import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  COMMAND_GROUPS,
  DEFAULT_CONFIG,
  GROUPS,
  LEGACY_DJ_GROUPS,
  PermissionConfig,
  commandGroup,
  createDefaultConfig,
  describeDenial,
  evaluate,
  isChannelAllowedForInstance,
  migrateFromLegacy,
  normalizeConfig,
  parsePermissionConfig,
  resolveConfig
} from "../../shared/permissions";

const DJ = "111111111111111111";
const MOD = "222222222222222222";
const MUTED = "333333333333333333";
const USER = "444444444444444444";
const OTHER = "555555555555555555";

const member = (roleIds: string[] = [], isAdmin = false, id = USER) => ({ id, roleIds, isAdmin });

function djConfig(): PermissionConfig {
  return migrateFromLegacy({ djRoleId: DJ, voteSkipPercentage: 60 });
}

describe("migrateFromLegacy", () => {
  it("keeps today's behaviour when a DJ role is set", () => {
    const config = djConfig();
    expect(config.djRoles).toEqual([DJ]);
    for (const group of LEGACY_DJ_GROUPS) expect(config.groups[group].mode).toBe("dj");
    expect(config.groups.play.mode).toBe("everyone");
    expect(config.groups.lyrics_view.mode).toBe("everyone");
    expect(config.groups.settings.mode).toBe("admins");
    expect(config.options.requesterCanSkipOwn).toBe(false);
    expect(config.options.aloneIsDj).toBe(false);
    expect(config.options.voteSkip).toEqual({ enabled: true, percentage: 60 });
  });

  it("opens everything but settings when no DJ role is set", () => {
    const config = migrateFromLegacy({ djRoleId: null });
    expect(config.djRoles).toEqual([]);
    for (const group of GROUPS) expect(config.groups[group].mode).toBe(group === "settings" ? "admins" : "everyone");
    expect(config.options.voteSkip.percentage).toBe(50);
  });

  it("matches the legacy DJ rule for members and admins", () => {
    const config = djConfig();
    expect(evaluate(config, member([DJ]), "skip").ok).toBe(true);
    expect(evaluate(config, member([]), "skip").ok).toBe(false);
    expect(evaluate(config, member([], true), "skip").ok).toBe(true);
    expect(evaluate(config, member([]), "play").ok).toBe(true);
    expect(evaluate(config, member([DJ]), "settings").ok).toBe(false);
  });

  it("clamps the vote-skip percentage", () => {
    expect(migrateFromLegacy({ voteSkipPercentage: 0 }).options.voteSkip.percentage).toBe(1);
    expect(migrateFromLegacy({ voteSkipPercentage: 250 }).options.voteSkip.percentage).toBe(100);
  });

  it("ignores a malformed legacy DJ role", () => {
    expect(migrateFromLegacy({ djRoleId: "not-an-id" }).groups.skip.mode).toBe("everyone");
  });
});

describe("evaluate", () => {
  it("lets admins through every group, even when denied", () => {
    const config = djConfig();
    config.groups.skip.denyUsers = [USER];
    for (const group of GROUPS) expect(evaluate(config, member([], true), group)).toMatchObject({ ok: true, reason: "admin" });
  });

  it("deny lists beat allow lists", () => {
    const config = djConfig();
    config.groups.skip.allowUsers = [USER];
    config.groups.skip.denyRoles = [MUTED];
    const result = evaluate(config, member([MUTED, DJ]), "skip");
    expect(result).toMatchObject({ ok: false, reason: "denied_role", rule: { group: "skip", source: "denyRoles", roleId: MUTED } });

    config.groups.skip.denyRoles = [];
    config.groups.skip.denyUsers = [USER];
    config.groups.skip.allowRoles = [MOD];
    expect(evaluate(config, member([MOD]), "skip")).toMatchObject({ ok: false, reason: "denied_user" });
  });

  it("allow lists open a restricted group", () => {
    const config = djConfig();
    config.groups.volume.allowRoles = [MOD];
    expect(evaluate(config, member([MOD]), "volume")).toMatchObject({ ok: true, reason: "allowed_role", rule: { roleId: MOD } });
    config.groups.settings.allowUsers = [USER];
    expect(evaluate(config, member(), "settings")).toMatchObject({ ok: true, reason: "allowed_user" });
  });

  it("denies everyone-mode groups to denied members", () => {
    const config = createDefaultConfig();
    config.groups.play.denyUsers = [USER];
    expect(evaluate(config, member(), "play").ok).toBe(false);
    expect(evaluate(config, member([], false, OTHER), "play").ok).toBe(true);
  });

  it("accepts any of several DJ roles", () => {
    const config = djConfig();
    config.djRoles = [DJ, MOD];
    expect(evaluate(config, member([MOD]), "queue")).toMatchObject({ ok: true, reason: "dj" });
  });

  it("aloneIsDj makes a lone listener DJ, only when enabled and only for dj mode", () => {
    const config = djConfig();
    expect(evaluate(config, member(), "skip", { aloneWithBot: true }).ok).toBe(false);
    config.options.aloneIsDj = true;
    expect(evaluate(config, member(), "skip", { aloneWithBot: true })).toMatchObject({ ok: true, reason: "alone" });
    expect(evaluate(config, member(), "skip", { aloneWithBot: false }).ok).toBe(false);
    expect(evaluate(config, member(), "settings", { aloneWithBot: true }).ok).toBe(false);
  });

  it("requesterCanSkipOwn covers skip and queue only", () => {
    const config = djConfig();
    expect(evaluate(config, member(), "skip", { isRequester: true }).ok).toBe(false);
    config.options.requesterCanSkipOwn = true;
    expect(evaluate(config, member(), "skip", { isRequester: true })).toMatchObject({ ok: true, reason: "requester" });
    expect(evaluate(config, member(), "queue", { isRequester: true }).ok).toBe(true);
    expect(evaluate(config, member(), "volume", { isRequester: true }).ok).toBe(false);
    expect(evaluate(config, member(), "skip", { isRequester: false }).ok).toBe(false);
  });

  it("escape hatches never override a deny list", () => {
    const config = djConfig();
    config.options.requesterCanSkipOwn = true;
    config.options.aloneIsDj = true;
    config.groups.skip.denyUsers = [USER];
    expect(evaluate(config, member(), "skip", { isRequester: true, aloneWithBot: true }).ok).toBe(false);
  });

  it("names the mode that refused", () => {
    const config = djConfig();
    expect(evaluate(config, member(), "skip")).toMatchObject({ ok: false, reason: "needs_dj", rule: { group: "skip", mode: "dj", source: "mode" } });
    expect(evaluate(config, member([DJ]), "settings")).toMatchObject({ ok: false, reason: "needs_admin" });
    expect(describeDenial(evaluate(config, member(), "skip"))).toContain("DJs");
  });

  it("falls back to the group default when a stored config lacks the group", () => {
    const config = djConfig();
    delete (config.groups as Partial<PermissionConfig["groups"]>).settings;
    expect(evaluate(config, member(), "settings").ok).toBe(false);
  });
});

describe("resolveConfig / normalizeConfig", () => {
  it("prefers a saved config over the legacy fields", () => {
    const saved = createDefaultConfig();
    saved.groups.skip.mode = "admins";
    expect(resolveConfig({ djRoleId: DJ, permissionConfig: saved }).groups.skip.mode).toBe("admins");
    expect(resolveConfig({ djRoleId: DJ, permissionConfig: {} }).groups.skip.mode).toBe("dj");
    expect(resolveConfig({ djRoleId: DJ }).groups.skip.mode).toBe("dj");
  });

  it("repairs partial documents", () => {
    const config = normalizeConfig({ djRoles: [DJ, "x", DJ], groups: { skip: { mode: "bogus", denyUsers: [USER] } } });
    expect(config.djRoles).toEqual([DJ]);
    expect(config.groups.skip).toEqual({ mode: "everyone", allowRoles: [], denyRoles: [], allowUsers: [], denyUsers: [USER] });
    expect(config.groups.settings.mode).toBe("admins");
  });

  it("does not let callers mutate the frozen defaults", () => {
    expect(Object.isFrozen(DEFAULT_CONFIG.groups.play)).toBe(true);
    const copy = createDefaultConfig();
    copy.groups.play.mode = "dj";
    expect(DEFAULT_CONFIG.groups.play.mode).toBe("everyone");
  });
});

describe("parsePermissionConfig", () => {
  it("accepts a complete config and dedupes ids", () => {
    const input = createDefaultConfig() as any;
    input.djRoles = [DJ, DJ];
    input.instanceChannels = { "2": [OTHER] };
    const parsed = parsePermissionConfig(input);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config.djRoles).toEqual([DJ]);
      expect(parsed.config.instanceChannels).toEqual({ "2": [OTHER] });
    }
  });

  it("rejects missing groups, unknown groups, bad modes and bad ids", () => {
    const missing = createDefaultConfig() as any;
    delete missing.groups.lyrics_view;
    expect(parsePermissionConfig(missing)).toMatchObject({ ok: false, path: "groups.lyrics_view" });

    const unknown = createDefaultConfig() as any;
    unknown.groups.extra = unknown.groups.play;
    expect(parsePermissionConfig(unknown)).toMatchObject({ ok: false, path: "groups.extra" });

    const mode = createDefaultConfig() as any;
    mode.groups.skip.mode = "mods";
    expect(parsePermissionConfig(mode)).toMatchObject({ ok: false, path: "groups.skip.mode" });

    const id = createDefaultConfig() as any;
    id.groups.skip.denyUsers = ["123"];
    expect(parsePermissionConfig(id)).toMatchObject({ ok: false, path: "groups.skip.denyUsers[0]" });

    const pct = createDefaultConfig() as any;
    pct.options.voteSkip.percentage = 0;
    expect(parsePermissionConfig(pct)).toMatchObject({ ok: false, path: "options.voteSkip.percentage" });

    const inst = createDefaultConfig() as any;
    inst.instanceChannels = { "0": [] };
    expect(parsePermissionConfig(inst)).toMatchObject({ ok: false, path: "instanceChannels.0" });

    expect(parsePermissionConfig(null)).toMatchObject({ ok: false });
  });
});

describe("isChannelAllowedForInstance", () => {
  it("allows any channel unless the instance has a list", () => {
    const config = createDefaultConfig();
    expect(isChannelAllowedForInstance(config, 1, OTHER)).toBe(true);
    config.instanceChannels["2"] = [DJ];
    expect(isChannelAllowedForInstance(config, 2, OTHER)).toBe(false);
    expect(isChannelAllowedForInstance(config, "2", DJ)).toBe(true);
    config.instanceChannels["3"] = [];
    expect(isChannelAllowedForInstance(config, 3, OTHER)).toBe(true);
  });
});

describe("commandGroup", () => {
  it("follows the dashboard contract table", () => {
    const table: Record<string, string> = {
      play: "play", search: "play",
      pause: "playback", resume: "playback", seek: "playback", previous: "playback",
      skip: "skip", skipto: "skip",
      remove: "queue", move: "queue", shuffle: "queue", clear: "queue",
      volume: "volume", filter: "effects",
      loop: "loop_autoplay", autoplay: "loop_autoplay",
      stop: "stop_leave", leave: "stop_leave", join: "stop_leave"
    };
    for (const [command, group] of Object.entries(table)) expect(commandGroup(command)).toBe(group);
  });

  it("maps panel buttons and context menus", () => {
    expect(commandGroup("toggle")).toBe("playback");
    expect(commandGroup("prev")).toBe("playback");
    expect(commandGroup("volup")).toBe("volume");
    expect(commandGroup("Play in voice channel")).toBe("play");
    expect(commandGroup("Play next")).toBe("play");
    expect(commandGroup("lyrics")).toBe("lyrics_view");
    expect(commandGroup("queue")).toBeNull();
    expect(commandGroup("nonexistent")).toBeNull();
  });

  it("knows every slash command in the repo", () => {
    const dir = join(__dirname, "..", "..", "commands");
    const names = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(join(dir, f), "utf8").match(/new SlashCommandBuilder\(\)[\s\S]*?\.setName\("([^"]+)"\)/)?.[1])
      .filter((n): n is string => Boolean(n));
    expect(names.length).toBeGreaterThan(40);
    const missing = names.filter((n) => !Object.prototype.hasOwnProperty.call(COMMAND_GROUPS, n));
    expect(missing).toEqual([]);
  });
});

describe("locale strings", () => {
  it("has every key the bot's refusals use, in English", () => {
    const en = JSON.parse(readFileSync(join(__dirname, "..", "..", "locales", "en.json"), "utf8"));
    for (const group of GROUPS) expect(typeof en.permissions.groups[group]).toBe("string");
    for (const key of ["denied_user", "denied_role", "needs_dj", "needs_admin", "hint"]) {
      expect(typeof en.permissions.deny[key]).toBe("string");
    }
    expect(typeof en.permissions.voteSkipOff).toBe("string");
    // MessageFormat treats apostrophes as escapes; keep them out of these strings.
    expect(JSON.stringify(en.permissions.deny)).not.toContain("'");
  });
});
