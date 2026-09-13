import { isSameSong, lyricsQueries, parseTrackForLyrics } from "../utils/lyricsQuery";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) console.log(`   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
}

const parseCases: Array<[string, string, { title: string; artist: string }]> = [
  // The reported failure: a plain track title plus its artist
  ["Floating There", "Concorde", { title: "Floating There", artist: "Concorde" }],
  // YouTube auto-generated "Topic" channels and VEVO/Official channels name the artist
  ["Floating There", "Concorde - Topic", { title: "Floating There", artist: "Concorde" }],
  ["Bohemian Rhapsody [Official Video Remastered]", "Queen Official", { title: "Bohemian Rhapsody", artist: "Queen" }],
  ["Mr. Brightside", "TheKillersVEVO", { title: "Mr. Brightside", artist: "TheKillers" }],
  // "Artist - Title" uploads: the title names the artist, the uploader does not
  ["Concorde - Floating There (Lyrics)", "Lyrics Vault", { title: "Floating There", artist: "Concorde" }],
  ["The Killers - Mr. Brightside (Official Music Video)", "TheKillersVEVO", { title: "Mr. Brightside", artist: "The Killers" }],
  // Video decorations go; the song title stays
  ["Blinding Lights | Lyric Video", "The Weeknd", { title: "Blinding Lights", artist: "The Weeknd" }],
  ["Tití Me Preguntó (Letra/Lyrics)", "Bad Bunny", { title: "Tití Me Preguntó", artist: "Bad Bunny" }],
  // A version suffix is not an "Artist - Title" split
  ["Mr. Brightside - Remastered 2004", "The Killers", { title: "Mr. Brightside", artist: "The Killers" }],
  ["Floating There", "", { title: "Floating There", artist: "" }],
];
for (const [title, author, expected] of parseCases) {
  check(`parse ${JSON.stringify(title)} / ${JSON.stringify(author)}`, parseTrackForLyrics(title, author), expected);
}

// Artist-qualified search first; the bare title catches a misleading uploader name
check("queries with artist", lyricsQueries({ title: "Floating There", artist: "Concorde" }), ["Floating There Concorde", "Floating There"]);
check("queries without artist", lyricsQueries({ title: "Floating There", artist: "" }), ["Floating There"]);

const sameCases: Array<[string, string, boolean]> = [
  ["Floating There", "Floating There", true],
  ["Mr. Brightside", "Mr. Brightside - Remastered 2004", true],
  ["Tití Me Preguntó", "Titi Me Pregunto", true],
  ["夜に駆ける", "夜に駆ける", true],
  ["Floating There", "Somebody Told Me", false],
  ["Me", "Somebody Told Me", false],
];
for (const [wanted, found, expected] of sameCases) {
  check(`same song ${JSON.stringify(wanted)} ~ ${JSON.stringify(found)}`, isSameSong(wanted, found), expected);
}

const total = parseCases.length + 2 + sameCases.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed === 0 ? 0 : 1);
