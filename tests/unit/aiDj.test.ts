import { describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import {
  buildClaudeParams,
  ClaudeCallError,
  ClaudeCredits,
  classifyClaudeError,
  parseCreditKeys,
  regainAccessAt,
  sumUsage
} from "../../services/ai/claudeCredits";
import { buildPlaylistPrompt, normalizeSong, sanitizePlaylist } from "../../services/ai/playlistGenerator";
import { ANCHOR_EVERY, RADIO_STATIONS, radioSeedId, RadioSession, shuffledSeeds, STATION_IDS } from "../../services/radioLogic";
import { guildOfOwnerKey, isServerOwnerKey, serverOwnerKey } from "../../services/serverPlaylists";

describe("credit keys", () => {
  it("parses labelled and bare keys, dropping duplicates", () => {
    expect(parseCreditKeys("shellix=sk-a, aira=sk-b\nsk-c;sk-a")).toEqual([
      { label: "shellix", apiKey: "sk-a" },
      { label: "aira", apiKey: "sk-b" },
      { label: "k3", apiKey: "sk-c" }
    ]);
    expect(parseCreditKeys(undefined)).toEqual([]);
  });

  it("only moves to the next key for key-specific errors", () => {
    expect(classifyClaudeError({ status: 400, message: "Your credit balance is too low" })).toBe("credits");
    expect(classifyClaudeError({ status: 402 })).toBe("credits");
    expect(classifyClaudeError({ status: 401 })).toBe("auth");
    expect(classifyClaudeError({ status: 429 })).toBe("rate");
    expect(classifyClaudeError({ status: 529 })).toBe("transient");
    expect(classifyClaudeError({ status: 400, message: "bad schema" })).toBe("fatal");
  });

  it("reads when a Console spend limit lifts", () => {
    expect(regainAccessAt({ message: "You will regain access on 2026-12-01 at 00:00 UTC." })).toBe(Date.parse("2026-12-01T00:00:00Z"));
    expect(regainAccessAt({ message: "nope" })).toBeUndefined();
  });

  it("asks for structured JSON and server-side fallbacks on Opus 5.5", () => {
    const params = buildClaudeParams({ feature: "t", model: "claude-opus-5-5", system: "s", prompt: "p", schema: { type: "object" }, maxTokens: 100, effort: "low" });
    expect(params.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: { type: "object" } } });
    expect(params.fallbacks).toBe("default");
    expect(params).not.toHaveProperty("thinking");
    const haiku = buildClaudeParams({ feature: "t", model: "claude-haiku-5-5", system: "s", prompt: "p", schema: {}, maxTokens: 100 });
    expect(haiku).not.toHaveProperty("fallbacks");
  });

  it("bills every iteration when a fallback answered", () => {
    expect(sumUsage({ input_tokens: 10, output_tokens: 5 })).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(
      sumUsage({
        input_tokens: 99,
        output_tokens: 99,
        iterations: [
          { type: "message", input_tokens: 10, output_tokens: 1 },
          { type: "fallback_message", input_tokens: 10, output_tokens: 20 }
        ]
      })
    ).toEqual({ inputTokens: 20, outputTokens: 21 });
  });
});

describe("ClaudeCredits.generateJson", () => {
  const store = { spendByKey: vi.fn(async () => ({})), record: vi.fn(async () => undefined) };
  const ok = (text: string, stop = "end_turn") => ({ model: "claude-opus-5-5", stop_reason: stop, usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: "text", text }] });
  const req = { feature: "test", model: "claude-opus-5-5", system: "s", prompt: "p", schema: {}, maxTokens: 100 };

  it("skips a key that is out of credits and answers from the next one", async () => {
    const calls: string[] = [];
    const credits = new ClaudeCredits({
      keys: [
        { label: "a", apiKey: "ka" },
        { label: "b", apiKey: "kb" }
      ],
      store,
      makeClient: (apiKey) =>
        ({
          beta: {
            messages: {
              create: async () => {
                calls.push(apiKey);
                if (apiKey === "ka") throw Object.assign(new Error("Your credit balance is too low"), { status: 400 });
                return ok('{"title":"x","description":"","tracks":[]}');
              }
            }
          }
        }) as any
    });
    const result = await credits.generateJson<{ title: string }>(req);
    expect(result.data.title).toBe("x");
    expect(result.key).toBe("b");
    expect(calls).toEqual(["ka", "kb"]);
    // The exhausted key rests: the next call goes straight to b.
    calls.length = 0;
    await credits.generateJson(req);
    expect(calls).toEqual(["kb"]);
  });

  it("reports refusals and unconfigured pools", async () => {
    const credits = new ClaudeCredits({
      keys: [{ label: "a", apiKey: "ka" }],
      store,
      makeClient: () => ({ beta: { messages: { create: async () => ok("", "refusal") } } }) as any
    });
    await expect(credits.generateJson(req)).rejects.toMatchObject({ reason: "refused" });
    await expect(new ClaudeCredits({ keys: [], store }).generateJson(req)).rejects.toBeInstanceOf(ClaudeCallError);
  });
});

