import NowPlayingMock from "@/components/landing/NowPlayingMock";
import { COMMAND_COUNT, EFFECT_COUNT } from "@/data/commands";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

/** Product facts anyone can check — no audience or uptime claims. */
const FACTS = [
  { figure: "320kbps", rest: "audio", lead: "Up to" },
  { figure: String(COMMAND_COUNT), rest: "slash commands" },
  { figure: String(EFFECT_COUNT), rest: "audio effects" },
  { figure: "Free", rest: "to add" },
];

export default function Hero() {
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
            Bypass is the studio-grade music bot for Discord. Up to 320kbps
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

          {/* Two by two until xl: at lg the half-width column is too narrow for one line. */}
          <ul
            className="rise rise-4 mt-10 grid grid-cols-2 gap-y-2 text-sm text-dune sm:flex sm:flex-wrap sm:gap-x-7 lg:grid xl:flex"
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
