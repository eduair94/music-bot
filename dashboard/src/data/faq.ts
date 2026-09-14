export interface FAQItem {
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    question: "How do I add Bypass to my Discord server?",
    answer:
      "Click Add to Discord on this page. Discord will ask you to pick a server and authorize the bot. You need the Manage Server permission on that server.",
  },
  {
    question: "Is Bypass really free?",
    answer:
      "Yes. Playing music from YouTube, queue management, volume control, lyrics, and every core command are free with no time limit. Premium features are optional and unlocked through Patreon.",
  },
  {
    question: "What premium features do I get as a Founder?",
    answer:
      "Founders get audio filters such as bass boost and nightcore, 24/7 mode so the bot stays in the channel, maximum audio quality, priority queue, unlimited saved playlists, no song duration limit, a vote on new features, an exclusive Discord role, and direct support access.",
  },
  {
    question: "How does the Patreon integration work?",
    answer:
      "Subscribe on Patreon and connect your Discord account in your Patreon settings. Bypass syncs your patron status automatically and unlocks premium features. Run /premium link in the server you want to upgrade.",
  },
  {
    question: "Why is the Founder tier limited to 50 spots?",
    answer:
      "The Founder tier is an early supporter tier with pricing locked forever at $1.50 per month. It is capped at 50 spots to keep a small community of early supporters who help shape what Bypass builds next.",
  },
  {
    question: "Can I use the bot on multiple servers?",
    answer:
      "Yes. The free version works on any server where Bypass is added. Premium is tied to your Discord account and can be linked to your servers with /premium link.",
  },
  {
    question: "What languages does Bypass support?",
    answer:
      "Bypass is localized in 28 languages, including English, Spanish, French, German, Japanese, Korean, Chinese, Portuguese, Russian, and Arabic. Server admins change it with /settings language.",
  },
  {
    question: "The bot is not playing audio. What should I do?",
    answer:
      "Make sure the bot can connect and speak in your voice channel, and that you are in a voice channel before running /play. If it still stays silent, run /stop and then /play again, or ask in the support server.",
  },
];
