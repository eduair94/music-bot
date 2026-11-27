import { PageHead } from "@/components/fest/account/PageHead";
import { btn, textLink } from "@/components/fest/account/styles";
import { faqs as landingFaqs } from "@/data/faq";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_INVITE_URL } from "../../../../../shared/links";

export const metadata: Metadata = { title: "Help" };

const STEPS = [
  {
    title: "Add Bypass to your server",
    body: (
      <>
        Someone with Manage Server adds it from{" "}
        <Link href="/servers" className={textLink}>
          Your servers
        </Link>
        . Bypass only asks for what it needs to post its player and speak in voice.
      </>
    ),
  },
  {
    title: "Join a voice channel and play",
    body: (
      <>
        Run <code className="[font-family:inherit] font-semibold text-ink">/play</code> with a song name or a link from YouTube, Spotify,
        SoundCloud, Apple Music or Deezer. Bypass joins your channel and starts the queue.
      </>
    ),
  },
  {
    title: "Run it from here",
    body: (
      <>
        Open your server in the dashboard to see what&apos;s playing, change the queue and the volume, and, if you
        manage the server, decide who may control the music under Permissions.
      </>
    ),
  },
];

const COMMANDS = [
  ["/play", "Play a song or playlist by name or link."],
  ["/queue", "See what's up next."],
  ["/skip", "Skip the current song."],
  ["/lyrics", "Lyrics for the current song, synced when available."],
  ["/history", "What played recently, with play again."],
  ["/collections", "Save, load and import your own playlists."],
  ["/247", "Keep Bypass in the channel around the clock (Founder, or 12 hours after a vote)."],
  ["/guess", "Start a guess-the-song round."],
];

/** Dashboard questions first, then the landing's answers that hold for signed-in members. */
const LANDING_KEEP = [
  "Is Bypass really free?",
  "What languages does Bypass support?",
  "How does the Patreon integration work?",
  "The bot is not playing audio. What should I do?",
];

const FAQS = [
  {
    question: "Why can't I use some controls?",
    answer:
      "Server admins decide who may control the music. Controls you can't use stay visible and say which rule blocks them. Ask someone with Manage Server to change it under Permissions.",
  },
  {
    question: "Why isn't my server listed?",
    answer:
      "Your servers lists every server you share with Bypass. If Bypass isn't in a server yet, someone with Manage Server has to add it; servers you manage show an Add Bypass button.",
  },
  {
    question: "What are the other stages on the Fleet?",
    answer:
      "Extra Bypass bots that each play in their own voice channel are on the way. Until they launch, Bypass plays in one voice channel per server.",
  },
  ...landingFaqs.filter((f) => LANDING_KEEP.includes(f.question)),
];

const SECTIONS = [
  { id: "start", label: "Getting started" },
  { id: "commands", label: "Commands" },
  { id: "questions", label: "Questions" },
  { id: "support", label: "Support" },
];

export default function HelpPage() {
  return (
    <>
      <PageHead title="Help" status="Getting started, the main commands, and answers" />

      <div className="grid gap-x-10 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-12">
        <nav aria-label="On this page" className="hidden lg:col-span-3 lg:block xl:col-span-2">
          <ul className="sticky top-24 space-y-1 border-l border-rule">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-[68ch] lg:col-span-9 xl:col-span-7">
          <section id="start" aria-labelledby="start-h" className="scroll-mt-24">
            <h2 id="start-h" className="bill text-[40px]">
              Getting started
            </h2>
            <ol className="mt-5 space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="clock flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-ink text-[17px] text-stock">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[17px] font-semibold">{s.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="commands" aria-labelledby="commands-h" className="mt-20 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <h2 id="commands-h" className="bill text-[40px]">
                Commands
              </h2>
              <Link href="/commands" className="flex items-center gap-1.5 pb-1 text-[14px] font-semibold hover:underline">
                Every command <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <dl className="mt-4 border-b border-rule">
              {COMMANDS.map(([name, what]) => (
                <div key={name} className="grid gap-x-6 border-t border-rule py-3 first:border-t-2 first:border-ink sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <dt>
                    <code className="[font-family:inherit] text-[15px] font-semibold text-ink">{name}</code>
                  </dt>
                  <dd className="text-[15px] leading-relaxed text-ink-2">{what}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="questions" aria-labelledby="questions-h" className="mt-20 scroll-mt-24">
            <h2 id="questions-h" className="bill text-[40px]">
              Questions
            </h2>
            <div className="mt-4 border-b border-rule">
              {FAQS.map((f) => (
                <details key={f.question} className="group border-t border-rule first:border-t-2 first:border-ink">
                  <summary className="flex cursor-pointer list-none items-start gap-4 py-4 text-[16px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">{f.question}</span>
                    <Plus size={18} aria-hidden className="mt-0.5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45" />
                  </summary>
                  <p className="-mt-1 pb-5 pr-8 text-[15px] leading-relaxed text-ink-2">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="support" aria-labelledby="support-h" className="mt-20 scroll-mt-24">
            <h2 id="support-h" className="bill text-[40px]">
              Still stuck?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Ask in the Bypass support server. Post in the help channel, or open a ticket if it&apos;s about your account or
              a payment. Staff never ask for your password or a bot token.
            </p>
            <a href={SUPPORT_INVITE_URL} target="_blank" rel="noreferrer" className={btn("ink", "md", "mt-5")}>
              Join the support server <ArrowUpRight size={16} aria-hidden />
            </a>
          </section>
        </article>
      </div>
    </>
  );
}
