"use client";

import { useMemo, useState } from "react";

interface Command {
  name: string;
  description: string;
  usage: string;
  category: string;
  isNew?: boolean;
  isPremium?: boolean;
}

// Category icons as SVG components
const CategoryIcons: Record<string, React.ReactNode> = {
  Music: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  Queue: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Controls: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Filters: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  Info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Utility: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Audio: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
    </svg>
  ),
  Premium: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

const commands: Command[] = [
  // Music - Playing
  { name: "/play", description: "Play a song from YouTube, Spotify, or SoundCloud", usage: "/play <song or URL>", category: "Music" },
  { name: "/play_spotify", description: "Search and play music from Spotify", usage: "/play_spotify <song or URL>", category: "Music" },
  { name: "/play_file", description: "Play an uploaded audio file", usage: "/play_file <attachment>", category: "Music" },
  { name: "/search", description: "Search and select from multiple results", usage: "/search <query>", category: "Music" },
  { name: "/insert", description: "Insert a track right after the current song", usage: "/insert <song>", category: "Music", isNew: true },
  { name: "/playlist", description: "Play a YouTube or Spotify playlist", usage: "/playlist <playlist URL>", category: "Music" },
  
  // Queue Management
  { name: "/queue", description: "View the current music queue with pagination", usage: "/queue [page]", category: "Queue" },
  { name: "/queueinfo", description: "Get detailed queue statistics and duration", usage: "/queueinfo", category: "Queue" },
  { name: "/skip", description: "Skip the current song", usage: "/skip", category: "Queue" },
  { name: "/skipto", description: "Skip to a specific song in queue", usage: "/skipto <position>", category: "Queue" },
  { name: "/jump", description: "Jump to a specific position in queue", usage: "/jump <position>", category: "Queue" },
  { name: "/voteskip", description: "Start a vote to skip the current track", usage: "/voteskip", category: "Queue" },
  { name: "/previous", description: "Play the previous track from history", usage: "/previous", category: "Queue" },
  { name: "/nextup", description: "Preview the next track in queue", usage: "/nextup", category: "Queue" },
  { name: "/remove", description: "Remove a song from queue by position", usage: "/remove <position>", category: "Queue" },
  { name: "/removecurrent", description: "Remove and skip the currently playing track", usage: "/removecurrent", category: "Queue", isNew: true },
  { name: "/removerange", description: "Remove a range of tracks from queue", usage: "/removerange <start> <end>", category: "Queue" },
  { name: "/removelast", description: "Remove the last track in queue", usage: "/removelast", category: "Queue" },
  { name: "/removeduplicates", description: "Remove all duplicate tracks from queue", usage: "/removeduplicates", category: "Queue" },
  { name: "/move", description: "Move a track to a new position", usage: "/move <from> <to>", category: "Queue" },
  { name: "/swap", description: "Swap positions of two tracks", usage: "/swap <pos1> <pos2>", category: "Queue" },
  { name: "/shuffle", description: "Shuffle the queue randomly", usage: "/shuffle", category: "Queue" },
  { name: "/reverse", description: "Reverse the queue order", usage: "/reverse", category: "Queue" },
  { name: "/sort", description: "Sort queue by title, author, or length", usage: "/sort <type>", category: "Queue" },
  { name: "/clear", description: "Clear all tracks from queue", usage: "/clear", category: "Queue" },
  { name: "/restart", description: "Restart the queue from the beginning", usage: "/restart", category: "Queue" },
  
  // Playback Controls
  { name: "/pause", description: "Pause the current track", usage: "/pause", category: "Controls" },
  { name: "/resume", description: "Resume paused playback", usage: "/resume", category: "Controls" },
  { name: "/stop", description: "Stop playback and clear the queue", usage: "/stop", category: "Controls" },
  { name: "/volume", description: "Set the playback volume (0-100)", usage: "/volume <0-100>", category: "Controls" },
  { name: "/seek", description: "Seek to a specific position in the track", usage: "/seek <time>", category: "Controls" },
  { name: "/forward", description: "Fast forward by specified seconds", usage: "/forward <seconds>", category: "Controls" },
  { name: "/backward", description: "Rewind by specified seconds", usage: "/backward <seconds>", category: "Controls" },
  { name: "/rewind", description: "Restart the current track from beginning", usage: "/rewind", category: "Controls" },
  { name: "/replay", description: "Replay the current track", usage: "/replay", category: "Controls" },
  { name: "/loop", description: "Toggle loop for current track", usage: "/loop", category: "Controls" },
  { name: "/loopqueue", description: "Toggle loop for entire queue", usage: "/loopqueue", category: "Controls" },
  { name: "/autoplay", description: "Toggle autoplay mode for related tracks", usage: "/autoplay", category: "Controls" },
  { name: "/join", description: "Make bot join your voice channel", usage: "/join", category: "Controls" },
  { name: "/leave", description: "Make bot leave voice channel", usage: "/leave", category: "Controls" },
  
  // Audio Filters
  { name: "/bassboost", description: "Apply bass boost effect (soft/medium/hard)", usage: "/bassboost [level]", category: "Filters" },
  { name: "/nightcore", description: "Apply nightcore effect (faster + higher pitch)", usage: "/nightcore", category: "Filters" },
  { name: "/8d", description: "Apply immersive 8D audio effect", usage: "/8d [on/off]", category: "Filters" },
  { name: "/echo", description: "Apply echo/reverb effect", usage: "/echo", category: "Filters" },
  { name: "/tremolo", description: "Apply tremolo effect (wavering volume)", usage: "/tremolo", category: "Filters" },
  { name: "/vibrato", description: "Apply vibrato effect (wavering pitch)", usage: "/vibrato", category: "Filters" },
  { name: "/pitch", description: "Change the audio pitch", usage: "/pitch <percentage>", category: "Filters" },
  { name: "/speed", description: "Change playback speed", usage: "/speed <percentage>", category: "Filters" },
  { name: "/karaoke", description: "Apply karaoke effect (reduce vocals)", usage: "/karaoke", category: "Filters" },
  { name: "/distortion", description: "Apply distortion effect", usage: "/distortion", category: "Filters" },
  { name: "/filters", description: "View all currently active filters", usage: "/filters", category: "Filters" },
  { name: "/clearfilters", description: "Clear all audio filters", usage: "/clearfilters", category: "Filters" },
  
  // Audio Settings
  { name: "/setbitrate", description: "Set voice channel bitrate for better quality", usage: "/setbitrate <kbps>", category: "Audio", isPremium: true },
  { name: "/resetbitrate", description: "Reset voice channel bitrate to default", usage: "/resetbitrate", category: "Audio" },
  
  // Information
  { name: "/nowplaying", description: "Show currently playing track with progress", usage: "/nowplaying", category: "Info" },
  { name: "/lyrics", description: "Get lyrics for current or specified song", usage: "/lyrics [song]", category: "Info" },
  { name: "/history", description: "View recently played tracks", usage: "/history", category: "Info" },
  { name: "/save", description: "Save current song to your DMs", usage: "/save", category: "Info" },
  { name: "/grab", description: "Grab current track info and send to DMs", usage: "/grab", category: "Info" },
  { name: "/stats", description: "View bot statistics and performance", usage: "/stats", category: "Info" },
  
  // Utility
  { name: "/help", description: "Display all commands with descriptions", usage: "/help [command]", category: "Utility" },
  { name: "/ping", description: "Check bot latency and response time", usage: "/ping", category: "Utility" },
  { name: "/uptime", description: "Check how long the bot has been online", usage: "/uptime", category: "Utility" },
  { name: "/invite", description: "Get bot invite link to add to your server", usage: "/invite", category: "Utility" },
  { name: "/settings", description: "Configure server settings and preferences", usage: "/settings", category: "Utility" },
  
  // Premium
  { name: "/premium link", description: "Link server to your Patreon account", usage: "/premium link", category: "Premium", isPremium: true },
  { name: "/premium unlink", description: "Unlink server from your Patreon account", usage: "/premium unlink", category: "Premium", isPremium: true },
  { name: "/premium status", description: "Check premium status for this server", usage: "/premium status", category: "Premium", isPremium: true },
  { name: "/premium list", description: "List all your linked premium servers", usage: "/premium list", category: "Premium", isPremium: true },
  { name: "/premium config", description: "Configure premium features (bitrate, identity)", usage: "/premium config [options]", category: "Premium", isPremium: true },
];

