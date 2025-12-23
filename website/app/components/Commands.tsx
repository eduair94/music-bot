"use client";

import { useState } from "react";

interface Command {
  name: string;
  description: string;
  usage: string;
  category: string;
}

const commands: Command[] = [
  { name: "/play", description: "Play audio from YouTube", usage: "/play <URL or search>", category: "Music" },
  { name: "/play_spotify", description: "Search and play music from Spotify", usage: "/play_spotify <song or URL>", category: "Music" },
  { name: "/play_file", description: "Play an uploaded audio file", usage: "/play_file <attachment>", category: "Music" },
  { name: "/playlist", description: "Play a YouTube playlist", usage: "/playlist <playlist URL>", category: "Music" },
  { name: "/search", description: "Search and select videos to play", usage: "/search <query>", category: "Music" },
  { name: "/nowplaying", description: "Show the currently playing song", usage: "/nowplaying", category: "Music" },
  { name: "/lyrics", description: "Get lyrics for current song", usage: "/lyrics", category: "Music" },
  { name: "/queue", description: "Show the music queue", usage: "/queue", category: "Queue" },
  { name: "/skip", description: "Skip the current song", usage: "/skip", category: "Queue" },
  { name: "/skipto", description: "Skip to a specific song in queue", usage: "/skipto <number>", category: "Queue" },
  { name: "/remove", description: "Remove a song from queue", usage: "/remove <number>", category: "Queue" },
  { name: "/move", description: "Move songs in the queue", usage: "/move <from> <to>", category: "Queue" },
  { name: "/shuffle", description: "Shuffle the queue", usage: "/shuffle", category: "Queue" },
  { name: "/pause", description: "Pause the music", usage: "/pause", category: "Controls" },
  { name: "/resume", description: "Resume paused music", usage: "/resume", category: "Controls" },
  { name: "/stop", description: "Stop the music and clear queue", usage: "/stop", category: "Controls" },
  { name: "/loop", description: "Toggle music loop", usage: "/loop", category: "Controls" },
  { name: "/volume", description: "Set the volume (0-100)", usage: "/volume <0-100>", category: "Controls" },
  { name: "/help", description: "Display all commands", usage: "/help", category: "Utility" },
  { name: "/ping", description: "Check bot latency", usage: "/ping", category: "Utility" },
  { name: "/uptime", description: "Check bot uptime", usage: "/uptime", category: "Utility" },
  { name: "/invite", description: "Get bot invite link", usage: "/invite", category: "Utility" },
  { name: "/settings", description: "Configure server settings", usage: "/settings", category: "Utility" },
  { name: "/premium", description: "Check premium status", usage: "/premium", category: "Utility" },
];

const categories = ["All", "Music", "Queue", "Controls", "Utility"];

export default function Commands() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCommands = commands.filter((cmd) => {
    const matchesCategory = activeCategory === "All" || cmd.category === activeCategory;
    const matchesSearch = cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cmd.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="commands" className="py-24 bg-[#1a1a2e]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            All <span className="gradient-text">Commands</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Simple slash commands for everything you need
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2] transition-colors"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${activeCategory === category ? "bg-[#5865f2] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid gap-3">
            {filteredCommands.map((cmd, index) => (
              <div key={index} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-[#5865f2]/30 transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-[#5865f2] font-bold text-lg">{cmd.name}</code>
                    <span className="px-2 py-0.5 bg-white/10 text-xs text-gray-400 rounded">{cmd.category}</span>
                  </div>
                  <p className="text-gray-400">{cmd.description}</p>
                </div>
                <div className="sm:text-right">
                  <code className="text-sm bg-black/30 text-gray-300 px-3 py-1 rounded-lg font-mono">
                    {cmd.usage}
                  </code>
                </div>
              </div>
            ))}
          </div>

          {filteredCommands.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No commands found matching your search.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
