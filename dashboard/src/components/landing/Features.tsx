import CommandText from "@/components/landing/CommandText";
import SectionHeader from "@/components/landing/SectionHeader";
import { LANGUAGE_COUNT } from "@/lib/site";

interface Feature {
  title: string;
  description: string;
  commands: string[];
  isNew?: boolean;
}

const features: Feature[] = [
  {
    title: "Multi-Source Playback",
    description: "Play music from YouTube, Spotify, SoundCloud, and more. Paste a link or search by name.",
    commands: ["/play <song or URL>"],
  },
  {
    title: "Playlist Support",
    description: "Add entire playlists from YouTube or Spotify. Perfect for parties, gaming sessions, or background music.",
    commands: ["/playlist <URL>"],
  },
  {
    title: "Audio Filters",
    description: "Bass boost, nightcore, 8D audio, vaporwave, tremolo, and more. Stack them on the live stream.",
    commands: ["/effects bassboost", "/effects 8d", "/effects nightcore"],
  },
  {
    title: "Queue Management",
    description: "Full queue control: shuffle, sort, move, swap, reverse, remove duplicates, and more.",
    commands: ["/queue", "/shuffle", "/move"],
  },
  {
    title: "Insert & Play Next",
    description: "Insert tracks right after the current song without disrupting your queue order.",
    commands: ["/insert <song>"],
    isNew: true,
  },
  {
    title: "Volume Control",
    description: "Fine-tune the volume from 0 to 100. Admins can set server-wide defaults and limits.",
    commands: ["/volume [0-100]"],
  },
  {
    title: "Now Playing",
    description: "Embeds showing track info, duration, a progress bar, and interactive transport buttons.",
    commands: ["/nowplaying"],
  },
  {
    title: "Lyrics Display",
    description: "Song lyrics delivered right in Discord. Sing along to whatever is playing.",
    commands: ["/lyrics"],
  },
  {
    title: `${LANGUAGE_COUNT} Languages`,
    description: `Fully localized in ${LANGUAGE_COUNT} languages including English, Spanish, Japanese, French, and Arabic.`,
    commands: ["/settings language"],
  },
  {
    title: "Save to DMs",
    description: "Love a song? Send the track info to your DMs to listen later or share with friends.",
    commands: ["/save", "/grab"],
  },
  {
    title: "Vote Skip",
    description: "Democratic skipping. Let the channel decide which songs to skip together.",
    commands: ["/voteskip"],
  },
  {
    title: "Premium Features",
    description: "Unlock higher bitrate, custom identity, and exclusive features with Patreon support.",
    commands: ["/premium link"],
  },
];

export default function Features() {
  return (
    <section id="features" className="pt-20 pb-24 lg:pt-24 lg:pb-32" aria-labelledby="features-title">
      <div className="shell">
        <SectionHeader
          id="features-title"
          title="Every control your server actually uses."
          lede="No filler commands. Each module is built for the way communities listen together — fast, predictable, and loud."
        />

        {/* Each item is a three-row subgrid (title, description, commands), so the
            rules, descriptions and command lines of a row start on the same lines. */}
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3" role="list">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="row-span-3 grid grid-rows-subgrid gap-y-0 border-t border-line pt-5 sm:pt-6"
            >
              <h3 className="flex items-baseline gap-3 font-display text-xl font-semibold text-cream">
                {feature.title}{" "}
                {feature.isNew && <span className="font-sans text-xs font-medium text-signal">New</span>}
              </h3>
              <p className="mt-2 max-w-[38ch] text-[0.9375rem] text-dune leading-relaxed text-pretty">
                {feature.description}
              </p>
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-cream/80">
                {feature.commands.map((command) => (
                  <CommandText key={command}>{command}</CommandText>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