const categories = ["All", "Music", "Queue", "Controls", "Filters", "Audio", "Info", "Utility", "Premium"];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Music: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  Queue: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  Controls: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  Filters: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  Audio: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  Info: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  Utility: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
  Premium: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
};

const categoryDescriptions: Record<string, string> = {
  All: "Browse all available commands",
  Music: "Play music from YouTube, Spotify, and more",
  Queue: "Manage your music queue with precision",
  Controls: "Control playback, volume, and loops",
  Filters: "Apply audio effects and filters",
  Audio: "Adjust audio quality settings",
  Info: "Get information about tracks and the bot",
  Utility: "Helpful utility commands",
  Premium: "Premium features for supporters",
};

export default function Commands() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      const matchesCategory = activeCategory === "All" || cmd.category === activeCategory;
      const matchesSearch = 
        cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.usage.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const getCategoryCount = (category: string) => {
    if (category === "All") return commands.length;
    return commands.filter(c => c.category === category).length;
  };

  return (
    <section id="commands" className="py-24 bg-[#1a1a2e]">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865f2]/20 rounded-full border border-[#5865f2]/30 mb-6">
            <span className="text-[#5865f2]">⌘</span>
            <span className="text-sm text-gray-300">{commands.length} Commands Available</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Complete <span className="gradient-text">Command Reference</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Everything you need to control your music experience. Search or browse by category.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search commands by name, description, or usage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/20 transition-all text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="max-w-5xl mx-auto mb-10">
          <div className="flex gap-2 flex-wrap justify-center">
            {categories.map((category) => {
              const count = getCategoryCount(category);
              const isActive = activeCategory === category;
              const colors = categoryColors[category] || categoryColors.Utility;
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 border ${
                    isActive 
                      ? `bg-[#5865f2] text-white border-[#5865f2] shadow-lg shadow-[#5865f2]/25` 
                      : `bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:border-white/20`
                  }`}
                >
                  {category !== "All" && (
                    <span className={isActive ? "text-white" : colors.text}>
                      {CategoryIcons[category]}
                    </span>
                  )}
                  {category}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-gray-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Category Description */}
          <p className="text-center text-gray-500 mt-4 text-sm">
            {categoryDescriptions[activeCategory]}
          </p>
        </div>

        {/* Commands Grid */}
        <div className="max-w-5xl mx-auto">
          {/* Results count */}
          {searchQuery && (
            <div className="mb-4 text-gray-400 text-sm">
              Found <span className="text-white font-medium">{filteredCommands.length}</span> command{filteredCommands.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
            </div>
          )}

          <div className="grid gap-3">
            {filteredCommands.map((cmd) => {
              const colors = categoryColors[cmd.category] || categoryColors.Utility;
              const isExpanded = expandedCommand === cmd.name;
              
              return (
                <div 
                  key={cmd.name}
                  onClick={() => setExpandedCommand(isExpanded ? null : cmd.name)}
                  className={`glass-card rounded-xl p-4 cursor-pointer transition-all duration-200 border ${
                    isExpanded ? `${colors.border} bg-white/3` : 'border-transparent hover:border-[#5865f2]/20'
                  } group`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Command Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <code className="text-[#5865f2] font-bold text-lg group-hover:text-[#7289da] transition-colors">
                          {cmd.name}
                        </code>
                        <span className={`px-2.5 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text} font-medium`}>
                          {cmd.category}
                        </span>
                        {cmd.isNew && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-medium animate-pulse">
                            NEW
                          </span>
                        )}
                        {cmd.isPremium && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-linear-to-r from-pink-500/20 to-purple-500/20 text-pink-400 font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            PREMIUM
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm sm:text-base">{cmd.description}</p>
                    </div>
                    
                    {/* Usage */}
                    <div className="sm:text-right shrink-0">
                      <code className="text-sm bg-black/40 text-gray-300 px-3 py-2 rounded-lg font-mono inline-block border border-white/5">
                        {cmd.usage}
                      </code>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 animate-fadeIn">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                          {CategoryIcons[cmd.category]}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">How to use</h4>
                          <p className="text-gray-400 text-sm">
                            Type <code className="text-[#5865f2] bg-[#5865f2]/10 px-1.5 py-0.5 rounded">{cmd.usage}</code> in any text channel where the bot has access.
                          </p>
                          {cmd.isPremium && (
                            <p className="text-pink-400 text-sm mt-2 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              This command requires Premium access
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredCommands.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No commands found</h3>
              <p className="text-gray-400 mb-6">Try adjusting your search or filter criteria</p>
              <button 
                onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                className="px-6 py-3 bg-[#5865f2] hover:bg-[#4752c4] rounded-xl font-medium transition-all inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Quick Tips Section */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="glass-card rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-2xl">💡</span> Quick Tips
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-green-400">1</span>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">Quick Play</h4>
                  <p className="text-gray-400 text-sm">Just type <code className="text-[#5865f2]">/play song name</code> to start playing music instantly</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-blue-400">2</span>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">Button Controls</h4>
                  <p className="text-gray-400 text-sm">Use the interactive buttons on now playing messages for quick controls</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <span className="text-purple-400">3</span>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">Stack Filters</h4>
                  <p className="text-gray-400 text-sm">Combine multiple audio filters for unique sound effects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add animation keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </section>
  );
}
