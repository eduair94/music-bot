import SectionHeader from "@/components/landing/SectionHeader";
import { LANGUAGE_COUNT, PATREON_URL } from "@/lib/site";
import Link from "next/link";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  ctaLink: string;
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "Everything a server needs to press play",
    features: [
      "Play music from YouTube",
      "Queue management",
      "Basic playback controls",
      "Volume control",
      "Lyrics display",
      `${LANGUAGE_COUNT} languages`,
    ],
    cta: "Add to Discord",
    ctaLink: "/invite",
  },
  {
    name: "Founder",
    price: "$3",
    period: "/month",
    description: "Limited to 50 spots — price locked forever",
    features: [
      "All Free features",
      "Audio filters (bass boost, nightcore)",
      "24/7 mode — bot stays in channel",
      "Maximum audio quality (320kbps)",
      "Priority queue",
      "Unlimited saved playlists",
      "No song duration limit",
      "Vote on new features",
      "Exclusive Founder role",
      "Direct support channel",
    ],
    highlighted: true,
    cta: "Become a Founder",
    ctaLink: PATREON_URL,
  },
  {
    name: "Studio",
    price: "$3.50+",
    description: "Future premium tiers",
    features: [
      "Multi-server support",
      "Custom bot instance",
      "Priority support",
      "More features coming",
    ],
    cta: "Join the waitlist",
    ctaLink: PATREON_URL,
  },
];

const ASSURANCES = ["Secure payments via Patreon", "Cancel anytime", "No card stored by us"];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32" aria-labelledby="pricing-title">
      <div className="shell">
        <SectionHeader
          id="pricing-title"
          title="Fair price. Full signal."
          lede="Free forever for the essentials. Founders lock in studio features at the lowest price we will ever offer."
        />

        {/* On large screens each card is a subgrid of the list's three rows, so
            prices, feature lists and buttons line up across the tiers. */}
        <ul className="grid gap-6 lg:grid-cols-3 lg:grid-rows-[auto_1fr_auto] lg:gap-x-8 lg:gap-y-0" role="list">
          {tiers.map((tier) => {
            const external = tier.ctaLink.startsWith("http");
            // Full-width in the three-up grid; sized to its label when a card spans a tablet row.
            const ctaClass = `flex h-12 w-full md:w-fit md:px-8 lg:w-full items-center justify-center rounded-lg font-semibold transition-colors duration-200 ${
              tier.highlighted
                ? "bg-amber hover:bg-amber-hot text-coal"
                : "border border-line-strong text-cream hover:border-amber/60"
            }`;
            return (
              <li
                key={tier.name}
                className={`flex flex-col rounded-2xl border p-8 lg:row-span-3 lg:grid lg:grid-rows-subgrid ${
                  tier.highlighted ? "border-amber/60 bg-panel-raised" : "border-line bg-panel"
                }`}
              >
                <div className="border-b border-line pb-6">
                  <h3 className="font-display text-xl font-semibold text-cream">{tier.name}</h3>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-bold tracking-[-0.03em] tabular-nums text-cream">
                      {tier.price}
                    </span>
                    {tier.period && <span className="text-dune">{tier.period}</span>}
                  </p>
                  <p className="mt-2 text-sm text-dune text-pretty">{tier.description}</p>
                </div>

                <ul
                  className="space-y-3 py-6 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-3 md:space-y-0 lg:block lg:space-y-3"
                  role="list"
                >
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        className={`mt-1 h-4 w-4 shrink-0 ${tier.highlighted ? "text-amber" : "text-dune"}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-cream/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  {external ? (
                    <a href={tier.ctaLink} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                      {tier.cta}
                      <span className="sr-only"> (opens Patreon in a new tab)</span>
                    </a>
                  ) : (
                    <Link href={tier.ctaLink} prefetch={false} className={ctaClass}>
                      {tier.cta}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-sm text-dust text-pretty">{ASSURANCES.join(" · ")}</p>
      </div>
    </section>
  );
}
