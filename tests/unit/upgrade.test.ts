import { describe, expect, it } from "vitest";
import { formatDuration, isHttpUrl, linkLabel, parseTimestamp, progressBar, truncate } from "../../utils/format";
import { currentLocale, i18n, resolveLocale, runWithLocale, toBotLocale } from "../../utils/i18n";
import { youTubeVideoId } from "../../services/discordPlayer";
import { queryFromMessage } from "../../contextMenus/playInVoice";

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(83_000)).toBe("1:23");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatDuration(NaN)).toBe("0:00");
  });
  it("parses timestamps", () => {
    expect(parseTimestamp("1:23")).toBe(83_000);
    expect(parseTimestamp("01:02:03")).toBe(3_723_000);
    expect(parseTimestamp("90")).toBe(90_000);
    expect(parseTimestamp("1:xx")).toBeNull();
  });
  it("draws a bounded progress bar", () => {
    expect(progressBar(0, 100, 10)).toBe("●" + "─".repeat(9));
    expect(progressBar(100, 100, 10)).toBe("━".repeat(9) + "●");
    expect(progressBar(500, 100, 10)).toHaveLength(10);
    expect(progressBar(5, 0, 6)).toBe("──────");
  });
  it("makes safe link labels", () => {
    expect(linkLabel("a [b] *c*")).toBe("a b \\*c\\*");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://x.y")).toBe(true);
  });
});

describe("locale resolution", () => {
  it("maps Discord locales", () => {
    expect(toBotLocale("es-ES")).toBe("es");
    expect(toBotLocale("es-419")).toBe("es");
    expect(toBotLocale("pt-BR")).toBe("pt_br");
    expect(toBotLocale("zh-TW")).toBe("zh_tw");
    expect(toBotLocale("no")).toBe("nb");
    expect(toBotLocale("en-GB")).toBe("en");
    expect(toBotLocale("hu")).toBeNull();
  });
  it("prefers the server setting, then the user, then the server locale", () => {
    expect(resolveLocale({ guildSetting: "fr", userLocale: "es-ES" })).toBe("fr");
    expect(resolveLocale({ guildSetting: "auto", userLocale: "es-ES", guildLocale: "de" })).toBe("es");
    expect(resolveLocale({ guildSetting: "auto", userLocale: "hu", guildLocale: "de" })).toBe("de");
    expect(resolveLocale({})).toBe("en");
  });
  it("scopes the active language to the request", async () => {
    expect(currentLocale()).toBe("en");
    await runWithLocale("es", async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(currentLocale()).toBe("es");
    });
    expect(currentLocale()).toBe("en");
  });
  it("falls back to English for keys a locale lacks", () => {
    const english = i18n.t("en", "player.nowPlaying");
    expect(english).toBe("Now playing");
    expect(runWithLocale("mi", () => i18n.__("player.nowPlaying")).length).toBeGreaterThan(0);
  });
});

describe("youTubeVideoId", () => {
  it("extracts ids", () => {
    expect(youTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RD1")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeVideoId("https://open.spotify.com/track/abc")).toBeNull();
    expect(youTubeVideoId("not a url")).toBeNull();
  });
});

describe("queryFromMessage", () => {
  const msg = (content: string, attachments: any[] = [], embeds: any[] = []) =>
    ({
      content,
      attachments: { find: (fn: any) => attachments.find(fn) },
      embeds
    }) as any;

  it("prefers links, then media, then embeds, then text", () => {
    expect(queryFromMessage(msg("check https://youtu.be/abc out"))).toBe("https://youtu.be/abc");
    expect(queryFromMessage(msg("", [{ contentType: "audio/mpeg", name: "a.mp3", url: "https://cdn/a.mp3" }]))).toBe("https://cdn/a.mp3");
    expect(queryFromMessage(msg("", [], [{ url: "https://open.spotify.com/track/x" }]))).toBe("https://open.spotify.com/track/x");
    expect(queryFromMessage(msg("<@123> daft punk one more time"))).toBe("daft punk one more time");
    expect(queryFromMessage(msg("<@123>"))).toBeNull();
  });
});
