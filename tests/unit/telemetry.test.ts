import { describe, expect, it } from "vitest";
import { buildHeartbeat, cpuPercent, HeartbeatInput } from "../../services/telemetry/heartbeat";
import { commandEvent, errorEvent, guildEvent, MAX_STACK, trackEvent, truncate } from "../../services/telemetry/events";

const base: HeartbeatInput = {
  id: "1",
  username: "Bypass",
  avatar: null,
  startedAt: new Date("2026-09-14T00:00:00Z"),
  now: new Date("2026-09-14T01:00:00Z"),
  guildCount: 23,
  memberCount: 88000,
  wsPing: 42,
  wsStatus: 0,
  queues: { total: 3, playing: 2, paused: 1, voiceConnections: 3 },
  memory: { rss: 100, heapUsed: 50, heapTotal: 80 },
  cpuPercent: 3.2,
  node: "v22.0.0",
  platform: "linux",
  pid: 7,
  versions: { bot: "2.9.0", discordJs: "14.25.1", discordPlayer: "7.2.0", ytDlp: "2026.09.01" },
  services: { mongo: true, patreon: false, debugPanel: true }
};

describe("buildHeartbeat", () => {
  it("computes uptime and copies fields", () => {
    const hb = buildHeartbeat(base);
    expect(hb.online).toBe(true);
    expect(hb.uptimeSec).toBe(3600);
    expect(hb.ts).toBe("2026-09-14T01:00:00.000Z");
    expect(hb.queues.playing).toBe(2);
    expect(hb.process.cpuPercent).toBe(3.2);
    expect(hb.lastError).toBeUndefined();
  });

  it("never reports negative uptime", () => {
    const hb = buildHeartbeat({ ...base, now: new Date("2026-09-13T00:00:00Z") });
    expect(hb.uptimeSec).toBe(0);
  });

  it("includes lastError when given", () => {
    const hb = buildHeartbeat({ ...base, lastError: { ts: "x", scope: "player", message: "boom" } });
    expect(hb.lastError?.message).toBe("boom");
  });
});

describe("cpuPercent", () => {
  it("converts microsecond deltas to percent of one core", () => {
    const prev = { user: 0, system: 0 };
    const curr = { user: 100_000, system: 100_000 }; // 200 ms of CPU
    expect(cpuPercent(prev, curr, 1000)).toBe(20);
  });
  it("returns 0 for zero or negative elapsed", () => {
    expect(cpuPercent({ user: 0, system: 0 }, { user: 5, system: 5 }, 0)).toBe(0);
  });
});

describe("events", () => {
  it("shapes a successful command", () => {
    const ev = commandEvent({ guildId: "g", userId: "u", command: "play", subcommand: null, ok: true, durationMs: 12.6 });
    expect(ev).toMatchObject({ kind: "command", guildId: "g", userId: "u", command: "play", ok: true, durationMs: 13 });
    expect(ev.subcommand).toBeUndefined();
    expect(ev.error).toBeUndefined();
  });

  it("captures the error message of a failed command", () => {
    const ev = commandEvent({ guildId: "g", userId: "u", command: "play", ok: false, durationMs: 1, error: new Error("nope") });
    expect(ev.error).toBe("nope");
  });

  it("shapes a track start", () => {
    const ev = trackEvent({
      guildId: "g",
      event: "start",
      title: "T",
      author: "A",
      url: "https://x",
      source: "youtube",
      trackDurationMs: 1000,
      requestedById: "u"
    });
    expect(ev).toMatchObject({ kind: "track", event: "start", source: "youtube", requestedById: "u" });
  });

  it("shapes a guild join", () => {
    expect(guildEvent({ guildId: "g", event: "join", name: "N", memberCount: 5 })).toMatchObject({ kind: "guild", event: "join" });
  });

  it("truncates stacks and falls back to a message", () => {
    const err = new Error("x");
    err.stack = "s".repeat(5000);
    const ev = errorEvent({ scope: "player", error: err, guildId: "g", track: "T" });
    expect(ev.stack!.length).toBe(MAX_STACK);
    expect(ev.message).toBe("x");
    expect(errorEvent({ scope: "process", error: undefined }).message).toBe("Unknown error");
    expect(errorEvent({ scope: "process", error: "plain" }).message).toBe("plain");
  });

  it("truncate keeps short strings and caps long ones", () => {
    expect(truncate("abc", 5)).toBe("abc");
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(truncate(undefined, 5)).toBeUndefined();
  });
});
