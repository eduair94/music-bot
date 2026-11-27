import { describe, expect, it, vi } from "vitest";

// queueCollectionRest builds lazy queue tracks with the player and the YouTube extractor.
vi.mock("../../services/discordPlayer", () => ({
  DiscordPlayerService: { getInstance: () => ({ getPlayer: () => ({}), getYouTubeExtractor: () => ({ identifier: "yt" }) }) },
  isGuessGameQueue: () => false
}));
// The fleet dispatcher pulls in Mongo, Redis and discord.js services this test doesn't need.
vi.mock("../../services/fleet/dispatcher", () => ({ dispatchPlay: vi.fn() }));
vi.mock("../../utils/playFlow", () => ({ runPlay: vi.fn(), PlayRejection: class {}, playRejectionMessage: () => "" }));
vi.mock("../../services/guildSettings", () => ({ GuildSettingsService: { getInstance: () => ({}) } }));
vi.mock("../../utils/premiumCheck", () => ({ hasPremiumFeature: vi.fn() }));

import { playQueryFor, queueCollectionRest, streamUrlFor } from "../../services/collectionPlayback";

/** A queue that records where tracks go: [first, ...existing]. */
function fakeQueue(existing: string[]) {
  const tracks = [...existing];
  return {
    tracks,
    insertTrack: (track: { title: string }, index: number) => tracks.splice(index, 0, track.title),
    addTrack: (list: { title: string }[]) => tracks.push(...list.map((t) => t.title))
  };
}

const song = (title: string) => ({ title, author: "Artist", url: `https://www.youtube.com/watch?v=${title}`, duration: 200 });
const user = { id: "1", username: "u" } as any;

describe("queueCollectionRest", () => {
  it("puts the rest right behind the first song when it was queued next", () => {
    const queue = fakeQueue(["first", "old1", "old2"]);
    const added = queueCollectionRest(queue as any, [song("a"), song("b")], user, true, 10);
    expect(added).toBe(2);
    expect(queue.tracks).toEqual(["first", "a", "b", "old1", "old2"]);
  });

  it("appends the rest otherwise", () => {
    const queue = fakeQueue(["old1"]);
    queueCollectionRest(queue as any, [song("a"), song("b")], user, false, 10);
    expect(queue.tracks).toEqual(["old1", "a", "b"]);
  });

  it("never queues more than the room left", () => {
    const queue = fakeQueue([]);
    expect(queueCollectionRest(queue as any, [song("a"), song("b"), song("c")], user, false, 2)).toBe(2);
    expect(queueCollectionRest(queue as any, [song("d")], user, false, 0)).toBe(0);
    expect(queueCollectionRest(queue as any, [song("e")], user, false, -3)).toBe(0);
    expect(queue.tracks).toEqual(["a", "b"]);
  });
});

describe("collection track queries", () => {
  it("plays YouTube links as they are and searches anything else", () => {
    expect(playQueryFor(song("x"))).toBe("https://www.youtube.com/watch?v=x");
    const spotify = { title: "Song", author: "Band", url: "https://open.spotify.com/track/1" };
    expect(streamUrlFor(spotify)).toBe("ytsearch1:Band - Song audio");
    expect(playQueryFor(spotify)).toBe("Band - Song");
  });
});
