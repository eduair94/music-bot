/**
 * YouTube URL normalisation.
 *
 * discord-player's QueryResolver rebuilds YouTube links as
 *   `https://www.youtube.com/${searchParams.size === 1 ? "playlist" : "watch"}${search}`
 * so ANY extra query parameter on a playlist link turns it into a /watch URL
 * with no `v` — an invalid page that resolves to nothing ("No results found").
 * Share links from YouTube Music always carry `&si=…`, which is why they all
 * failed; plain youtube.com playlist links with `&si=` failed the same way.
 *
 * Normalising here keeps the fix in our code rather than patching the library.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
  "youtu.be",
]);

/** Parameters that affect playback; everything else is share/tracking noise. */
const PLAYBACK_PARAMS = new Set(["v", "list", "index", "t", "start"]);

/**
 * Rewrite a YouTube/YouTube Music link into the plain form discord-player
 * resolves correctly.  Non-YouTube queries and free-text searches are returned
 * untouched.
 */
export function normalizeYouTubeQuery(query: string): string {
  let url: URL;
  try {
    url = new URL(query);
  } catch {
    return query; // search terms, file paths, anything not a URL
  }

  if (!YOUTUBE_HOSTS.has(url.host.toLowerCase())) return query;

  // youtu.be/<id> carries the video id in the path
  if (url.host.toLowerCase() === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (id) {
      url.pathname = "/watch";
      url.searchParams.set("v", id);
    }
  }

  url.protocol = "https:";
  url.host = "www.youtube.com";

  for (const key of [...url.searchParams.keys()]) {
    if (!PLAYBACK_PARAMS.has(key)) url.searchParams.delete(key);
  }

  // A list without a video is a playlist page, whatever path the share link
  // used.  It must end up with exactly one parameter, or QueryResolver will
  // rebuild it as /watch and lose the playlist.
  const list = url.searchParams.get("list");
  if (list && !url.searchParams.has("v")) {
    url.pathname = "/playlist";
    url.search = "";
    url.searchParams.set("list", list);
  }

  return url.toString();
}