describe("AI playlists", () => {
  it("normalizes songs so versions and features match", () => {
    expect(normalizeSong("Daft Punk", "One More Time (Radio Edit)")).toBe(normalizeSong("daft punk", "One More Time"));
    expect(normalizeSong("Calvin Harris", "Feels feat. Pharrell")).toBe(normalizeSong("Calvin Harris", "Feels"));
  });

  it("drops empty, duplicate and excluded songs and caps the count", () => {
    const playlist = sanitizePlaylist(
      {
        title: "  Rainy Jazz  ",
        description: "d",
        tracks: [
          { artist: "Miles Davis", title: "So What" },
          { artist: "miles davis", title: "So What (Remastered)" },
          { artist: "", title: "No artist" },
          { artist: "Chet Baker", title: "Almost Blue" },
          { artist: "Bill Evans", title: "Peace Piece" },
          { artist: "John Coltrane", title: "Naima" }
        ]
      },
      3,
      ["Chet Baker - Almost Blue"]
    );
    expect(playlist.title).toBe("Rainy Jazz");
    expect(playlist.tracks).toEqual([
      { artist: "Miles Davis", title: "So What" },
      { artist: "Bill Evans", title: "Peace Piece" },
      { artist: "John Coltrane", title: "Naima" }
    ]);
    expect(sanitizePlaylist(null, 5)).toEqual({ title: "AI Mix", description: "", tracks: [] });
  });

  it("puts the count, language and already-played songs in the prompt", () => {
    const text = buildPlaylistPrompt({ prompt: "lofi to study", count: 12, language: "es", exclude: ["A - B"], feature: "ai_radio" });
    expect(text).toContain("Number of tracks: 12");
    expect(text).toContain("(locale code): es");
    expect(text).toContain("- A - B");
  });
});

describe("radio stations", () => {
  it("fits Discord's 25 choices and has a name in every station", () => {
    expect(STATION_IDS.length).toBeLessThanOrEqual(25);
    for (const id of STATION_IDS) {
      expect((en as any).radio.station[id], id).toBeTruthy();
      expect(RADIO_STATIONS[id].seeds.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("shuffles seeds without losing any", () => {
    const seeds = shuffledSeeds("rock", () => 0);
    expect([...seeds].sort()).toEqual([...RADIO_STATIONS.rock.seeds].sort());
  });

  it("seeds every third pick from an anchor, rotating through them", () => {
    const session: RadioSession = { kind: "station", label: "lofi", anchorIds: ["A", "B"], picks: 1, batches: 0, batchLimit: 0 };
    const seeds: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      seeds.push(radioSeedId(session, "cur"));
      session.picks++;
    }
    expect(ANCHOR_EVERY).toBe(3);
    // picks 1..7 → anchors on picks 3 and 6
    expect(seeds).toEqual(["cur", "cur", "A", "cur", "cur", "B", "cur"]);
    expect(radioSeedId(undefined, "cur")).toBe("cur");
    expect(radioSeedId({ ...session, picks: 1 }, null)).toBe("A");
  });
});

describe("server playlists", () => {
  it("keys server playlists by guild", () => {
    const key = serverOwnerKey("123");
    expect(key).toBe("guild:123");
    expect(isServerOwnerKey(key)).toBe(true);
    expect(isServerOwnerKey("123")).toBe(false);
    expect(guildOfOwnerKey(key)).toBe("123");
    expect(guildOfOwnerKey("456")).toBeNull();
  });
});

describe("review fixes", () => {
  it("keeps a radio session in a fleet play command (bus schema)", async () => {
    const { BotCommand } = await import("../../models/BotCommand");
    const doc = new BotCommand({
      guildId: "1",
      command: "play",
      params: { query: "x", autoplay: true, radio: { kind: "ai", label: "rainy jazz", pending: [{ artist: "A", title: "B" }] } },
      status: "pending"
    } as any);
    expect((doc.params as any).radio).toEqual({ kind: "ai", label: "rainy jazz", pending: [{ artist: "A", title: "B" }] });
  });

  it("counts free trials apart from premium uses", async () => {
    const { genBucket, quotaId } = await import("../../services/ai/aiAccess");
    expect(genBucket({ premium: false, unlimited: false, daily: 3, radioBatches: 3 })).toBe("gen");
    expect(genBucket({ premium: true, unlimited: false, daily: 50, radioBatches: 40 })).toBe("genp");
    expect(quotaId("genp", "9", new Date("2026-11-27T23:59:00Z"))).toBe("genp:9:2026-11-27");
  });

  it("strips the private flag for edits of a deferred reply", async () => {
    const { publicReply } = await import("../../utils/aiReplies");
    expect(publicReply({ content: "x", flags: 64 } as any)).toEqual({ content: "x" });
  });
});
