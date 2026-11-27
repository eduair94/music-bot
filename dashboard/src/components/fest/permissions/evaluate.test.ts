import { describe, expect, it } from "vitest";
import { evaluate, NOTE_ALONE } from "./evaluate";
import { normalize } from "./model";

const DJ = "dj";
const MUTED = "muted";
const CREW = "crew";

const config = normalize({
  djRoles: [DJ],
  groups: {
    play: { mode: "everyone", allowRoles: [], denyRoles: [MUTED], allowUsers: [], denyUsers: ["u-banned"] },
    skip: { mode: "dj", allowRoles: [CREW], denyRoles: [], allowUsers: ["u-friend"], denyUsers: [] },
    stop_leave: { mode: "admins", allowRoles: [], denyRoles: [], allowUsers: [], denyUsers: [] },
    queue: { mode: "dj", allowRoles: [], denyRoles: [DJ], allowUsers: [], denyUsers: [] },
  } as never,
  options: { requesterCanSkipOwn: true, aloneIsDj: true, voteSkip: { enabled: true, percentage: 60 } },
});

describe("evaluate", () => {
  it("lets admins through even when denied", () => {
    expect(evaluate(config, "play", { roles: [MUTED], isAdmin: true }).source).toBe("admin");
  });

  it("deny beats allow and the wristband", () => {
    expect(evaluate(config, "play", { roles: [MUTED] })).toMatchObject({ ok: false, source: "deny-role" });
    expect(evaluate(config, "play", { roles: [], userId: "u-banned" })).toMatchObject({ ok: false, source: "deny-user" });
    expect(evaluate(config, "queue", { roles: [DJ] })).toMatchObject({ ok: false, source: "deny-role" });
  });

  it("allow lists open DJs and admins rules", () => {
    expect(evaluate(config, "skip", { roles: [CREW] })).toMatchObject({ ok: true, source: "allow-role" });
    expect(evaluate(config, "skip", { roles: [], userId: "u-friend" })).toMatchObject({ ok: true, source: "allow-user" });
  });

  it("applies the wristband", () => {
    expect(evaluate(config, "play", { roles: [] })).toMatchObject({ ok: true, source: "everyone" });
    expect(evaluate(config, "skip", { roles: [DJ] })).toMatchObject({ ok: true, source: "dj-role" });
    expect(evaluate(config, "stop_leave", { roles: [DJ] })).toMatchObject({ ok: false, source: "admins-only" });
  });

  it("lists the house rules that still let a blocked member act", () => {
    const v = evaluate(config, "skip", { roles: [] });
    expect(v.ok).toBe(false);
    expect(v.notes).toEqual([NOTE_ALONE, "it's their own song", "60% of listeners vote to skip"]);
  });

  it("fills missing groups with safe defaults", () => {
    expect(config.groups.settings.mode).toBe("admins");
    expect(config.groups.lyrics_view.mode).toBe("everyone");
  });
});
