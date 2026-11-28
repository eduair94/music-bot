import SectionHeader from "@/components/landing/SectionHeader";
import { bots, checkedOnShort, homeColumns } from "@/data/comparison";
import Link from "next/link";

/*
 * Short version of /compare: the home columns of src/data/comparison.ts. Every
 * competitor value there carries its source; this table links to the list.
 */

// Bot name, then the home columns; sized so the longer Bypass values wrap to two lines at most.
const COLUMN_WIDTHS = ["w-[13%]", "w-[18%]", "w-[18%]", "w-[27%]", "w-[24%]"];

const linkClass =
  "text-dune underline decoration-line-strong underline-offset-4 transition-colors hover:text-cream hover:decoration-amber";

function CellValue({ value, own }: { value: string | null; own: boolean }) {
  if (value === null) return <span className="text-dust">Not stated</span>;
  return <span className={own ? "text-cream" : "text-dune"}>{value}</span>;
}

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
          title="How Bypass compares."
          lede="Three music bots that play today, next to Bypass, from what each one publishes about itself."
        />

        {/* Desktop table */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-line bg-panel">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">
              Discord music bots compared by free bots per server, paid plans, web features and stated audio quality
            </caption>
            <colgroup>
              {COLUMN_WIDTHS.map((width, i) => (
                <col key={i} className={width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-6 py-4 console-label font-normal">
                  Bot
                </th>
                {homeColumns.map((column) => (
                  <th key={column.key} scope="col" className="px-6 py-4 console-label font-normal">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr
                  key={bot.id}
                  className={`border-b border-line last:border-0 ${bot.isBypass ? "bg-panel-raised" : ""}`}
                >
                  <th
                    scope="row"
                    className="px-6 py-5 align-baseline whitespace-nowrap font-display text-lg font-semibold text-cream"
                  >
                    {bot.name}
                  </th>
                  {homeColumns.map((column) => (
                    <td key={column.key} className="px-6 py-5 align-baseline text-pretty">
                      <CellValue value={bot.cells[column.key].value} own={bot.isBypass} />
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
              key={bot.id}
              className={`border-t border-line last:border-b py-6 ${bot.isBypass ? "-mx-[var(--gutter)] px-[var(--gutter)] bg-panel-raised" : ""}`}
            >
              <h3 className="font-display text-xl font-semibold text-cream">{bot.name}</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4">
                {homeColumns.map((column) => (
                  <div key={column.key}>
                    <dt className="console-label">{column.label}</dt>
                    <dd className="mt-1">
                      <CellValue value={bot.cells[column.key].value} own={bot.isBypass} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-dust">
          Checked {checkedOnShort} ·{" "}
          <Link href="/compare#sources" className={linkClass}>
            sources
          </Link>{" "}
          ·{" "}
          <Link href="/compare" className={linkClass}>
            full comparison
          </Link>
        </p>
      </div>
    </section>
  );
}
