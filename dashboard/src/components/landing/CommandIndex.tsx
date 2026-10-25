/**
 * Home-page overview of the command set: every category with its size, what it
 * covers, and a few commands from it. The searchable list of all commands lives
 * on /commands.
 */

import CommandText from "@/components/landing/CommandText";
import SectionHeader from "@/components/landing/SectionHeader";
import { categoryDescriptions, COMMAND_COUNT, commands, type CommandCategory } from "@/data/commands";
import Link from "next/link";

/** A few per category, chosen not to repeat the commands Features already shows. */
const EXAMPLES: Record<CommandCategory, string[]> = {
  Music: ["/play_spotify", "/playnow", "/play_file"],
  Queue: ["/skipto", "/previous", "/queuemanage removedupes"],
  Controls: ["/pause", "/seek", "/loop"],
  Filters: ["/effects vaporwave", "/effects lofi", "/effects karaoke"],
  Info: ["/info song", "/stats history", "/stats leaderboard"],
  Utility: ["/help", "/ping", "/dashboard"],
  Settings: ["/settings djrole", "/settings voicechannels", "/settings blacklist"],
  Premium: ["/premium status", "/patreon status", "/patreon sync"],
};

const groups = (Object.keys(EXAMPLES) as CommandCategory[]).map((category) => ({
  category,
  count: commands.filter((c) => c.category === category).length,
  // Only names that exist in the catalogue, so a renamed command drops out instead of lying.
  examples: EXAMPLES[category].filter((name) => commands.some((c) => c.name === name)),
}));

export default function CommandIndex() {
  return (
    <section id="commands" className="py-24 lg:py-32 bg-panel/40 border-y border-line" aria-labelledby="commands-title">
      <div className="shell">
        <SectionHeader
          id="commands-title"
          title="The full command rack."
          lede={`${COMMAND_COUNT} slash commands in ${groups.length} groups, with a few examples from each.`}
        />

        {/* One panel cut into cells: the 1px gaps show the line colour behind them.
            Each cell is a three-row subgrid, so names, descriptions and command
            lists start on the same line across a row. */}
        <ul
          className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
          role="list"
        >
          {groups.map((group) => (
            <li key={group.category} className="row-span-3 grid grid-rows-subgrid gap-y-0 bg-panel p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-lg font-semibold text-cream">{group.category}</h3>
                <span className="font-mono text-sm text-dust">
                  {group.count}
                  <span className="sr-only"> commands</span>
                </span>
              </div>
              <p className="mt-2 text-sm text-dune leading-relaxed text-balance">
                {categoryDescriptions[group.category]}
              </p>
              <ul className="mt-5 space-y-1.5 text-sm text-cream/80" role="list">
                {group.examples.map((name) => (
                  <li key={name}>
                    <CommandText>{name}</CommandText>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <Link
          href="/commands"
          className="mt-8 inline-flex h-11 items-center rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60"
        >
          Browse all {COMMAND_COUNT} commands
        </Link>
      </div>
    </section>
  );
}
