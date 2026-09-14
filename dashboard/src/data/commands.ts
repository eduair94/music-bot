/**
 * Public slash-command catalogue shown on the landing site.
 * Mirrors the user-facing commands registered by the bot
 * (owner-only maintenance commands are intentionally left out).
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
  { name: "/play_file", description: "Play an uploaded audio file", usage: "/play_file <attachment>", category: "Music" },
  { name: "/search", description: "Search and pick from multiple results", usage: "/search <query>", category: "Music" },
  { name: "/insert", description: "Insert a track right after the current song", usage: "/insert <song>", category: "Music", isNew: true },
  { name: "/playlist", description: "Queue a whole YouTube or Spotify playlist", usage: "/playlist <playlist URL>", category: "Music" },

  // Queue
  { name: "/queue", description: "View the current queue with pagination", usage: "/queue [page]", category: "Queue" },
  { name: "/queueinfo", description: "Detailed queue statistics and total duration", usage: "/queueinfo", category: "Queue" },
  { name: "/skip", description: "Skip the current song", usage: "/skip", category: "Queue" },
  { name: "/skipto", description: "Skip to a specific song in the queue", usage: "/skipto <position>", category: "Queue" },
  { name: "/jump", description: "Jump to a position in the queue", usage: "/jump <position>", category: "Queue" },
  { name: "/voteskip", description: "Start a vote to skip the current track", usage: "/voteskip", category: "Queue" },
  { name: "/previous", description: "Play the previous track from history", usage: "/previous", category: "Queue" },
  { name: "/nextup", description: "Preview the next track in the queue", usage: "/nextup", category: "Queue" },
  { name: "/remove", description: "Remove a song from the queue by position", usage: "/remove <position>", category: "Queue" },
  { name: "/removecurrent", description: "Remove the playing track and skip to the next", usage: "/removecurrent", category: "Queue", isNew: true },
  { name: "/removerange", description: "Remove a range of tracks from the queue", usage: "/removerange <start> <end>", category: "Queue" },
  { name: "/removelast", description: "Remove the last track added (undo)", usage: "/removelast", category: "Queue" },
  { name: "/removeduplicates", description: "Remove every duplicate track from the queue", usage: "/removeduplicates", category: "Queue" },
  { name: "/move", description: "Move a track to a new position", usage: "/move <from> <to>", category: "Queue" },
  { name: "/swap", description: "Swap the positions of two tracks", usage: "/swap <pos1> <pos2>", category: "Queue" },
  { name: "/shuffle", description: "Shuffle the queue", usage: "/shuffle", category: "Queue" },
  { name: "/reverse", description: "Reverse the queue order", usage: "/reverse", category: "Queue" },
  { name: "/sort", description: "Sort the queue by title, author, or length", usage: "/sort <type>", category: "Queue" },
  { name: "/clear", description: "Clear every track from the queue", usage: "/clear", category: "Queue" },
  { name: "/restart", description: "Restart the current track from the beginning", usage: "/restart", category: "Queue" },

  // Controls
  { name: "/pause", description: "Pause the current track", usage: "/pause", category: "Controls" },
  { name: "/resume", description: "Resume paused playback", usage: "/resume", category: "Controls" },
  { name: "/stop", description: "Stop playback and clear the queue", usage: "/stop", category: "Controls" },
  { name: "/volume", description: "Set the playback volume", usage: "/volume <0-100>", category: "Controls" },
  { name: "/seek", description: "Seek to a specific time in the track", usage: "/seek <time>", category: "Controls" },
  { name: "/forward", description: "Fast forward by a number of seconds", usage: "/forward <seconds>", category: "Controls" },
  { name: "/backward", description: "Rewind by a number of seconds", usage: "/backward <seconds>", category: "Controls" },
  { name: "/rewind", description: "Rewind the track by a number of seconds", usage: "/rewind <seconds>", category: "Controls" },
  { name: "/replay", description: "Replay the current track from the start", usage: "/replay", category: "Controls" },
  { name: "/loop", description: "Toggle loop for the current track", usage: "/loop", category: "Controls" },
  { name: "/loopqueue", description: "Toggle loop for the whole queue", usage: "/loopqueue", category: "Controls" },
  { name: "/autoplay", description: "Keep playing similar songs when the queue ends", usage: "/autoplay", category: "Controls" },
  { name: "/join", description: "Bring the bot into your voice channel", usage: "/join", category: "Controls" },
  { name: "/leave", description: "Disconnect the bot from the voice channel", usage: "/leave", category: "Controls" },

  // Filters
  { name: "/bassboost", description: "Bass boost at soft, medium, or hard", usage: "/bassboost [level]", category: "Filters" },
  { name: "/nightcore", description: "Nightcore effect (faster and higher pitch)", usage: "/nightcore", category: "Filters" },
  { name: "/8d", description: "8D audio that rotates the sound around you", usage: "/8d [on/off]", category: "Filters" },
  { name: "/echo", description: "Toggle an echo effect", usage: "/echo", category: "Filters" },
  { name: "/tremolo", description: "Tremolo effect (wavering volume)", usage: "/tremolo", category: "Filters" },
  { name: "/vibrato", description: "Vibrato effect (wavering pitch)", usage: "/vibrato", category: "Filters" },
  { name: "/pitch", description: "Change the pitch of the current track", usage: "/pitch <percentage>", category: "Filters" },
  { name: "/speed", description: "Change the playback speed", usage: "/speed <percentage>", category: "Filters" },
  { name: "/karaoke", description: "Karaoke effect that reduces vocals", usage: "/karaoke", category: "Filters" },
  { name: "/distortion", description: "Apply a distortion effect", usage: "/distortion", category: "Filters" },
  { name: "/filters", description: "List every active audio filter", usage: "/filters", category: "Filters" },
  { name: "/clearfilters", description: "Remove all audio filters", usage: "/clearfilters", category: "Filters" },

  // Info
  { name: "/nowplaying", description: "Show the playing track with progress and controls", usage: "/nowplaying", category: "Info" },
  { name: "/lyrics", description: "Lyrics for the current or a named song", usage: "/lyrics [song]", category: "Info" },
  { name: "/history", description: "Recently played tracks", usage: "/history", category: "Info" },
  { name: "/save", description: "Save the current song to your DMs", usage: "/save", category: "Info" },
  { name: "/grab", description: "Send the current track info to your DMs", usage: "/grab", category: "Info" },
  { name: "/stats", description: "Bot statistics and performance", usage: "/stats", category: "Info" },

  // Utility
  { name: "/help", description: "List every command with a description", usage: "/help [command]", category: "Utility" },
  { name: "/ping", description: "Check bot latency", usage: "/ping", category: "Utility" },
  { name: "/uptime", description: "How long the bot has been online", usage: "/uptime", category: "Utility" },
  { name: "/invite", description: "Get the link to add Bypass to another server", usage: "/invite", category: "Utility" },

  // Settings (admin)
  { name: "/settings view", description: "Show the current server settings", usage: "/settings view", category: "Settings", adminOnly: true },
  { name: "/settings djrole", description: "Set the DJ role allowed to control music", usage: "/settings djrole <role>", category: "Settings", adminOnly: true },
  { name: "/settings adminrole", description: "Set the role allowed to change settings", usage: "/settings adminrole <role>", category: "Settings", adminOnly: true },
  { name: "/settings volume", description: "Set the default and maximum volume", usage: "/settings volume [default] [max]", category: "Settings", adminOnly: true },
  { name: "/settings queue", description: "Set the queue size limit and block duplicates", usage: "/settings queue [maxsize] [preventduplicates]", category: "Settings", adminOnly: true },
  { name: "/settings behavior", description: "Announcements, auto-leave, and leave timeout", usage: "/settings behavior [options]", category: "Settings", adminOnly: true },
  { name: "/settings voicechannels", description: "Restrict the bot to specific voice channels", usage: "/settings voicechannels", category: "Settings", adminOnly: true },
  { name: "/settings textchannels", description: "Restrict commands to specific text channels", usage: "/settings textchannels", category: "Settings", adminOnly: true },
  { name: "/settings logchannel", description: "Channel for now-playing and bot logs", usage: "/settings logchannel <channel>", category: "Settings", adminOnly: true },
  { name: "/settings blacklist", description: "Block or unblock a user from using the bot", usage: "/settings blacklist <add|remove> <user>", category: "Settings", adminOnly: true },
  { name: "/settings language", description: "Set the bot language for this server", usage: "/settings language <language>", category: "Settings", adminOnly: true },
  { name: "/settings embedcolor", description: "Custom accent color for bot embeds", usage: "/settings embedcolor <hex>", category: "Settings", adminOnly: true },
  { name: "/settings stats", description: "Music statistics for this server", usage: "/settings stats", category: "Settings", adminOnly: true },
  { name: "/settings reset", description: "Reset every setting to default", usage: "/settings reset", category: "Settings", adminOnly: true },

  // Premium
  { name: "/premium link", description: "Link this server to your Patreon account", usage: "/premium link", category: "Premium", isPremium: true },
  { name: "/premium unlink", description: "Unlink this server from your Patreon account", usage: "/premium unlink", category: "Premium", isPremium: true },
  { name: "/premium status", description: "Premium status for this server", usage: "/premium status", category: "Premium", isPremium: true },
  { name: "/premium list", description: "Every server linked to your Patreon account", usage: "/premium list", category: "Premium", isPremium: true },
  { name: "/premium config", description: "Configure premium features such as bitrate", usage: "/premium config [options]", category: "Premium", isPremium: true },
  { name: "/patreon status", description: "Your Patreon status and benefits", usage: "/patreon status", category: "Premium" },
  { name: "/patreon sync", description: "Refresh your Patreon benefits", usage: "/patreon sync", category: "Premium" },
  { name: "/patreon info", description: "How Patreon benefits and linking work", usage: "/patreon info", category: "Premium" },
];

export const COMMAND_COUNT = commands.length;

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

/** Commands scrolled in the hero ticker — all real, all free. */
export const TICKER_COMMANDS = [
  "/play", "/queue", "/skip", "/seek", "/volume", "/lyrics", "/shuffle",
  "/insert", "/autoplay", "/playlist", "/grab", "/loop", "/filters",
  "/nowplaying", "/voteskip", "/history", "/bassboost", "/8d",
];
