import { LANGUAGE_COUNT, PATREON_URL } from "@/lib/site";
import Link from "next/link";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
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
    badge: "FOUNDER PRICING",
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
    <section id="pricing" className="py-28 bg-coal relative overflow-hidden" aria-labelledby="pricing-title">
      <div
        className="absolute -top-40 right-0 w-150 h-150 rounded-full bg-amber/5 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className="console-label text-amber!">Gain staging</span>
            <span className="flex-1 h-px bg-line" aria-hidden="true" />
            <span className="console-label">{tiers.length} tiers</span>
          </div>
          <h2 id="pricing-title" className="font-display text-4xl md:text-6xl font-bold tracking-tight text-balance">
            Fair price. <span className="text-amber">Full signal.</span>
          </h2>
          <p className="text-lg text-dune mt-6 max-w-xl">
            Free forever for the essentials. Founders lock in studio features
            at the lowest price we will ever offer.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl" role="list">
          {tiers.map((tier) => {
            const external = tier.ctaLink.startsWith("http");
            const ctaClass = `block w-full py-3.5 rounded-lg font-semibold text-center transition-colors duration-200 ${
              tier.highlighted
                ? "bg-amber hover:bg-amber-hot text-coal"
                : "border border-line-strong text-cream hover:border-amber/60"
            }`;
            return (
              <li
                key={tier.name}
                className={`relative console-panel rounded-2xl p-8 transition-[translate,border-color] duration-300 hover:-translate-y-1 ${
                  tier.highlighted ? "border-amber/60 md:-translate-y-3 md:hover:-translate-y-4" : ""
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-8">
                    <span className="px-3 py-1 bg-amber text-coal font-mono text-[10px] tracking-widest font-bold rounded whitespace-nowrap">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <h3 className="console-label mb-3">{tier.name}</h3>

                <p className="mb-2 flex items-baseline gap-2">
                  <span className="stat-readout text-5xl font-bold text-cream">{tier.price}</span>
                  {tier.period && <span className="font-mono text-sm text-dust">{tier.period}</span>}
                </p>

                <p className="text-sm text-dune mb-6">{tier.description}</p>

                <div className="ruler-x mb-6" aria-hidden="true" />

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg
                        className={`w-4 h-4 mt-1 shrink-0 ${tier.highlighted ? "text-amber" : "text-signal"}`}
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
              </li>
            );
          })}
        </ul>

        <ul className="mt-16 flex items-center gap-x-8 gap-y-3 flex-wrap" role="list">
          {ASSURANCES.map((badge, i) => (
            <li key={badge} className="flex items-center gap-2">
              <span className="led" style={{ animationDelay: `${i * 0.8}s` }} aria-hidden="true" />
              <span className="console-label">{badge}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
