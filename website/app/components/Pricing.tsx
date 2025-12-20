"use client";

import { useState } from "react";

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
    name: "Founder / Beta Tester",
    price: "$1.50",
    description: "Limited to 50 spots - Locked forever",
    features: [
      "All Free features",
      "Audio Filters (bass boost, nightcore)",
      "24/7 Mode - Bot stays in channel",
      "Maximum Audio Quality",
      "Priority Queue",
      "Unlimited Saved Playlists",
      "No Song Duration Limit",
      "Vote on New Features",
      "Exclusive Founder Role",
      "Direct Support Channel",
    ],
    highlighted: true,
    badge: "LIMITED TIME",
    cta: "Become a Founder",
    ctaLink: "https://www.patreon.com/cw/BypassDiscordBot",
  },
  {
    name: "Coming Soon",
    price: "$3.50+",
    description: "Future premium tiers",
    features: [
      "Multi-server support",
      "Custom bot instance",
      "Priority support",
      "More features coming...",
    ],
    cta: "Join Waitlist",
    ctaLink: "https://www.patreon.com/cw/BypassDiscordBot",
  },
];

export default function Pricing() {
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f96854]/20 rounded-full border border-[#f96854]/30 mb-6">
            <span className="text-sm text-[#f96854] font-semibold">Support on Patreon</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Unlock <span className="gradient-text">Premium</span> Features
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Support the development and get exclusive features. 
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={index}
              onMouseEnter={() => setHoveredTier(index)}
              onMouseLeave={() => setHoveredTier(null)}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-[#f96854] to-[#eb459e] text-white text-sm font-bold rounded-full shadow-lg">
                    {tier.badge}
                  </span>
                </div>
              )}

              <h3 className={`text-2xl font-bold mb-2 ${tier.highlighted ? "gradient-text" : ""}`}>
                {tier.name}
              </h3>

              <div className="mb-4">
                <span className="text-5xl font-bold">{tier.price}</span>
                {tier.price !== "$0" && tier.name !== "Coming Soon" && (
                  <span className="text-gray-400 ml-2">/month</span>
                )}
              </div>

              <p className="text-gray-400 mb-6">{tier.description}</p>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tier.highlighted ? "text-[#5865f2]" : "text-green-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaLink}
                target={tier.ctaLink.startsWith("http") ? "_blank" : undefined}
                rel={tier.ctaLink.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`block w-full py-4 rounded-xl font-semibold text-center transition-all duration-300 ${tier.highlighted ? "bg-gradient-to-r from-[#5865f2] to-[#eb459e] text-white hover:shadow-lg hover:shadow-[#5865f2]/30 hover:scale-105" : "bg-white/10 text-white hover:bg-white/20 border border-white/20"}`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-400 mb-6">Trusted by thousands of Discord communities</p>
          <div className="flex justify-center items-center gap-8 flex-wrap">
            {[
              { icon: "Secure", text: "Secure Payments" },
              { icon: "Cancel", text: "Cancel Anytime" },
              { icon: "Charge", text: "Charge Upfront" },
              { icon: "Privacy", text: "Privacy Protected" },
            ].map((badge, index) => (
              <div key={index} className="flex items-center gap-2 text-gray-400">
                <span className="text-sm font-medium">{badge.icon}</span>
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
