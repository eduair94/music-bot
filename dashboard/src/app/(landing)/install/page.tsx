/**
 * Installation Guide Page
 *
 * Simple guide for adding the bot to a Discord server
 */

import CommandText from "@/components/landing/CommandText";
import SectionHeader from "@/components/landing/SectionHeader";
import { COMMAND_COUNT, commands } from "@/data/commands";
import { LANGUAGE_COUNT, SITE_URL } from "@/lib/site";
import { Check } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

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
  { title: "DJ role", body: "Choose who can control playback and the queue.", cmd: "/settings djrole" },
  { title: "Volume limits", body: "Set the default and maximum volume for the server.", cmd: "/settings volume" },
  { title: "Announcements", body: "Turn now-playing announcements on or off, or route them to a log channel.", cmd: "/settings behavior" },
  { title: "Restricted channels", body: "Limit the bot to specific voice or text channels.", cmd: "/settings voicechannels" },
  { title: "Language", body: `Pick one of ${LANGUAGE_COUNT} languages for bot replies.`, cmd: "/settings language" },
  { title: "Queue rules", body: "Cap the queue size and block duplicate tracks.", cmd: "/settings queue" },
];

const subheading = "font-display text-3xl md:text-4xl font-bold tracking-[-0.02em] text-cream text-balance";
const outlineButton =
  "inline-flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60";

/** One step of three: a subgrid of the list's rows, so titles and details line up across steps. */
function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="row-span-4 grid grid-rows-subgrid gap-y-0 border-t border-line pt-5">
      <p className="font-mono text-sm text-dust tabular-nums" aria-hidden="true">
        {String(number).padStart(2, "0")}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold text-cream">
        <span className="sr-only">Step {number}: </span>
        {title}
      </h3>
      <p className="mt-2 text-dune leading-relaxed text-pretty">{description}</p>
      <div className="mt-5">{children}</div>
    </li>
  );
}

export default function InstallationPage() {
  return (
    <div className="pt-18">
      <section className="pt-16 lg:pt-24" aria-labelledby="install-title">
        <div className="shell">
          <SectionHeader
            as="h1"
            id="install-title"
            title="Add Bypass to your server."
            lede="Three steps, about thirty seconds, nothing to host. You need the Manage Server permission on the server you pick."
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/invite"
              prefetch={false}
              className="inline-flex h-13 items-center justify-center gap-3 rounded-lg bg-amber px-7 font-semibold text-coal transition-colors hover:bg-amber-hot"
            >
              <FaDiscord className="h-5 w-5" aria-hidden="true" />
              Add to Discord
            </Link>
            <Link
              href="/commands"
              className="inline-flex h-13 items-center justify-center rounded-lg border border-line-strong px-7 font-semibold text-cream transition-colors hover:border-amber/60"
            >
              Browse commands
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24" aria-labelledby="steps-title">
        <div className="shell">
          <h2 id="steps-title" className={subheading}>
            Setup in three steps
          </h2>

          <ol className="mt-10 grid gap-x-8 gap-y-10 lg:grid-cols-3" role="list">
            <Step
              number={1}
              title="Invite the bot"
              description="Click Add to Discord above. Discord opens its authorization screen for Bypass."
            >
              <p className="text-sm text-dust">Invite URL</p>
              <code className="mt-1 block break-all font-mono text-sm text-cream/80">{`${SITE_URL}/invite`}</code>
            </Step>

            <Step
              number={2}
              title="Pick a server and authorize"
              description="Choose the server from the dropdown and confirm. Bypass asks only for what it needs to join voice and answer slash commands."
            >
              <p className="text-sm text-dust">Permissions requested</p>
              <ul className="mt-2 space-y-1.5 text-sm text-cream/90" role="list">
                {PERMISSIONS.map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-dune" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </Step>

            <Step
              number={3}
              title="Press play"
              description={
                <>
                  Join a voice channel and run <CommandText>/play</CommandText> with a song name or
                  link. Run <CommandText>/nowplaying</CommandText> for a message with transport buttons.
                </>
              }
            >
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-cream/80">
                    <CommandText>/play</CommandText>
                  </dt>
                  <dd className="mt-0.5 text-dune">Play a song or playlist</dd>
                </div>
                <div>
                  <dt className="text-cream/80">
                    <CommandText>/help</CommandText>
                  </dt>
                  <dd className="mt-0.5 text-dune">See every command</dd>
                </div>
              </dl>
            </Step>
          </ol>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-y border-line" aria-labelledby="essentials-title">
        <div className="shell">
          <h2 id="essentials-title" className={subheading}>
            Essential commands
          </h2>

          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {ESSENTIAL.map((cmd) => (
              <li key={cmd.name} className="border-t border-line pt-5">
                <p className="text-cream/80">
                  <CommandText>{cmd.usage}</CommandText>
                </p>
                <p className="mt-2 text-dune text-pretty">{cmd.description}</p>
              </li>
            ))}
          </ul>

          <Link href="/commands" className={`mt-10 ${outlineButton}`}>
            View all {COMMAND_COUNT} commands
          </Link>
        </div>
      </section>

      <section className="py-20 lg:py-24" aria-labelledby="settings-title">
        <div className="shell">
          <h2 id="settings-title" className={subheading}>
            Tune it for your server
          </h2>
          <p className="mt-4 max-w-[38rem] text-lg text-dune leading-relaxed text-pretty">
            Admins shape how Bypass behaves with the{" "}
            <code className="kbd">/settings</code> command. Everything below is
            optional. The defaults work out of the box.
          </p>

          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {SETTINGS.map(({ title, body, cmd }) => (
              <li key={title} className="border-t border-line pt-5">
                <h3 className="font-display text-lg font-semibold text-cream">{title}</h3>
                <p className="mt-2 text-sm text-dune leading-relaxed text-pretty">{body}</p>
                <p className="mt-3 text-sm text-cream/80">
                  <CommandText>{cmd}</CommandText>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-t border-line" aria-labelledby="help-title">
        <div className="shell">
          <h2 id="help-title" className={subheading}>
            Stuck?
          </h2>
          <p className="mt-4 max-w-[38rem] text-lg text-dune leading-relaxed text-pretty">
            The support server answers setup questions and playback issues
            fast. Bug reports go to GitHub.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/support"
              prefetch={false}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber px-5 text-sm font-semibold text-coal transition-colors hover:bg-amber-hot"
            >
              <FaDiscord className="h-4 w-4" aria-hidden="true" />
              Join the support server
            </Link>
            <Link href="/commands" className={outlineButton}>
              Browse commands
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
