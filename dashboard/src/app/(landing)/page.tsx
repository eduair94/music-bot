/**
 * Landing Page
 *
 * Marketing home page for the Bypass Discord Music Bot
 */

import CommandIndex from "@/components/landing/CommandIndex";
import Comparison from "@/components/landing/Comparison";
import FAQ from "@/components/landing/FAQ";
import Features from "@/components/landing/Features";
import Hero from "@/components/landing/Hero";
import Pricing from "@/components/landing/Pricing";
import Trust from "@/components/landing/Trust";
import { faqs } from "@/data/faq";
import { getPublicStats, getRepoPushedAt } from "@/lib/public-stats";
import {
  FOUNDER_PRICE_USD,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";

/*
 * Static HTML, regenerated at most once a minute so the live numbers (servers,
 * members, player status) stay current. The Docker build has no Redis, so the
 * build-time render has no numbers and the first request after a deploy
 * regenerates it.
 */
export const revalidate = 60;

/** Structured data: site identity, the bot as a software product, and the FAQ. */
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Discord music bot",
    operatingSystem: "Discord",
    installUrl: `${SITE_URL}/invite`,
    softwareHelp: `${SITE_URL}/commands`,
    featureList: [
      "Play music from YouTube, Spotify, and SoundCloud",
      "Playlist support",
      "Queue management",
      "Audio filters",
      "Lyrics",
      "Vote skip",
      "Web dashboard",
      "28 languages",
    ],
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Founder",
        price: FOUNDER_PRICE_USD.toFixed(2),
        priceCurrency: "USD",
        url: `${SITE_URL}/#pricing`,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  },
];

export default async function LandingPage() {
  const [stats, pushedAt] = await Promise.all([getPublicStats(), getRepoPushedAt()]);
  return (
    <>
      <script
        type="application/ld+json"
        // JSON is escaped so a "<" in copy can never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Hero stats={stats} />
      <Features />
      <Comparison />
      <Trust stats={stats} pushedAt={pushedAt} />
      <Pricing />
      <CommandIndex />
      <FAQ />
    </>
  );
}
