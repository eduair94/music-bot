"use client";

import { useState } from "react";

// Custom Discord icon
const DiscordIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

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
    <section id="faq" className="py-24 bg-[#0f0f23]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Got questions? We have got answers.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="glass-card rounded-xl overflow-hidden transition-all duration-300">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
              >
                <span className="text-lg font-semibold">{faq.question}</span>
                <svg
                  className={`w-6 h-6 text-[#5865f2] transition-transform duration-300 flex-shrink-0 ${openIndex === index ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openIndex === index ? "max-h-96" : "max-h-0"}`}>
                <p className="px-6 pb-6 pt-2 text-gray-400 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>

        {discordInvite && (
          <div className="mt-16 text-center">
            <div className="glass-card rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold mb-4">Still have questions?</h3>
              <p className="text-gray-400 mb-6">
                Join our Discord support server for help from our community and team.
              </p>
              <a
                href={discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold rounded-xl transition-all duration-300"
              >
                <DiscordIcon />
                Join Support Server
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
