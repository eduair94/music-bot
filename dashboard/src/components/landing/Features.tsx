"use client";

import { useEffect, useRef, useState } from "react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  command?: string;
  isNew?: boolean;
}

const features: Feature[] = [
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: "Multi-Source Playback",
    description: "Play music from YouTube, Spotify, SoundCloud, and more. Just paste a link or search by name.",
    command: "/play <song or URL>",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    title: "Playlist Support",
    description: "Add entire playlists from YouTube or Spotify. Perfect for parties, gaming sessions, or background music.",
    command: "/playlist <URL>",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    title: "Audio Filters",
    description: "Apply bassboost, nightcore, 8D audio, echo, tremolo, and more effects for unique listening experiences.",
    command: "/bassboost | /8d | /nightcore",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    title: "Queue Management",
    description: "Full queue control - shuffle, sort, move, swap, reverse, remove duplicates, and more.",
    command: "/queue | /shuffle | /move",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: "Insert & Play Next",
    description: "Insert tracks right after the current song without disrupting your queue order.",
    command: "/insert <song>",
    isNew: true,
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" /></svg>,
    title: "Volume Control",
    description: "Fine-tune the volume from 0 to 100. Perfect control over your audio experience.",
    command: "/volume <0-100>",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    title: "Now Playing",
    description: "Beautiful embeds showing track info, duration, progress bar, and interactive controls.",
    command: "/nowplaying",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    title: "Lyrics Display",
    description: "Get song lyrics displayed right in Discord. Sing along to your favorite tracks.",
    command: "/lyrics [song]",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>,
    title: "27+ Languages",
    description: "Fully localized in 27+ languages including English, Spanish, Japanese, French, and more.",
    command: "/settings language",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2h2m3-4H9a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1m-1 4l-3 3m0 0l-3-3m3 3V3" /></svg>,
    title: "Save to DMs",
    description: "Love a song? Save track info directly to your DMs to listen later or share with friends.",
    command: "/save | /grab",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: "Vote Skip",
    description: "Democratic skip voting - let your server decide which songs to skip together.",
    command: "/voteskip",
  },
  {
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    title: "Premium Features",
    description: "Unlock higher bitrate, custom identity, and exclusive features with Patreon support.",
    command: "/premium",
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
    <section id="features" className="py-28 bg-coal relative">
      <div className="container mx-auto px-4">
        {/* Editorial header — left aligned, kicker + rule */}
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className="console-label text-amber!">Signal chain</span>
            <span className="flex-1 h-px bg-line" />
            <span className="console-label">12 modules</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Every control your
            <br />
            server <span className="text-amber">actually uses.</span>
          </h2>
          <p className="text-lg text-dune mt-6 max-w-xl">
            No filler commands. Each module is built for the way communities
            listen together — fast, predictable, and loud.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => { cardsRef.current[index] = el; }}
              data-index={index}
              className={`console-panel rounded-xl p-6 transition-all duration-500 hover:border-amber/50 hover:-translate-y-1 group relative ${
                visibleCards.has(index) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: `${(index % 3) * 70}ms` }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber group-hover:bg-amber group-hover:text-coal transition-all duration-300">
                  {feature.icon}
                </div>
                <div className="flex items-center gap-3">
                  {feature.isNew && (
                    <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-signal/15 text-signal border border-signal/30">
                      NEW
                    </span>
                  )}
                  <span className="font-mono text-xs text-dust">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold mb-2 text-cream">{feature.title}</h3>
              <p className="text-sm text-dune leading-relaxed mb-5">{feature.description}</p>
              {feature.command && <code className="kbd">{feature.command}</code>}
            </div>
          ))}
        </div>

        {/* Transport strip */}
        <div className="mt-20 console-panel rounded-2xl overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 lg:p-10">
              <span className="console-label text-amber!">Transport</span>
              <h3 className="font-display text-2xl md:text-3xl font-semibold mt-3 mb-4">
                Buttons, not commands.
              </h3>
              <p className="text-dune leading-relaxed max-w-md">
                Every now-playing embed ships with a full transport — pause,
                skip, shuffle, loop, stop — so anyone in the channel can drive
                without typing a thing.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 p-8 lg:p-10 bg-panel border-t lg:border-t-0 lg:border-l border-line flex-wrap">
              {[
                { title: "Previous", path: "M6 6h2v12H6zm3.5 6l8.5 6V6z" },
                { title: "Pause", path: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" },
                { title: "Next", path: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" },
                { title: "Shuffle", path: "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" },
                { title: "Loop", path: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" },
              ].map((btn) => (
                <div
                  key={btn.title}
                  className="w-12 h-12 bg-panel-raised border border-line-bright hover:border-amber hover:text-amber text-dune rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  title={btn.title}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={btn.path} /></svg>
                </div>
              ))}
              <div
                className="w-12 h-12 bg-clip/10 border border-clip/40 hover:bg-clip hover:text-coal text-clip rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                title="Stop"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
