/**
 * Release notes. The bot posts each entry once to the support server's
 * #changelog (newest last) and publishes it to servers that follow the channel.
 * Add a new entry at the end for every user-visible release; keep it short
 * and only about what users can see.
 */
export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "3.0.0",
    date: "2026-11-26",
    title: "The new Bypass",
    items: [
      "**Player card with buttons** under every song: previous, pause, skip, stop, loop, shuffle, volume, autoplay, queue, lyrics and save-to-DMs. The buttons no longer stop working after two minutes.",
      "**`/play` shows YouTube results while you type**, with options to play next or search SoundCloud.",
      "**Apple Music and Deezer links** now play, including albums and playlists.",
      "**Autoplay and `/radio`**: related songs keep playing when the queue ends.",
      "**24/7 mode** keeps the bot in your channel and brings it back after restarts.",
      "**28 languages**: every member sees Bypass in their Discord language, or pick one with `/language`.",
      "**Right-click a message → Apps → Play in voice channel** to play a link or audio file.",
      "The voice channel status shows the song that's playing.",
      "Server settings (default volume, max song length, duplicates, auto-leave) now take effect.",
      "`/search`, `/rewind`, `/voteskip` and bass boost levels fixed; 25 broken or duplicate commands removed.",
      "Vote on top.gg to unlock 24/7 and studio quality for 12 hours: `/vote`."
    ]
  },
  {
    version: "3.1.0",
    date: "2026-11-26",
    title: "Boost perks and private tickets",
    items: [
      "**Boost this server to get Founder perks in Bypass** for as long as you boost: 24/7 mode, studio quality, no song-length limit and audio filters. Boosters also get priority tickets and the 💎 booster lounge.",
      "**Private tickets:** pick a topic in #tickets and Bypass opens a thread only you and staff can see.",
      "New server guide, rules screening and cleaner channels. Invite link: discord.gg/KwKwtasGZE"
    ]
  }
];
