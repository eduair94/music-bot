import { normalizeYouTubeQuery } from "../utils/youtubeUrl";

const cases: Array<[string, string]> = [
  // The reported failure: YouTube Music share link with tracking param
  [
    "https://music.youtube.com/playlist?list=PLuv6V25ckem2uMVJj51Ti2_fg4IexPG2u&si=_Amar3KtN59hGMml",
    "https://www.youtube.com/playlist?list=PLuv6V25ckem2uMVJj51Ti2_fg4IexPG2u",
  ],
  // Same breakage on plain youtube.com
  [
    "https://www.youtube.com/playlist?list=PLuv6V25ckem2uMVJj51Ti2_fg4IexPG2u&si=abc",
    "https://www.youtube.com/playlist?list=PLuv6V25ckem2uMVJj51Ti2_fg4IexPG2u",
  ],
  // An extra playback param must not turn a playlist into /watch either
  [
    "https://music.youtube.com/playlist?list=OLAK5uy_abc123&index=4",
    "https://www.youtube.com/playlist?list=OLAK5uy_abc123",
  ],
  // Video inside a playlist keeps both, so the queue starts at that video
  [
    "https://music.youtube.com/watch?v=gU7d2EHV_OQ&list=PLtest123&si=xyz",
    "https://www.youtube.com/watch?v=gU7d2EHV_OQ&list=PLtest123",
  ],
  // Plain video, tracking stripped
  ["https://youtu.be/gU7d2EHV_OQ?si=xyz", "https://www.youtube.com/watch?v=gU7d2EHV_OQ"],
  ["https://m.youtube.com/watch?v=gU7d2EHV_OQ&feature=share", "https://www.youtube.com/watch?v=gU7d2EHV_OQ"],
  // Timestamps are playback-relevant
  ["https://www.youtube.com/watch?v=gU7d2EHV_OQ&t=42", "https://www.youtube.com/watch?v=gU7d2EHV_OQ&t=42"],
  // Non-YouTube and free text pass through untouched
  ["https://open.spotify.com/playlist/abc?si=1", "https://open.spotify.com/playlist/abc?si=1"],
  ["never gonna give you up", "never gonna give you up"],
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = normalizeYouTubeQuery(input);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${input}`);
  if (!ok) console.log(`   expected: ${expected}\n   actual:   ${actual}`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
