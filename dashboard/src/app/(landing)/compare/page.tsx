/**
 * Comparison page: Bypass next to other Discord music bots, from
 * src/data/comparison.ts. Every competitor claim links to the vendor's own page
 * or its Discord App Directory listing; nothing here is opinion or a review.
 */

import SectionHeader from "@/components/landing/SectionHeader";
import {
  bots,
  bypassCaveat,
  checkedOnLong,
  checkedOnShort,
  columns,
  retiredBots,
  sourceGroups,
  type Cell,
  type Note,
  type Source,
} from "@/data/comparison";
import { Metadata } from "next";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

const description =
  "Bypass, Jockie Music, Uzox and Green-bot side by side: free bots per server, prices, web dashboards and audio, every claim linked to its source.";

export const metadata: Metadata = {
  title: "Discord music bots compared",
  description,
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Discord music bots compared",
    description,
    url: "/compare",
  },
};

const subheading = "font-display text-3xl md:text-4xl font-bold tracking-[-0.02em] text-cream text-balance";
const bodyText = "text-dune leading-relaxed text-pretty";
const inlineLink =
  "text-cream underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-amber";
// inline-block + py-0.5: a 24px tap target for a link that stands on its own line.
const sourceLinkClass =
  "inline-block py-0.5 text-sm text-dust underline decoration-line-strong underline-offset-4 transition-colors hover:text-cream hover:decoration-amber";

const bypass = bots.find((b) => b.isBypass);
const competitors = bots.filter((b) => !b.isBypass);

function SourceLink({ source, children }: { source: Source; children?: React.ReactNode }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className={sourceLinkClass}>
      {children ?? source.label}
      <span className="sr-only">
        {children ? `: ${source.label}` : ""} (opens in a new tab)
      </span>
    </a>
  );
}

/** A table or list cell: the value, then its source on its own line. */
function CellBody({ cell, own }: { cell: Cell; own: boolean }) {
  if (cell.value === null) return <span className="text-dust">Not stated</span>;
  return (
    <>
      <span className={own ? "text-cream" : "text-dune"}>{cell.value}</span>
      {cell.source ? (
        <span className="mt-1 block">
          <SourceLink source={cell.source}>Source</SourceLink>
        </span>
      ) : null}
    </>
  );
}

