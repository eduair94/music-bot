"use client";

import {
  categories,
  categoryDescriptions,
  commands,
  type CommandCategory,
} from "@/data/commands";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

const iconProps = {
  className: "w-5 h-5",
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
};

const CategoryIcons: Record<CommandCategory, React.ReactNode> = {
  Music: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  Queue: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Controls: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Filters: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  Info: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Utility: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Settings: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Premium: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

const TIPS = [
  { n: "01", title: "Quick play", body: <>Type <code className="kbd">/play song name</code> in any channel to start playing instantly.</> },
  { n: "02", title: "Button controls", body: <>Use the transport buttons on the now-playing message instead of typing commands.</> },
  { n: "03", title: "Stack filters", body: <>Filters combine. Try <code className="kbd">/bassboost</code> with <code className="kbd">/8d</code>.</> },
];

const categoryCounts = Object.fromEntries(
  categories.map((c) => [c, c === "All" ? commands.length : commands.filter((x) => x.category === c).length])
) as Record<(typeof categories)[number], number>;

function toSlug(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

interface CommandsProps {
  headingLevel?: "h1" | "h2";
  /** Cap the rows rendered (home page); the /commands page shows everything. */
  limit?: number;
}

export default function Commands({ headingLevel = "h2", limit }: CommandsProps) {
  const Heading = headingLevel;
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
  const searchId = useId();
  const listId = useId();

  const filteredCommands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return commands.filter((cmd) => {
      const matchesCategory = activeCategory === "All" || cmd.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.usage.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  const visibleCommands = limit ? filteredCommands.slice(0, limit) : filteredCommands;
  const hiddenCount = filteredCommands.length - visibleCommands.length;

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory("All");
  };

  return (
    <section id="commands" className="py-28 bg-panel/40 border-y border-line" aria-labelledby="commands-title">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="console-label text-amber!">Patch bay</span>
            <span className="flex-1 h-px bg-line" aria-hidden="true" />
            <span className="console-label">{commands.length} commands</span>
          </div>
          <Heading id="commands-title" className="font-display text-4xl md:text-6xl font-bold tracking-tight text-balance">
            The full <span className="text-amber">command rack.</span>
          </Heading>
          <p className="text-lg text-dune mt-6 max-w-xl">
            Every slash command Bypass answers to. Search by name or browse by
            category.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-5xl mb-8">
          <label htmlFor={searchId} className="sr-only">
            Search commands
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-amber-deep" aria-hidden="true">
              $
            </span>
            <input
              id={searchId}
              type="search"
              placeholder="search commands…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-controls={listId}
              className="w-full pl-10 pr-12 py-4 bg-panel border border-line-strong rounded-xl font-mono text-cream placeholder:text-dust focus:border-amber/70 transition-colors [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-dust hover:text-cream transition-colors rounded-md"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="max-w-5xl mb-10">
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by category">
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={isActive}
                  className={`min-h-11 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 border ${
                    isActive
                      ? "bg-amber text-coal border-amber font-semibold"
                      : "bg-panel text-dune border-line-strong hover:border-amber/60 hover:text-cream"
                  }`}
                >
                  {category !== "All" && (
                    <span className={isActive ? "text-coal" : "text-amber"}>{CategoryIcons[category]}</span>
                  )}
                  {category}
                  <span className={`font-mono text-xs ${isActive ? "text-coal/70" : "text-dust"}`}>
                    {categoryCounts[category]}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="console-label mt-4">{categoryDescriptions[activeCategory]}</p>
        </div>

        {/* Command list */}
        <div className="max-w-5xl">
          <p className="mb-4 font-mono text-sm text-dune min-h-5" aria-live="polite" aria-atomic="true">
            {searchQuery
              ? `${filteredCommands.length} match${filteredCommands.length !== 1 ? "es" : ""} for "${searchQuery}"`
              : null}
          </p>

          {filteredCommands.length > 0 ? (
            <ul id={listId} className="grid gap-2" role="list">
              {visibleCommands.map((cmd) => {
                const isExpanded = expandedCommand === cmd.name;
                const panelId = `cmd-${toSlug(cmd.name)}`;

                return (
                  <li
                    key={cmd.name}
                    className={`console-panel rounded-xl transition-colors duration-200 ${
                      isExpanded ? "border-amber/50" : "hover:border-line-strong"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCommand(isExpanded ? null : cmd.name)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      className="w-full text-left p-4 rounded-xl"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <code className="text-amber font-mono font-bold">{cmd.name}</code>
                            <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase rounded bg-panel-raised text-dune border border-line">
                              {cmd.category}
                            </span>
                            {cmd.isNew && (
                              <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-signal/15 text-signal border border-signal/30">
                                NEW
                              </span>
                            )}
                            {cmd.isPremium && (
                              <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-amber/15 text-amber border border-amber/30">
                                PREMIUM
                              </span>
                            )}
                            {cmd.adminOnly && (
                              <span className="px-2 py-0.5 font-mono text-[10px] tracking-widest rounded bg-panel-raised text-dust border border-line-strong">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <p className="text-dune text-sm">{cmd.description}</p>
                        </div>

                        <div className="sm:text-right shrink-0">
                          <code className="kbd">{cmd.usage}</code>
                        </div>
                      </div>
                    </button>

                    {/* Rendered only when open: keeps 80+ rows of boilerplate out of the HTML and RSC payload. */}
                    {isExpanded && (
                      <div id={panelId} className="mx-4 mb-4 pt-4 border-t border-line">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-amber/10 text-amber border border-amber/20">
                            {CategoryIcons[cmd.category]}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-cream font-medium mb-1">How to use</h3>
                            <p className="text-dune text-sm">
                              Type <code className="kbd">{cmd.usage}</code> in any text channel the
                              bot can read.{" "}
                              {["Music", "Queue", "Controls", "Filters"].includes(cmd.category)
                                ? "Join a voice channel first."
                                : ""}
                            </p>
                            {cmd.isPremium && (
                              <p className="text-amber text-sm mt-2">Requires a linked Premium server.</p>
                            )}
                            {cmd.adminOnly && (
                              <p className="text-dune text-sm mt-2">
                                Needs Manage Server permission or the configured admin role.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-16 console-panel rounded-xl" role="status">
              <p className="font-mono text-dust mb-4">{"// no signal"}</p>
              <h3 className="font-display text-xl font-semibold text-cream mb-2">No commands found</h3>
              <p className="text-dune mb-6">Nothing matches that search in this category.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-6 py-3 bg-amber hover:bg-amber-hot text-coal rounded-lg font-semibold transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}

          {hiddenCount > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between console-panel rounded-xl p-5">
              <p className="text-dune text-sm">
                Showing {visibleCommands.length} of {filteredCommands.length}
                {activeCategory !== "All" ? ` ${activeCategory.toLowerCase()}` : ""} commands.
              </p>
              <Link
                href="/commands"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-line-strong hover:border-amber/60 text-cream font-semibold rounded-lg transition-colors text-sm"
              >
                Open the full command rack
              </Link>
            </div>
          )}
        </div>

        {/* Quick tips */}
        <div className="max-w-5xl mt-16">
          <div className="console-panel rounded-2xl p-6 md:p-8">
            <h3 className="console-label text-amber!">Engineer&apos;s notes</h3>
            <ul className="grid md:grid-cols-3 gap-6 mt-6" role="list">
              {TIPS.map((tip) => (
                <li key={tip.n} className="flex gap-4">
                  <span className="font-mono text-sm text-amber" aria-hidden="true">{tip.n}</span>
                  <div>
                    <h4 className="font-medium text-cream mb-1">{tip.title}</h4>
                    <p className="text-dune text-sm leading-relaxed">{tip.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
