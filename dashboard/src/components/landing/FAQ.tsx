"use client";

import { useState } from "react";
import { FaDiscord } from "react-icons/fa";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do I add Bypass to my Discord server?",
    answer: "Simply click the Add to Discord button on this page. You will be redirected to Discord where you can select your server and authorize the bot. Make sure you have Manage Server permissions.",
  },
  {
    question: "Is Bypass really free?",
    answer: "Yes! Bypass is completely free to use with all basic features including playing music from YouTube, queue management, volume control, and more. Premium features are optional and available through our Patreon.",
  },
  {
    question: "What premium features do I get as a Founder?",
    answer: "Founders get access to audio filters (bass boost, nightcore), 24/7 mode (bot stays in channel), maximum audio quality, priority queue, unlimited playlists, no song duration limits, voting on new features, exclusive Discord role, and direct support access.",
  },
  {
    question: "How does the Patreon integration work?",
    answer: "When you subscribe to our Patreon, make sure to connect your Discord account in Patreon settings. The bot automatically syncs your patron status and unlocks premium features for your account.",
  },
  {
    question: "Why is the Founder tier limited to 50 spots?",
    answer: "The Founder tier is a special early supporter tier with exclusive pricing locked in forever at just $1.50/month. We are limiting it to 50 spots to maintain a tight-knit community of early supporters who help shape the future of Bypass.",
  },
  {
    question: "Can I use the bot on multiple servers?",
    answer: "Yes! The free version works on any server where Bypass is added. For premium features, they are tied to your Discord account, so they work on any server where you use the bot.",
  },
  {
    question: "What languages does Bypass support?",
    answer: "Bypass supports 27+ languages including English, Spanish, French, German, Japanese, Korean, Chinese, Portuguese, Russian, and many more. Use /settings language to change your server language.",
  },
  {
    question: "The bot is not playing audio, what should I do?",
    answer: "Make sure the bot has permissions to connect and speak in your voice channel. Check if you are in a voice channel before using /play. If issues persist, try /stop and play again.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <section id="faq" className="py-28 bg-coal">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Sticky editorial header */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <div className="flex items-center gap-4 mb-6">
                <span className="console-label text-amber!">Liner notes</span>
                <span className="flex-1 h-px bg-line lg:max-w-24" />
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Questions,
                <br />
                <span className="text-amber">answered.</span>
              </h2>
              <p className="text-dune mt-6 leading-relaxed">
                Everything server owners ask before hitting play.
              </p>

              {discordInvite && (
                <a
                  href={discordInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2 px-5 py-3 border border-line-bright hover:border-amber/60 text-cream font-semibold rounded-lg transition-colors focus-amber"
                >
                  <FaDiscord className="w-4 h-4 text-amber" />
                  Join support server
                </a>
              )}
            </div>
          </div>

          {/* Accordion */}
          <div className="lg:col-span-8 space-y-3">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div
                  key={index}
                  className={`console-panel rounded-xl overflow-hidden transition-colors duration-300 ${
                    open ? "border-amber/40" : ""
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="w-full p-5 text-left flex items-center gap-4 hover:bg-panel-raised/50 transition-colors focus-amber"
                    aria-expanded={open}
                  >
                    <span className={`font-mono text-xs ${open ? "text-amber" : "text-dust"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium text-cream flex-1">{faq.question}</span>
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 shrink-0 ${
                        open ? "rotate-45 text-amber" : "text-dust"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      open ? "max-h-96" : "max-h-0"
                    }`}
                  >
                    <p className="px-5 pb-5 pl-13 text-dune leading-relaxed text-sm">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
