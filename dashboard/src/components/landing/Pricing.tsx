"use client";

interface PricingTier {
  name: string;
  price: string;
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
    description: "Perfect for getting started",
    features: [
      "Play music from YouTube",
      "Queue management",
      "Basic playback controls",
      "Volume control",
      "Lyrics display",
      "27+ languages support",
    ],
    cta: "Add to Discord",
    ctaLink: "/invite",
  },
  {
    name: "Founder",
    price: "$1.50",
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
    ctaLink: "https://www.patreon.com/c/u36360623",
  },
  {
    name: "Studio",
    price: "$3.50+",
    description: "Future premium tiers",
    features: [
      "Multi-server support",
      "Custom bot instance",
      "Priority support",
      "More features coming...",
    ],
    cta: "Join Waitlist",
    ctaLink: "https://www.patreon.com/c/u36360623",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-28 bg-coal relative overflow-hidden">
      <div className="absolute -top-40 right-0 w-150 h-150 rounded-full bg-amber/5 blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className="console-label text-amber!">Gain staging</span>
            <span className="flex-1 h-px bg-line" />
            <span className="console-label">3 tiers</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Fair price. <span className="text-amber">Full signal.</span>
          </h2>
          <p className="text-lg text-dune mt-6 max-w-xl">
            Free forever for the essentials. Founders lock in studio features
            at the lowest price we will ever offer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative console-panel rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${
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

              <div className="console-label mb-3">{tier.name}</div>

              <div className="mb-2 flex items-baseline gap-2">
                <span className="stat-readout text-5xl font-bold text-cream">{tier.price}</span>
                {tier.price !== "$0" && tier.name !== "Studio" && (
                  <span className="font-mono text-sm text-dust">/month</span>
                )}
              </div>

              <p className="text-sm text-dune mb-6">{tier.description}</p>

              <div className="ruler-x mb-6" />

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className={`w-4 h-4 mt-1 shrink-0 ${tier.highlighted ? "text-amber" : "text-signal"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-cream/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaLink}
                target={tier.ctaLink.startsWith("http") ? "_blank" : undefined}
                rel={tier.ctaLink.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`block w-full py-3.5 rounded-lg font-semibold text-center transition-all duration-200 focus-amber ${
                  tier.highlighted
                    ? "bg-amber hover:bg-amber-hot text-coal"
                    : "border border-line-bright text-cream hover:border-amber/60"
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 flex items-center gap-x-8 gap-y-3 flex-wrap">
          {["Secure payments", "Cancel anytime", "Privacy protected"].map((badge, i) => (
            <div key={badge} className="flex items-center gap-2">
              <span className="led" style={{ animationDelay: `${i * 0.8}s` }} />
              <span className="console-label">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
