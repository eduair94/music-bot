import { describe, expect, it } from "vitest";
import { normalizePlayback } from "./fleet-state";

const GUILD = "123456789012345678";

describe("normalizePlayback", () => {
  it("keeps the fleet bot's contract shape", () => {
    const state = normalizePlayback(
      {
        guildId: GUILD,
        instance: 2,
        isConnected: true,
        voiceChannelId: "900000000000000001",
        isPlaying: true,
        isPaused: false,
        volume: 60,
        currentTrack: { title: "Song", author: "Artist", url: "https://youtu.be/x", duration: "3:45", durationMs: 225000, source: "youtube" },
        currentPosition: 1000,
        positionAt: 1_700_000_000_000,
        queue: [],
        queueSize: 0,
        loopMode: "queue",
        autoplay: true,
        filters: ["nightcore"],
        listeners: 3,
        lastUpdated: 1_700_000_000_000
      },
      GUILD,
      2
    );
    expect(state).toMatchObject({
      instance: 2,
      volume: 60,
      loopMode: "queue",
      autoplay: true,
      filters: ["nightcore"],
      listeners: 3,
      positionAt: 1_700_000_000_000,
      currentTrack: { duration: "3:45", durationMs: 225000 }
    });
  });

  it("converts pre-fleet documents (duration in ms, Date timestamps)", () => {
    const updated = new Date("2026-11-27T10:00:00Z");
    const state = normalizePlayback(
      {
        guildId: GUILD,
        isConnected: true,
        voiceChannelId: null,
        isPlaying: true,
        isPaused: false,
        volume: 80,
        currentTrack: { title: "Long", author: "A", url: "u", thumbnail: "", duration: 3_723_000, requestedBy: { id: "1", username: "x", avatar: null } },
        currentPosition: 5000,
        queue: [{ title: "Next", author: "B", url: "v", duration: 61_000 }],
        queueSize: 1,
        loopMode: "weird",
        lastUpdated: updated.toISOString()
      },
      GUILD,
      1
    );
    expect(state.instance).toBe(1);
    expect(state.voiceChannelId).toBeUndefined();
    expect(state.currentTrack).toMatchObject({ duration: "1:02:03", durationMs: 3_723_000, thumbnail: undefined, requestedBy: { id: "1", username: "x" } });
    expect(state.queue[0]).toMatchObject({ duration: "1:01", durationMs: 61_000 });
    expect(state.loopMode).toBe("off");
    expect(state.lastUpdated).toBe(updated.getTime());
    expect(state.positionAt).toBe(updated.getTime());
    expect(state.filters).toEqual([]);
  });
});
