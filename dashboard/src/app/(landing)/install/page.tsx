/**
 * Installation Guide Page
 *
 * Simple guide for adding the bot to a Discord server
 */

import { COMMAND_COUNT, commands } from "@/data/commands";
import { SITE_URL } from "@/lib/site";
import {
  BookOpen,
  Languages,
  LifeBuoy,
  ListMusic,
  Lock,
  Megaphone,
  Music,
  ShieldCheck,
  Volume2,
  Zap,
} from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { FaCheckCircle, FaDiscord, FaUserShield } from "react-icons/fa";

const description =
  "Add the Bypass music bot to your Discord server in three steps: authorize, pick a server, and run /play. No setup, no hosting, free to use.";

export const metadata: Metadata = {
  title: "Add to Server",
  description,
  alternates: { canonical: "/install" },
  openGraph: {
    title: "Add Bypass to your Discord server",
    description,
    url: "/install",
  },
};

/** Permissions requested by the OAuth invite (see /invite). */
const PERMISSIONS = ["View Channels", "Connect", "Speak", "Use Voice Activity", "Slash Commands"];

const ESSENTIAL = ["/play", "/queue", "/skip", "/nowplaying", "/volume", "/shuffle"]
  .map((name) => commands.find((c) => c.name === name))
  .filter((c): c is NonNullable<typeof c> => Boolean(c));

const SETTINGS = [
  { icon: ShieldCheck, title: "DJ role", body: "Choose who can control playback and the queue.", cmd: "/settings djrole" },
  { icon: Volume2, title: "Volume limits", body: "Set the default and maximum volume for the server.", cmd: "/settings volume" },
  { icon: Megaphone, title: "Announcements", body: "Turn now-playing announcements on or off, or route them to a log channel.", cmd: "/settings behavior" },
  { icon: Lock, title: "Restricted channels", body: "Limit the bot to specific voice or text channels.", cmd: "/settings voicechannels" },
  { icon: Languages, title: "Language", body: "Pick one of 28 languages for bot replies.", cmd: "/settings language" },
  { icon: ListMusic, title: "Queue rules", body: "Cap the queue size and block duplicate tracks.", cmd: "/settings queue" },
];

function StepCard({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative p-6 pl-8 rounded-2xl console-panel">
      <span
        className="absolute -top-4 -left-3 w-10 h-10 rounded-lg bg-amber flex items-center justify-center text-coal font-mono font-bold text-lg"
        aria-hidden="true"
      >
        {number}
      </span>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
          {icon}
        </span>
        <h3 className="font-display text-xl font-semibold text-cream">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h3>
      </div>
      <p className="text-dune leading-relaxed">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </li>
  );
}

