import { describe, expect, it } from "vitest";
import { checkCommandParams, commandContext, isAloneWithBot, searchData, type PlaybackSnapshot } from "./dashboard-commands";

const ME = "111111111111111111";
const OTHER = "222222222222222222";
const VOICE = "900000000000000001";

const track = (id: string) => ({ title: "Song", author: "Artist", url: "https://youtu.be/x", duration: "3:00", requestedBy: { id, username: "u" } });

describe("checkCommandParams: queue positions", () => {
  it("turns the contract's 1-based positions into the bot's 0-based indexes", () => {
    expect(checkCommandParams("remove", { position: 1 }, 100)).toEqual({ ok: true, params: { position: 0 } });
    expect(checkCommandParams("skipto", { position: 3 }, 100)).toEqual({ ok: true, params: { position: 2 } });
    expect(checkCommandParams("move", { from: 4, to: 1 }, 100)).toEqual({ ok: true, params: { from: 3, to: 0 } });
    expect(checkCommandParams("remove", { positions: [2, 5, 2] }, 100)).toEqual({ ok: true, params: { positions: [1, 4] } });
  });

  it("refuses positions that are not integers of at least 1", () => {
    for (const position of [0, -1, 1.5, "2", null]) {
      expect(checkCommandParams("remove", { position }, 100).ok).toBe(false);
      expect(checkCommandParams("skipto", { position }, 100).ok).toBe(false);
    }
    expect(checkCommandParams("move", { from: 0, to: 1 }, 100).ok).toBe(false);
    expect(checkCommandParams("move", { from: 1 }, 100).ok).toBe(false);
    expect(checkCommandParams("remove", { positions: [] }, 100).ok).toBe(false);
    expect(checkCommandParams("remove", { positions: [1, 0] }, 100).ok).toBe(false);
  });

  it("leaves seek's position (milliseconds) alone and drops stray lists", () => {
    expect(checkCommandParams("seek", { position: 0 }, 100)).toEqual({ ok: true, params: { position: 0 } });
    expect(checkCommandParams("skipto", { position: 1, positions: [1] }, 100)).toEqual({ ok: true, params: { position: 0 } });
  });
});

describe("commandContext", () => {
  const member = { userId: ME, voiceChannelId: VOICE };
  const playback: PlaybackSnapshot = { voiceChannelId: VOICE, listeners: 1, currentTrack: track(ME), queue: [track(OTHER), track(ME)] };

  it("is alone with the bot only as the single listener of its channel", () => {
    expect(isAloneWithBot(member, playback)).toBe(true);
    expect(isAloneWithBot(member, { ...playback, listeners: 2 })).toBe(false);
    expect(isAloneWithBot({ ...member, voiceChannelId: null }, playback)).toBe(false);
    expect(isAloneWithBot(member, { ...playback, voiceChannelId: "900000000000000002" })).toBe(false);
    expect(commandContext(member, "pause", {}, playback).aloneWithBot).toBe(true);
  });

  it("uses the requester id of the targeted songs (0-based indexes)", () => {
    expect(commandContext(member, "skip", {}, playback).isRequester).toBe(true);
    expect(commandContext(member, "remove", { position: 1 }, playback).isRequester).toBe(true);
    expect(commandContext(member, "remove", { position: 0 }, playback).isRequester).toBe(false);
    expect(commandContext(member, "remove", { positions: [0, 1] }, playback).isRequester).toBe(false);
    expect(commandContext(member, "remove", { positions: [1] }, playback).isRequester).toBe(true);
    expect(commandContext(member, "skipto", { position: 1 }, playback).isRequester).toBe(false);
    expect(commandContext(member, "skip", {}, null)).toEqual({});
  });
});

describe("searchData", () => {
  it("returns contract tracks whatever shape the bot stored", () => {
    const data = searchData({
      results: [
        { title: "A", author: "B", url: "https://youtu.be/a", thumbnail: "t", duration: "3:45", durationMs: 225000, source: "youtube" },
        { title: "Old", author: "C", url: "https://youtu.be/b", duration: 61000 },
        { title: "No url" }
      ]
    });
    expect(data.results).toHaveLength(2);
    expect(data.results[0]).toMatchObject({ title: "A", duration: "3:45", durationMs: 225000, source: "youtube", thumbnail: "t" });
    expect(data.results[1]).toMatchObject({ duration: "1:01", durationMs: 61000 });
    expect(searchData(undefined)).toEqual({ results: [] });
  });
});
