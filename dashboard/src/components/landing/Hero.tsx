"use client";

import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

const TICKER = [
  "/play", "/queue", "/skip", "/seek", "/volume", "/lyrics", "/shuffle",
  "/247", "/say", "/effects", "/playlist", "/grab", "/loop", "/filters",
  "/nowplaying", "/voteskip", "/radio", "/guesssong",
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-24">
      {/* Atmosphere: dotted raster fading from top, amber glow low-left */}
      <div className="absolute inset-0 raster opacity-40 mask-[linear-gradient(to_bottom,black,transparent_70%)]" />
      <div className="absolute -bottom-40 -left-40 w-150 h-150 rounded-full bg-amber/10 blur-3xl" />

      <div className="container mx-auto px-4 relative z-10 flex-1 flex items-center">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full py-16">
          {/* ── Left: editorial statement ── */}
          <div className="lg:col-span-7">
            <div className="rise rise-1 inline-flex items-center gap-3 px-3 py-1.5 border border-line rounded-full mb-8 bg-panel">
              <span className="led" />
              <span className="console-label text-dune!">On air · 10,000+ servers</span>
            </div>

            <h1 className="rise rise-2 font-display font-bold leading-[0.95] tracking-tight text-[clamp(3rem,8vw,6.5rem)]">
              Sound that
              <br />
              fills the <span className="text-amber">room.</span>
            </h1>

            <p className="rise rise-3 text-lg md:text-xl text-dune max-w-xl mt-8 leading-relaxed">
              Bypass is the studio-grade music bot for Discord. Up to 320kbps
              audio, instant queueing, smart playlists, TTS voices — and a web
              dashboard your whole server can drive.
            </p>

            <div className="rise rise-4 flex flex-col sm:flex-row gap-4 mt-10">
              <Link
                href="/invite"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber hover:bg-amber-hot text-coal font-semibold rounded-lg transition-all duration-200 hover:-translate-y-0.5 focus-amber"
              >
                <FaDiscord className="w-5 h-5" />
                Add to Discord
                <span className="font-mono text-xs px-2 py-0.5 bg-coal/15 rounded">FREE</span>
              </Link>

              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-line-bright hover:border-amber/60 text-cream font-semibold rounded-lg transition-colors focus-amber"
              >
                Explore features
              </a>
            </div>

            {/* Stat strip — mono readouts over ruler */}
            <div className="rise rise-5 mt-14 max-w-xl">
              <div className="ruler-x mb-4" />
              <div className="grid grid-cols-3 gap-6">
                {[
                  { value: "10K+", label: "Servers" },
                  { value: "27", label: "Languages" },
                  { value: "99.9%", label: "Uptime" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="stat-readout text-3xl md:text-4xl font-bold text-cream">
                      {stat.value}
                    </div>
                    <div className="console-label mt-1.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: console deck ── */}
          <div className="lg:col-span-5 rise rise-4">
            <div className="console-panel rounded-2xl p-6 lg:rotate-1 lg:translate-y-2">
              {/* Deck header */}
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <span className="console-label">Now playing</span>
                <div className="flex items-center gap-2">
                  <span className="led led--amber" />
                  <span className="console-label text-amber!">320 kbps</span>
                </div>
              </div>

              {/* Track row */}
              <div className="flex items-center gap-4 py-5">
                <div className="w-14 h-14 rounded-lg bg-panel-raised border border-line flex items-center justify-center">
                  <div className="eq">
                    <span /><span /><span /><span /><span />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-cream truncate">Midnight City</div>
                  <div className="text-sm text-dust truncate">M83 · requested by @maya</div>
                </div>
                <div className="ml-auto font-mono text-sm text-dune">3:47</div>
              </div>

              {/* Progress */}
              <div className="h-1 rounded-full bg-panel-raised overflow-hidden">
                <div className="h-full w-2/3 bg-amber rounded-full" />
              </div>
              <div className="flex justify-between font-mono text-xs text-dust mt-2">
                <span>2:31</span>
                <span>-1:16</span>
              </div>

              {/* Queue preview */}
              <div className="mt-6 space-y-2.5">
                {[
                  { n: "01", t: "Take On Me", a: "a-ha", d: "3:46" },
                  { n: "02", t: "Nightcall", a: "Kavinsky", d: "4:18" },
                  { n: "03", t: "Less I Know the Better", a: "Tame Impala", d: "3:36" },
                ].map((q) => (
                  <div
                    key={q.n}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel-raised/60 border border-line/60"
                  >
                    <span className="font-mono text-xs text-dust">{q.n}</span>
                    <span className="text-sm text-cream truncate">{q.t}</span>
                    <span className="text-xs text-dust truncate hidden sm:inline">{q.a}</span>
                    <span className="ml-auto font-mono text-xs text-dune">{q.d}</span>
                  </div>
                ))}
              </div>

              <div className="ruler-x mt-6" />
              <div className="flex items-center justify-between mt-3">
                <span className="console-label">Queue · 14 tracks</span>
                <span className="console-label">48:12 total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Command tape ── */}
      <div className="relative z-10 border-y border-line bg-panel/80 backdrop-blur-sm py-3 overflow-hidden">
        <div className="tape flex w-max gap-8 px-4">
          {[...TICKER, ...TICKER].map((cmd, i) => (
            <span key={i} className="font-mono text-sm text-dust whitespace-nowrap">
              <span className="text-amber-deep">$</span> {cmd}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