export default function InstallationPage() {
  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-16 bg-coal" aria-labelledby="install-title">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 px-4 py-2 bg-panel rounded-full border border-line mb-6">
            <FaDiscord className="w-4 h-4 text-amber" aria-hidden="true" />
            <span className="console-label text-amber!">Quick setup</span>
          </p>
          <h1 id="install-title" className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
            Add Bypass to <span className="text-amber">your server.</span>
          </h1>
          <p className="text-xl text-dune max-w-2xl mx-auto mb-8">
            Three steps, about thirty seconds, nothing to host. You need the
            Manage Server permission on the server you pick.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/invite"
              prefetch={false}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber hover:bg-amber-hot text-coal rounded-lg transition-colors font-semibold text-lg"
            >
              <FaDiscord className="w-6 h-6" aria-hidden="true" />
              Add to Discord
            </Link>
            <Link
              href="/commands"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-line-strong hover:border-amber/60 text-cream rounded-lg transition-colors font-semibold"
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              Browse commands
            </Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-coal" aria-labelledby="steps-title">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 id="steps-title" className="font-display text-2xl md:text-3xl font-bold text-cream mb-12 text-center">
            Setup in three steps
          </h2>

          <ol className="space-y-8" role="list">
            <StepCard
              number={1}
              icon={<FaDiscord className="w-5 h-5" aria-hidden="true" />}
              title="Invite the bot"
              description="Click Add to Discord above. Discord opens its authorization screen for Bypass."
            >
              <div className="p-4 rounded-xl bg-panel-raised/60 border border-line">
                <p className="console-label mb-2">Invite URL</p>
                <code className="text-signal text-sm break-all">{`${SITE_URL}/invite`}</code>
              </div>
            </StepCard>

            <StepCard
              number={2}
              icon={<FaUserShield className="w-5 h-5" aria-hidden="true" />}
              title="Pick a server and authorize"
              description="Choose the server from the dropdown and confirm. Bypass asks only for what it needs to join voice and answer slash commands."
            >
              <div className="space-y-3">
                <p className="text-sm text-dune">Permissions requested:</p>
                <ul className="flex flex-wrap gap-2" role="list">
                  {PERMISSIONS.map((name) => (
                    <li
                      key={name}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber/10 text-amber rounded-md text-sm border border-amber/30"
                    >
                      <FaCheckCircle className="w-3 h-3" aria-hidden="true" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </StepCard>

            <StepCard
              number={3}
              icon={<Music className="w-5 h-5" aria-hidden="true" />}
              title="Press play"
              description="Join a voice channel and run /play with a song name or link. The now-playing embed brings its own transport buttons."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-panel-raised/60 border border-line">
                  <code className="text-amber font-mono">/play</code>
                  <p className="text-sm text-dune mt-1">Play a song or playlist</p>
                </div>
                <div className="p-3 rounded-lg bg-panel-raised/60 border border-line">
                  <code className="text-amber font-mono">/help</code>
                  <p className="text-sm text-dune mt-1">See every command</p>
                </div>
              </div>
            </StepCard>
          </ol>
        </div>
      </section>

      {/* Essential commands */}
      <section className="py-16 bg-panel/40 border-y border-line" aria-labelledby="essentials-title">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 id="essentials-title" className="font-display text-2xl md:text-3xl font-bold text-cream mb-8 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
              <Zap className="w-4 h-4" aria-hidden="true" />
            </span>
            Essential commands
          </h2>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
            {ESSENTIAL.map((cmd) => (
              <li key={cmd.name} className="p-4 rounded-xl bg-panel-raised/60 border border-line">
                <code className="text-lg text-amber font-mono font-semibold">{cmd.usage}</code>
                <p className="text-dune mt-2">{cmd.description}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 text-center">
            <Link
              href="/commands"
              className="inline-flex items-center gap-2 px-6 py-3 border border-line-strong hover:border-amber/60 text-cream rounded-lg transition-colors font-semibold"
            >
              View all {COMMAND_COUNT} commands
            </Link>
          </div>
        </div>
      </section>

      {/* Server settings */}
      <section className="py-16 bg-coal" aria-labelledby="settings-title">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 id="settings-title" className="font-display text-2xl md:text-3xl font-bold text-cream mb-4">
            Tune it for your server
          </h2>
          <p className="text-dune mb-8 max-w-2xl">
            Admins shape how Bypass behaves with the{" "}
            <code className="kbd">/settings</code> command. Everything below is
            optional. The defaults work out of the box.
          </p>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
            {SETTINGS.map(({ icon: Icon, title, body, cmd }) => (
              <li key={title} className="p-5 rounded-xl console-panel">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-cream font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-dune mb-3">{body}</p>
                <code className="kbd">{cmd}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Help */}
      <section className="py-16 bg-panel/40 border-t border-line" aria-labelledby="help-title">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 id="help-title" className="font-display text-2xl md:text-3xl font-bold text-cream mb-4">
            Stuck?
          </h2>
          <p className="text-dune mb-8 max-w-xl mx-auto">
            The support server answers setup questions and playback issues
            fast. Bug reports go to GitHub.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/support"
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber hover:bg-amber-hot text-coal rounded-lg transition-colors font-semibold"
            >
              <LifeBuoy className="w-5 h-5" aria-hidden="true" />
              Join the support server
            </Link>
            <Link
              href="/commands"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-line-strong hover:border-amber/60 text-cream rounded-lg transition-colors font-semibold"
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              Browse commands
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
