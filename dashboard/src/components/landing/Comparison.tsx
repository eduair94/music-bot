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

function PricingChip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-md text-sm font-medium ${
        highlight ? "bg-amber text-coal" : "bg-panel-raised text-dune border border-line"
      }`}
    >
      {label}
    </span>
  );
}

export default function Comparison() {
  return (
    <section
      id="comparison"
      className="py-28 bg-panel/40 border-y border-line"
      aria-labelledby="comparison-title"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className="console-label text-amber!">A/B test</span>
            <span className="flex-1 h-px bg-line" aria-hidden="true" />
            <span className="console-label">{bots.length} contenders</span>
          </div>
          <h2 id="comparison-title" className="font-display text-4xl md:text-6xl font-bold tracking-tight text-balance">
            Hear the <span className="text-amber">difference.</span>
          </h2>
          <p className="text-lg text-dune mt-6 max-w-xl">
            How Bypass stacks up against the music bots your server has
            probably already tried.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block console-panel rounded-2xl overflow-hidden">
          <table className="w-full">
            <caption className="sr-only">
              Comparison of Discord music bots by audio quality, control surface, and pricing
            </caption>
            <thead>
              <tr className="border-b border-line bg-panel">
                <th scope="col" className="text-left p-5 console-label">Bot</th>
                <th scope="col" className="text-left p-5 console-label">Audio</th>
                <th scope="col" className="text-left p-5 console-label">Control surface</th>
                <th scope="col" className="text-left p-5 console-label">Pricing</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr
                  key={bot.name}
                  className={`border-b border-line/60 last:border-0 transition-colors ${
                    bot.highlight ? "bg-amber/6 hover:bg-amber/10" : "hover:bg-panel-raised/50"
                  }`}
                >
                  <th scope="row" className="p-5 text-left font-normal">
                    <div className="flex items-center gap-3">
                      <span className={`font-display font-bold text-lg ${bot.highlight ? "text-amber" : "text-cream"}`}>
                        {bot.name}
                      </span>
                      {bot.highlight && (
                        <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-amber text-coal font-bold">
                          THIS ONE
                        </span>
                      )}
                    </div>
                  </th>
                  <td className={`p-5 ${bot.highlight ? "text-cream font-medium" : "text-dune"}`}>{bot.audio}</td>
                  <td className={`p-5 ${bot.highlight ? "text-cream font-medium" : "text-dune"}`}>{bot.dashboard}</td>
                  <td className="p-5">
                    <PricingChip label={bot.pricing} highlight={bot.highlight} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="lg:hidden grid gap-4" role="list">
          {bots.map((bot) => (
            <li
              key={bot.name}
              className={`console-panel rounded-xl p-6 ${bot.highlight ? "border-amber/60" : ""}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`font-display text-xl font-bold ${bot.highlight ? "text-amber" : "text-cream"}`}>
                  {bot.name}
                </h3>
                {bot.highlight && (
                  <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-amber text-coal font-bold">
                    THIS ONE
                  </span>
                )}
              </div>
              <dl className="space-y-3">
                <div>
                  <dt className="console-label mb-1">Audio</dt>
                  <dd className={bot.highlight ? "text-cream" : "text-dune"}>{bot.audio}</dd>
                </div>
                <div>
                  <dt className="console-label mb-1">Control surface</dt>
                  <dd className={bot.highlight ? "text-cream" : "text-dune"}>{bot.dashboard}</dd>
                </div>
                <div>
                  <dt className="console-label mb-1">Pricing</dt>
                  <dd>
                    <PricingChip label={bot.pricing} highlight={bot.highlight} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
