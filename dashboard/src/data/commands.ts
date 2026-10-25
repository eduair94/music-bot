/**
 * Public slash-command catalogue shown on the landing site.
 * Every entry is a path the bot registers: structs/Bot.ts loads the top-level
 * files in commands/ (commands_disabled/ is not loaded). A command that is only
 * a group of subcommands is listed once per subcommand. A few registered
 * commands are left out because they do not do what they say yet
 * (e.g. /autoplay, /247, /importplaylist).
 */

export type CommandCategory =
  | "Music"
  | "Queue"
  | "Controls"
  | "Filters"
  | "Info"
  | "Utility"
  | "Settings"
  | "Premium";

export interface Command {
  name: string;
  description: string;
  usage: string;
  category: CommandCategory;
  isNew?: boolean;
  isPremium?: boolean;
  adminOnly?: boolean;
}

export const commands: Command[] = [
  // Music
  { name: "/play", description: "Play a song from YouTube, Spotify, or SoundCloud by name or link", usage: "/play <song or URL>", category: "Music" },
  { name: "/play_spotify", description: "Search and play music from Spotify", usage: "/play_spotify <song or URL>", category: "Music" },
  { name: "/play_file", description: "Play an uploaded audio file", usage: "/play_file <file> [title]", category: "Music" },
  { name: "/search", description: "Search and pick from multiple results", usage: "/search <query>", category: "Music" },
  { name: "/insert", description: "Insert a track right after the current song", usage: "/insert <song>", category: "Music", isNew: true },
  { name: "/playnext", description: "Play a track next, or start playback if nothing is on", usage: "/playnext <song or URL>", category: "Music" },
  { name: "/playnow", description: "Play a track right away, skipping the current one", usage: "/playnow <song or URL>", category: "Music" },
  { name: "/playlist", description: "Queue a whole YouTube or Spotify playlist", usage: "/playlist <playlist URL>", category: "Music" },
  { name: "/playrecent", description: "Re-queue the most recently played tracks", usage: "/playrecent [count]", category: "Music" },

  // Queue
  { name: "/queue", description: "View the current queue with pagination", usage: "/queue", category: "Queue" },
  { name: "/info queue", description: "Queue length, total duration, and contributors", usage: "/info queue", category: "Queue" },
  { name: "/info nextup", description: "Preview the next five tracks in the queue", usage: "/info nextup", category: "Queue" },
  { name: "/skip", description: "Skip the current song", usage: "/skip", category: "Queue" },
  { name: "/next", description: "Skip the current song and see what plays next", usage: "/next", category: "Queue" },
  { name: "/skipto", description: "Skip to a specific song in the queue", usage: "/skipto <position>", category: "Queue" },
  { name: "/jump", description: "Jump to a position in the queue", usage: "/jump <position>", category: "Queue" },
  { name: "/voteskip", description: "Start a vote to skip the current track", usage: "/voteskip", category: "Queue" },
  { name: "/previous", description: "Play the previous track from history", usage: "/previous", category: "Queue" },
  { name: "/remove", description: "Remove one or more songs from the queue by position", usage: "/remove <positions>", category: "Queue" },
  { name: "/queuemanage removerange", description: "Remove a range of tracks from the queue", usage: "/queuemanage removerange <start> <end>", category: "Queue" },
  { name: "/queuemanage removelast", description: "Remove the last N tracks from the queue", usage: "/queuemanage removelast <count>", category: "Queue" },
  { name: "/queuemanage removedupes", description: "Remove every duplicate track from the queue", usage: "/queuemanage removedupes", category: "Queue" },
  { name: "/queuemanage removeuser", description: "Remove every track a user queued", usage: "/queuemanage removeuser <user>", category: "Queue" },
  { name: "/queuemanage removeabsent", description: "Remove tracks from users who are not in voice", usage: "/queuemanage removeabsent", category: "Queue" },
  { name: "/move", description: "Move a track to a new position", usage: "/move <from> <to>", category: "Queue" },
  { name: "/queuemanage swap", description: "Swap the positions of two tracks", usage: "/queuemanage swap <pos1> <pos2>", category: "Queue" },
  { name: "/shuffle", description: "Shuffle the queue", usage: "/shuffle", category: "Queue" },
  { name: "/queuemanage reverse", description: "Reverse the queue order", usage: "/queuemanage reverse", category: "Queue" },
  { name: "/queuemanage sort", description: "Sort the queue by title or duration", usage: "/queuemanage sort <order>", category: "Queue" },
  { name: "/clear", description: "Clear every track from the queue", usage: "/clear", category: "Queue" },
  { name: "/restart", description: "Restart the current track from the beginning", usage: "/restart", category: "Queue" },

  // Controls
  { name: "/pause", description: "Pause the current track", usage: "/pause", category: "Controls" },
  { name: "/resume", description: "Resume paused playback", usage: "/resume", category: "Controls" },
  { name: "/stop", description: "Stop playback and clear the queue", usage: "/stop", category: "Controls" },
  { name: "/volume", description: "Show or set the playback volume", usage: "/volume [0-100]", category: "Controls" },
  { name: "/seek", description: "Seek to a specific time in the track", usage: "/seek <time>", category: "Controls" },
  { name: "/rewind", description: "Rewind the track by a number of seconds (10 by default)", usage: "/rewind [seconds]", category: "Controls" },
  { name: "/replay", description: "Replay the current track from the start", usage: "/replay", category: "Controls" },
  { name: "/loop", description: "Toggle loop for the current track", usage: "/loop", category: "Controls" },
  { name: "/loopqueue", description: "Toggle loop for the whole queue", usage: "/loopqueue", category: "Controls" },
  { name: "/repeat current", description: "Repeat the current track until you turn it off", usage: "/repeat current", category: "Controls" },
  { name: "/repeat queue", description: "Repeat the whole queue until you turn it off", usage: "/repeat queue", category: "Controls" },
  { name: "/repeat disable", description: "Turn off track or queue repeat", usage: "/repeat disable", category: "Controls" },
  { name: "/repeat status", description: "Show the current repeat mode", usage: "/repeat status", category: "Controls" },
  { name: "/join", description: "Bring the bot into your voice channel", usage: "/join", category: "Controls" },
  { name: "/leave", description: "Disconnect the bot from the voice channel", usage: "/leave", category: "Controls" },

  // Filters
  { name: "/effects bassboost", description: "Bass boost on the live stream; level Off removes it", usage: "/effects bassboost [level]", category: "Filters" },
  { name: "/effects nightcore", description: "Nightcore effect (faster and higher pitch)", usage: "/effects nightcore [on/off]", category: "Filters" },
  { name: "/effects vaporwave", description: "Vaporwave effect (slower and lower pitch)", usage: "/effects vaporwave [on/off]", category: "Filters" },
  { name: "/effects 8d", description: "8D audio that rotates the sound around you", usage: "/effects 8d [on/off]", category: "Filters" },
  { name: "/effects tremolo", description: "Tremolo effect (wavering volume)", usage: "/effects tremolo [on/off]", category: "Filters" },
  { name: "/effects vibrato", description: "Vibrato effect (wavering pitch)", usage: "/effects vibrato [on/off]", category: "Filters" },
  { name: "/effects karaoke", description: "Karaoke effect that reduces vocals", usage: "/effects karaoke [on/off]", category: "Filters" },
  { name: "/effects distortion", description: "Heavy, loud distortion effect", usage: "/effects distortion [on/off]", category: "Filters" },
  { name: "/effects lofi", description: "Lo-fi effect (slightly slower, lower, and wider)", usage: "/effects lofi [on/off]", category: "Filters" },
  { name: "/effects haas", description: "Haas effect for a wider stereo image", usage: "/effects haas [on/off]", category: "Filters" },
  { name: "/effects surrounding", description: "Surround sound effect", usage: "/effects surrounding [on/off]", category: "Filters" },
  { name: "/effects pulsator", description: "Pulsator effect that pulses the sound between ears", usage: "/effects pulsator [on/off]", category: "Filters" },
  { name: "/effects reverse", description: "Play the track's audio backwards", usage: "/effects reverse [on/off]", category: "Filters" },
  { name: "/effects list", description: "List the active effects", usage: "/effects list", category: "Filters" },
  { name: "/effects clear", description: "Remove every active effect", usage: "/effects clear", category: "Filters" },
  { name: "/filters", description: "List every active audio filter", usage: "/filters", category: "Filters" },
  { name: "/clearfilters", description: "Remove all audio filters", usage: "/clearfilters", category: "Filters" },

  // Info
  { name: "/nowplaying", description: "Show the playing track with progress and controls", usage: "/nowplaying", category: "Info" },
  { name: "/info song", description: "Details for the playing track: artist, length, requester, and source", usage: "/info song", category: "Info" },
  { name: "/lyrics", description: "Lyrics for the song that is playing", usage: "/lyrics", category: "Info" },
  { name: "/stats history", description: "Recently played tracks", usage: "/stats history", category: "Info" },
  { name: "/save", description: "Save the current song to your DMs", usage: "/save", category: "Info" },
  { name: "/grab", description: "Send the current track info to your DMs", usage: "/grab", category: "Info" },
  { name: "/stats bot", description: "Bot statistics and performance", usage: "/stats bot", category: "Info" },
  { name: "/stats session", description: "This session's queue size, total length, and loop mode", usage: "/stats session", category: "Info" },
  { name: "/stats leaderboard", description: "Who queued the most tracks in the current queue", usage: "/stats leaderboard", category: "Info" },
  { name: "/info about", description: "About Bypass: servers, uptime, and versions", usage: "/info about", category: "Info" },

  // Utility
  { name: "/help", description: "List every command with a description", usage: "/help", category: "Utility" },
  { name: "/ping", description: "Check bot latency", usage: "/ping", category: "Utility" },
  { name: "/stats uptime", description: "How long the bot has been online", usage: "/stats uptime", category: "Utility" },
  { name: "/invite", description: "Get the link to add Bypass to another server", usage: "/invite", category: "Utility" },
  { name: "/dashboard", description: "Get the link to the web dashboard", usage: "/dashboard", category: "Utility" },
  { name: "/info support", description: "Get an invite to the support server", usage: "/info support", category: "Utility" },
  { name: "/info faq", description: "Answers to common questions", usage: "/info faq", category: "Utility" },

  // Settings (admin)
  { name: "/settings view", description: "Show the current server settings", usage: "/settings view", category: "Settings", adminOnly: true },
  { name: "/settings djrole", description: "Pick the DJ role allowed to control music", usage: "/settings djrole", category: "Settings", adminOnly: true },
  { name: "/settings adminrole", description: "Pick the role allowed to change settings", usage: "/settings adminrole", category: "Settings", adminOnly: true },
  { name: "/settings volume", description: "Set the default and maximum volume", usage: "/settings volume [default] [max]", category: "Settings", adminOnly: true },
  { name: "/settings queue", description: "Set the queue size limit and block duplicates", usage: "/settings queue [maxsize] [preventduplicates]", category: "Settings", adminOnly: true },
  { name: "/settings behavior", description: "Announcements, auto-leave, and leave timeout", usage: "/settings behavior [announcements] [autoleave] [leavetimeout]", category: "Settings", adminOnly: true },
  { name: "/settings voicechannels", description: "Restrict the bot to specific voice channels", usage: "/settings voicechannels", category: "Settings", adminOnly: true },
  { name: "/settings textchannels", description: "Restrict commands to specific text channels", usage: "/settings textchannels", category: "Settings", adminOnly: true },
  { name: "/settings logchannel", description: "Pick the channel for now-playing and bot logs", usage: "/settings logchannel", category: "Settings", adminOnly: true },
  { name: "/settings blacklist", description: "Block, unblock, or list users barred from the bot", usage: "/settings blacklist [add] [remove]", category: "Settings", adminOnly: true },
  { name: "/settings language", description: "Pick the bot language for this server", usage: "/settings language", category: "Settings", adminOnly: true },
  { name: "/settings embedcolor", description: "Custom accent color for bot embeds", usage: "/settings embedcolor <hex>", category: "Settings", adminOnly: true },
  { name: "/settings stats", description: "Music statistics for this server", usage: "/settings stats", category: "Settings", adminOnly: true },
  { name: "/settings reset", description: "Reset every setting to default", usage: "/settings reset", category: "Settings", adminOnly: true },

  // Premium
  { name: "/premium link", description: "Link this server to your Patreon account", usage: "/premium link", category: "Premium", isPremium: true },
  { name: "/premium unlink", description: "Unlink this server from your Patreon account", usage: "/premium unlink", category: "Premium", isPremium: true },
  { name: "/premium status", description: "Premium status for this server", usage: "/premium status", category: "Premium" },
  { name: "/premium list", description: "Every server linked to your Patreon account", usage: "/premium list", category: "Premium" },
  { name: "/premium config", description: "Set this server's premium bitrate and bot identity", usage: "/premium config [bitrate] [identity]", category: "Premium", isPremium: true },
  { name: "/patreon status", description: "Your Patreon status and benefits", usage: "/patreon status", category: "Premium" },
  { name: "/patreon sync", description: "Refresh your Patreon benefits", usage: "/patreon sync", category: "Premium" },
  { name: "/patreon info", description: "How Patreon benefits and linking work", usage: "/patreon info", category: "Premium" },
  { name: "/perks view", description: "What the Free and Founder tiers include", usage: "/perks view", category: "Premium" },
  { name: "/perks user", description: "The premium perks on your account", usage: "/perks user", category: "Premium" },
];

export const COMMAND_COUNT = commands.length;

/** Audio effects a server can switch on with /effects (its list and clear subcommands are not effects). */
export const EFFECT_COUNT = commands.filter(
  (c) => c.name.startsWith("/effects ") && c.name !== "/effects list" && c.name !== "/effects clear"
).length;

export const categories: Array<CommandCategory | "All"> = [
  "All",
  "Music",
  "Queue",
  "Controls",
  "Filters",
  "Info",
  "Utility",
  "Settings",
  "Premium",
];

export const categoryDescriptions: Record<CommandCategory | "All", string> = {
  All: "Every command Bypass answers to",
  Music: "Start playback from YouTube, Spotify, SoundCloud, or a file",
  Queue: "Reorder, trim, and inspect what plays next",
  Controls: "Transport, volume, seeking, and loops",
  Filters: "Audio effects that stack on the live stream",
  Info: "What is playing, lyrics, history, and stats",
  Utility: "Help, latency, and invite links",
  Settings: "Server configuration for admins",
  Premium: "Patreon linking and premium configuration",
};
