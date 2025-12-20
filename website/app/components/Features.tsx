"use client";

import { useEffect, useRef, useState } from "react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  command?: string;
}

const features: Feature[] = [
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: "Play from YouTube",
    description: "Play any song or video from YouTube using URLs or search queries. Crystal clear audio quality.",
    command: "/play <song name or URL>",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    title: "Playlist Support",
    description: "Add entire YouTube playlists to your queue. Perfect for long gaming sessions or study time.",
    command: "/playlist <playlist URL>",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    title: "Smart Search",
    description: "Search and select from multiple results. Choose exactly the song you want to play.",
    command: "/search <query>",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    title: "Loop and Shuffle",
    description: "Loop your favorite songs or shuffle the queue for a fresh listening experience.",
    command: "/loop | /shuffle",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" /></svg>,
    title: "Volume Control",
    description: "Adjust the volume to your liking. Perfect control over your audio experience.",
    command: "/volume <0-100>",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    title: "Now Playing",
    description: "See whats currently playing with beautiful embeds showing duration and progress.",
    command: "/nowplaying",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    title: "Queue Management",
    description: "View, reorder, and manage your music queue with ease. Skip, remove, or move songs.",
    command: "/queue | /skip | /remove",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    title: "Lyrics Display",
    description: "Get song lyrics displayed right in Discord. Sing along to your favorite tracks.",
    command: "/lyrics",
  },
  {
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>,
    title: "27+ Languages",
    description: "Fully localized in 27+ languages including English, Spanish, Japanese, and more.",
    command: "/settings language",
  },
];

export default function Features() {
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleCards((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.1 }
    );

    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 bg-[#0f0f23]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful <span className="gradient-text">Features</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Everything you need for the perfect music experience in Discord
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => { cardsRef.current[index] = el; }}
              data-index={index}
              className={`glass-card rounded-2xl p-6 transition-all duration-500 hover:border-[#5865f2]/50 hover:shadow-lg hover:shadow-[#5865f2]/10 group ${visibleCards.has(index) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="w-14 h-14 rounded-xl bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] mb-4 group-hover:bg-[#5865f2] group-hover:text-white transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 mb-4">{feature.description}</p>
              {feature.command && (
                <code className="text-sm bg-black/30 text-[#5865f2] px-3 py-1 rounded-lg font-mono">
                  {feature.command}
                </code>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-block glass-card rounded-2xl p-8">
            <h3 className="text-2xl font-semibold mb-4">Interactive Button Controls</h3>
            <p className="text-gray-400 mb-6 max-w-md">Control playback directly from Discord with interactive buttons - no commands needed!</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <div className="w-12 h-12 bg-[#5865f2] hover:bg-[#4752c4] rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Previous">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </div>
              <div className="w-12 h-12 bg-[#5865f2] hover:bg-[#4752c4] rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Pause">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </div>
              <div className="w-12 h-12 bg-[#5865f2] hover:bg-[#4752c4] rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Next">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </div>
              <div className="w-12 h-12 bg-[#5865f2] hover:bg-[#4752c4] rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Shuffle">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              </div>
              <div className="w-12 h-12 bg-[#5865f2] hover:bg-[#4752c4] rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Loop">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
              </div>
              <div className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110" title="Stop">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
