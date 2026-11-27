import NowPlayingMock from "@/components/landing/NowPlayingMock";
import { COMMAND_COUNT, EFFECT_COUNT } from "@/data/commands";
import { compactCount, type PublicStats } from "@/lib/public-stats-shape";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

/** Product facts anyone can check. Audience numbers are never hardcoded: LiveReach reads them live. */
const FACTS = [
  { figure: "256kbps", rest: "audio", lead: "Up to" },
  { figure: String(COMMAND_COUNT), rest: "slash commands" },
  { figure: String(EFFECT_COUNT), rest: "audio effects" },
  { figure: "Free", rest: "to add" },
];

const figure = "font-mono tabular-nums text-cream";

/**
 * Live reach, read from the bots' Redis heartbeats (see lib/public-stats.ts).
 * Rendered only when the numbers are available; never a placeholder.
 */
function LiveReach({ stats }: { stats: PublicStats }) {
  // Same grid as the facts list below, so the two rows share columns at every width.
  const allDown = stats.online === 0;
  return (
    <ul
      className="rise rise-4 mt-10 grid grid-cols-2 items-center gap-y-2 text-sm text-dune sm:flex sm:flex-wrap sm:gap-x-7 lg:grid xl:flex"
      role="list"
      aria-label="Live numbers"
    >
      <li>
        <span className={figure}>{compactCount(stats.servers)}</span> servers
      </li>
      <li>
        <span className={figure}>{compactCount(stats.members)}</span> members
      </li>
      {stats.songsPlayed ? (
        <li>
          <span className={figure}>{compactCount(stats.songsPlayed)}</span> songs played
        </li>
      ) : null}
      {stats.playingNow > 0 ? (
        <li>
          <span className={figure}>{compactCount(stats.playingNow)}</span> playing now
        </li>
      ) : null}
      <li className="flex items-center gap-2.5">
        <span className={allDown ? "led led--off" : "led"} aria-hidden="true" />
        <Link
          href="/status"
          prefetch={false}
          className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-cream hover:decoration-amber"
        >
          {allDown ? "Status: offline" : "Live status"}
        </Link>
      </li>
    </ul>
  );
}

export default function Hero({ stats }: { stats?: PublicStats | null }) {
  const live = stats && stats.servers > 0 ? stats : null;
  return (
    <section
      className="relative border-b border-line pt-32 pb-16 sm:pt-36 lg:pt-44 lg:pb-20"
      aria-labelledby="hero-title"
    >
      <div className="shell grid gap-x-8 gap-y-16 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6">
          <h1
            id="hero-title"
            className="font-display font-bold text-[clamp(3rem,6.4vw,5.5rem)] leading-[0.95] tracking-[-0.035em]"
          >
            Sound that
            <br />
            fills the room.
          </h1>

          <p className="rise rise-2 mt-8 max-w-[34rem] text-lg md:text-xl text-dune leading-relaxed text-pretty">
            Bypass is the studio-grade music bot for Discord. Up to 256kbps
            audio, instant queueing, playlists from YouTube and Spotify,
            stackable audio filters — and a web dashboard your whole server
            can drive.
          </p>

          <div className="rise rise-3 mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/invite"
              prefetch={false}
              className="inline-flex h-13 items-center justify-center gap-3 rounded-lg bg-amber px-7 font-semibold text-coal transition-colors hover:bg-amber-hot"
            >
              <FaDiscord className="h-5 w-5" aria-hidden="true" />
              Add to Discord
            </Link>
            <a
              href="#features"
              className="inline-flex h-13 items-center justify-center rounded-lg border border-line-strong px-7 font-semibold text-cream transition-colors hover:border-amber/60"
            >
              Explore features
            </a>
          </div>

          {live && <LiveReach stats={live} />}

          {/* Two by two until xl: at lg the half-width column is too narrow for one line. */}
          <ul
            className={`rise rise-4 ${live ? "mt-4" : "mt-10"} grid grid-cols-2 gap-y-2 text-sm text-dune sm:flex sm:flex-wrap sm:gap-x-7 lg:grid xl:flex`}
            role="list"
            aria-label="At a glance"
          >
            {FACTS.map((fact) => (
              <li key={fact.rest}>
                {fact.lead && `${fact.lead} `}
                {/* Numbers read as data, in mono; words stay in the text face */}
                <span className={/^\d/.test(fact.figure) ? "font-mono tabular-nums text-cream" : "font-medium text-cream"}>
                  {fact.figure}
                </span>{" "}
                {fact.rest}
              </li>
            ))}
          </ul>
        </div>

        <figure className="rise rise-5 lg:col-span-6">
          <NowPlayingMock />
          <figcaption className="mt-4 max-w-[32rem] text-sm text-dust leading-relaxed text-pretty">
            <span className="text-cream">Buttons, not commands.</span> Each{" "}
            <code className="font-mono text-dune">/nowplaying</code> reply carries seek,
            pause, skip and stop buttons that anyone in the voice channel can use.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
