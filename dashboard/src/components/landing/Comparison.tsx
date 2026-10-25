import SectionHeader from "@/components/landing/SectionHeader";

interface BotRow {
  name: string;
  audio: string;
  dashboard: string;
  pricing: string;
  highlight?: boolean;
}

const bots: BotRow[] = [
  {
    name: "Jockie Music",
    audio: "Standard quality",
    dashboard: "None — command-only, steep learning curve",
    pricing: "Tiered premium, per-bot pricing",
  },
  {
    name: "FredBoat",
    audio: "128kbps standard",
    dashboard: "None",
    pricing: "Free / donations",
  },
  {
    name: "Uzox",
    audio: "Standard quality",
    dashboard: "None — frequent outages on YouTube changes",
    pricing: "Premium for filters & playlists",
  },
  {
    name: "Hydra",
    audio: "Standard quality",
    dashboard: "Web-first — Discord commands limited",
    pricing: "Expensive monthly subscription",
  },
  {
    name: "Bypass",
    audio: "Up to 320kbps from Tier 1",
    dashboard: "Full web dashboard + complete Discord commands",
    pricing: "Founder tier — lowest price, locked forever",
    highlight: true,
  },
];

// Sized to the longest entry in each column, so every row stays on one line from 1280px up.
const COLUMNS = [
  { label: "Bot", width: "w-[13.5%]" },
  { label: "Audio", width: "w-[20%]" },
  { label: "Control surface", width: "w-[35.5%]" },
  { label: "Pricing", width: "w-[31%]" },
];

export default function Comparison() {
  return (
    <section
      id="comparison"
      className="py-24 lg:py-32 bg-panel/40 border-y border-line"
      aria-labelledby="comparison-title"
    >
      <div className="shell">
        <SectionHeader
          id="comparison-title"
          title="Hear the difference."
          lede="How Bypass stacks up against the music bots your server has probably already tried."
        />

        {/* Desktop table */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-line bg-panel">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">
              Comparison of Discord music bots by audio quality, control surface, and pricing
            </caption>
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.label} className={column.width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                {COLUMNS.map((column) => (
                  <th key={column.label} scope="col" className="px-6 py-4 console-label font-normal">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr
                  key={bot.name}
                  className={`border-b border-line last:border-0 ${bot.highlight ? "bg-amber/[0.07]" : ""}`}
                >
                  <th
                    scope="row"
                    className={`px-6 py-5 align-baseline whitespace-nowrap font-display text-lg font-semibold ${bot.highlight ? "text-amber" : "text-cream"}`}
                  >
                    {bot.name}
                  </th>
                  {[bot.audio, bot.dashboard, bot.pricing].map((cell, i) => (
                    <td key={i} className={`px-6 py-5 align-baseline ${bot.highlight ? "text-cream font-medium" : "text-dune"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: one block per bot, separated by rules */}
        <ul className="lg:hidden" role="list">
          {bots.map((bot) => (
            <li
              key={bot.name}
              className={`border-t border-line last:border-b py-6 ${bot.highlight ? "-mx-[var(--gutter)] px-[var(--gutter)] bg-amber/[0.07]" : ""}`}
            >
              <h3 className={`font-display text-xl font-semibold ${bot.highlight ? "text-amber" : "text-cream"}`}>
                {bot.name}
              </h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-6">
                {[
                  ["Audio", bot.audio],
                  ["Control surface", bot.dashboard],
                  ["Pricing", bot.pricing],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="console-label">{label}</dt>
                    <dd className={`mt-1 ${bot.highlight ? "text-cream" : "text-dune"}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