function NoteList({ notes }: { notes: Note[] }) {
  return (
    <ul role="list">
      {notes.map((note) => (
        <li key={note.text} className="border-t border-line py-3.5 first:border-t-0 first:pt-0">
          <p className={bodyText}>{note.text}</p>
          {note.source ? (
            <p className="mt-1">
              <SourceLink source={note.source} />
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function ComparePage() {
  return (
    <div className="pt-18">
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-24" aria-labelledby="compare-title">
        <div className="shell">
          <SectionHeader
            as="h1"
            id="compare-title"
            title="Discord music bots compared."
            lede={`Bypass next to three music bots that play today. Every claim about another bot links to that bot's own page, checked on ${checkedOnLong}.`}
          />

          <div className="grid gap-x-8 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <h2 className="font-display text-xl font-semibold text-cream">Where Bypass fits</h2>
              <p className={`mt-3 ${bodyText}`}>{bypass?.fit}</p>
            </div>
            <div className="lg:col-span-6">
              <h2 className="font-display text-xl font-semibold text-cream">When another bot may suit you better</h2>
              <ul className="mt-3 space-y-3" role="list">
                {competitors.map((bot) => (
                  <li key={bot.id} className={bodyText}>
                    <a href={`#${bot.id}`} className={inlineLink}>
                      {bot.name}
                    </a>
                    : {bot.fit}
                  </li>
                ))}
                <li className={bodyText}>{bypassCaveat}</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/invite?ref=site-compare"
              prefetch={false}
              data-track-location="compare"
              className="inline-flex h-13 items-center justify-center gap-3 rounded-lg bg-amber px-7 font-semibold text-coal transition-colors hover:bg-amber-hot"
            >
              <FaDiscord className="h-5 w-5" aria-hidden="true" />
              Add to Discord
            </Link>
            <a
              href="#sources"
              className="inline-flex h-13 items-center justify-center rounded-lg border border-line-strong px-7 font-semibold text-cream transition-colors hover:border-amber/60"
            >
              Check the sources
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-y border-line" aria-labelledby="table-title">
        <div className="shell">
          <h2 id="table-title" className={subheading}>
            Side by side
          </h2>
          <p className={`mt-4 max-w-[40rem] text-lg ${bodyText}`}>
            Not stated means we did not find it on the bot&apos;s own pages. It does not mean the bot lacks it.
          </p>

          {/* Desktop: one row per dimension, one column per bot */}
          <div className="mt-10 hidden lg:block overflow-hidden rounded-2xl border border-line bg-panel">
            <table className="w-full table-fixed text-left">
              <caption className="sr-only">
                Bypass, {competitors.map((b) => b.name).join(", ")} compared, with a source for every claim about
                another bot. Checked {checkedOnShort}.
              </caption>
              <colgroup>
                <col className="w-[20%]" />
                {bots.map((bot) => (
                  <col key={bot.id} className="w-[20%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-line">
                  <td className="px-5 py-4" />
                  {bots.map((bot) => (
                    <th
                      key={bot.id}
                      scope="col"
                      className={`px-5 py-4 font-display text-lg font-semibold text-cream ${bot.isBypass ? "bg-panel-raised" : ""}`}
                    >
                      {bot.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((column) => (
                  <tr key={column.key} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-5 align-top font-normal">
                      <span className="block text-sm font-medium text-cream">{column.label}</span>
                      {column.hint ? (
                        <span className="mt-1 block text-sm text-dust text-pretty">{column.hint}</span>
                      ) : null}
                    </th>
                    {bots.map((bot) => (
                      <td
                        key={bot.id}
                        className={`px-5 py-5 align-top text-[0.9375rem] leading-relaxed text-pretty ${bot.isBypass ? "bg-panel-raised" : ""}`}
                      >
                        <CellBody cell={bot.cells[column.key]} own={bot.isBypass} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile and tablet: one block per bot */}
          <ul className="mt-10 lg:hidden" role="list">
            {bots.map((bot) => (
              <li
                key={bot.id}
                className={`border-t border-line last:border-b py-6 ${bot.isBypass ? "-mx-[var(--gutter)] px-[var(--gutter)] bg-panel-raised" : ""}`}
              >
                <h3 className="font-display text-xl font-semibold text-cream">{bot.name}</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-x-8">
                  {columns.map((column) => (
                    <div key={column.key}>
                      <dt className="console-label">{column.label}</dt>
                      <dd className="mt-1 leading-relaxed text-pretty">
                        <CellBody cell={bot.cells[column.key]} own={bot.isBypass} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 lg:py-24" aria-labelledby="notes-title">
        <div className="shell">
          <h2 id="notes-title" className={subheading}>
            Bot by bot
          </h2>
          <div className="mt-10">
            {bots.map((bot) => (
              <div
                key={bot.id}
                id={bot.id}
                className="grid scroll-mt-24 gap-x-8 gap-y-4 border-t border-line py-8 lg:grid-cols-12"
              >
                <h3 className="font-display text-2xl font-semibold text-cream lg:col-span-4">{bot.name}</h3>
                <div className="lg:col-span-8">
                  <NoteList notes={bot.notes} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-y border-line" aria-labelledby="retired-title">
        <div className="shell">
          <h2 id="retired-title" className={subheading}>
            No longer playing music
          </h2>
          <p className={`mt-4 max-w-[40rem] text-lg ${bodyText}`}>
            Two bots from our earlier comparison have stopped, so they are not in the table.
          </p>
          <div className="mt-10 grid gap-x-8 gap-y-10 lg:grid-cols-2">
            {retiredBots.map((bot) => (
              <div key={bot.id} id={bot.id} className="scroll-mt-24 border-t border-line pt-6">
                <h3 className="font-display text-xl font-semibold text-cream">{bot.name}</h3>
                <p className="mt-1 text-sm text-dust">{bot.status}</p>
                <div className="mt-4">
                  <NoteList notes={bot.notes} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sources" className="scroll-mt-24 py-20 lg:py-24" aria-labelledby="sources-title">
        <div className="shell">
          <h2 id="sources-title" className={subheading}>
            Sources
          </h2>
          <p className={`mt-4 max-w-[40rem] text-lg ${bodyText}`}>
            Every page below was read on {checkedOnLong}. Server counts are what Discord&apos;s App Directory showed
            that day.
          </p>
          <div className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2">
            {sourceGroups.map((group) => (
              <div key={group.id} className="border-t border-line pt-5">
                <h3 className="font-display text-lg font-semibold text-cream">{group.name}</h3>
                <ul className="mt-3 space-y-3" role="list">
                  {group.sources.map((source) => (
                    <li key={source.url}>
                      <p className="text-sm text-dune text-pretty">{source.label}</p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-block break-all font-mono text-[0.8125rem] text-dust underline decoration-line-strong underline-offset-4 transition-colors hover:text-cream hover:decoration-amber"
                      >
                        {source.url}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-t border-line" aria-labelledby="method-title">
        <div className="shell grid gap-x-8 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="method-title" className={subheading}>
              How we checked
            </h2>
            <div className={`mt-6 space-y-4 ${bodyText}`}>
              <p>
                For each bot we read its website, documentation, premium or Patreon page and its Discord App Directory
                listing on {checkedOnLong}. A value in the table is what the bot says about itself, in our words, with
                a link to where it says it.
              </p>
              <p>
                We left out reviews, third-party lists, uptime claims and anything we could only judge by opinion.
                Prices are the lowest plan each bot lists, in US dollars before tax. Bypass facts come from our own
                code and pricing, which you can read on GitHub.
              </p>
              <p>
                FredBoat and Hydra were in our earlier comparison; they no longer play music, so we added Green-bot, a
                bot with music that is in use today.
              </p>
            </div>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <h2 className="font-display text-xl font-semibold text-cream">Spot an error? Tell us</h2>
            <p className={`mt-3 ${bodyText}`}>
              Prices and features change. If something here is wrong or out of date, post it in the support server with
              a link and we will fix the page.
            </p>
            <Link
              href="/support"
              prefetch={false}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60"
            >
              <FaDiscord className="h-4 w-4" aria-hidden="true" />
              Report it in the support server
            </Link>
            <p className="mt-4 text-sm text-dust">
              Or read{" "}
              <Link href="/#pricing" className={inlineLink}>
                Bypass pricing
              </Link>{" "}
              and{" "}
              <Link href="/status" prefetch={false} className={inlineLink}>
                the live status
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
