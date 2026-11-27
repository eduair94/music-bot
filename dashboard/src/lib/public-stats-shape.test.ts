import { describe, expect, it } from "vitest";
import { compactCount, summarizeFleet } from "./public-stats-shape";

const NOW = Date.parse("2026-11-27T22:42:00.000Z");
const beat = (over: Record<string, unknown> = {}) => ({
  online: true,
  ts: "2026-11-27T22:41:50.000Z",
  startedAt: "2026-11-27T22:18:28.000Z",
  guildCount: 1,
  memberCount: 7,
  ws: { ping: 21, status: 0 },
  queues: { total: 1, playing: 1, paused: 0, voiceConnections: 1 },
  ...over,
});

const players = [
  { instance: 1, name: "Bypass" },
  { instance: 2, name: "Bypass 2" },
];

describe("summarizeFleet", () => {
  it("counts each server once across the fleet and sums its members", () => {
    const stats = summarizeFleet({
      players,
      heartbeats: new Map([
        [1, beat({ guildCount: 3 })],
        [2, beat()],
      ]),
      guildSets: new Map([
        [1, ["a", "b", "c"]],
        [2, ["a"]],
      ]),
      legacyGuilds: [],
      guildMembers: new Map([
        ["a", 10],
        ["b", 20],
        ["c", 30],
      ]),
      songsPlayed: 2075,
      now: NOW,
    });
    expect(stats.servers).toBe(3);
    expect(stats.members).toBe(60);
    expect(stats.playingNow).toBe(2);
    expect(stats.online).toBe(2);
    expect(stats.songsPlayed).toBe(2075);
    expect(stats.players.map((p) => [p.name, p.state, p.servers, p.pingMs])).toEqual([
      ["Bypass", "online", 3, 21],
      ["Bypass 2", "online", 1, 21],
    ]);
  });

  it("falls back to the legacy guild set and the heartbeat member count", () => {
    const stats = summarizeFleet({
      players: [players[0]],
      heartbeats: new Map([[1, beat({ guildCount: 2, memberCount: 99 })]]),
      guildSets: new Map(),
      legacyGuilds: ["a", "b"],
      guildMembers: new Map(),
      songsPlayed: null,
      now: NOW,
    });
    expect(stats.servers).toBe(2);
    expect(stats.members).toBe(99);
    expect(stats.songsPlayed).toBeNull();
  });

  it("never reports a stale, missing or offline-marked player as online or playing", () => {
    const stats = summarizeFleet({
      players: [...players, { instance: 3, name: "Bypass 3" }],
      heartbeats: new Map<number, Record<string, unknown> | null>([
        [1, beat({ ts: "2026-11-27T22:35:00.000Z" })],
        [2, { online: false, reason: "gateway lost", ts: "2026-11-27T22:41:55.000Z" }],
        [3, null],
      ]),
      guildSets: new Map([[1, ["a"]]]),
      legacyGuilds: [],
      guildMembers: new Map([["a", 5]]),
      songsPlayed: 1,
      now: NOW,
    });
    expect(stats.online).toBe(0);
    expect(stats.playingNow).toBe(0);
    expect(stats.players.map((p) => p.state)).toEqual(["stale", "offline", "offline"]);
    expect(stats.players[0].pingMs).toBeNull();
    expect(stats.players[0].lastSeenSec).toBe(420);
    expect(stats.players[2].startedAt).toBeNull();
  });
});

describe("compactCount", () => {
  it("keeps small numbers exact and shortens big ones", () => {
    expect(compactCount(25)).toBe("25");
    expect(compactCount(2075)).toBe("2,075");
    expect(compactCount(96600)).toBe("96.6K");
    expect(compactCount(1_250_000)).toBe("1.3M");
  });
});
