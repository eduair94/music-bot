/**
 * Command manual page: one per entry in data/commandDocs.ts, prerendered at
 * build time. Everything on it comes from that file, which is checked
 * against the bot's source.
 */

import CommandText from "@/components/landing/CommandText";
import DocText from "@/components/landing/DocText";
import { commandDocs, getCommandDoc, type CommandDoc, type CommandDocOption } from "@/data/commandDocs";
import { COMMAND_COUNT } from "@/data/commands";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaDiscord } from "react-icons/fa";

export const dynamicParams = false;

export function generateStaticParams() {
  return commandDocs.map((doc) => ({ slug: doc.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const doc = getCommandDoc((await params).slug);
  if (!doc) return {};
  const url = `/commands/${doc.slug}`;
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: url },
    openGraph: { title: doc.title, description: doc.description, url },
  };
}

const TYPE_LABEL: Record<CommandDocOption["type"], string> = {
  text: "Text",
  "true/false": "True/False",
  "whole number": "Whole number",
  file: "File",
  choice: "Choice",
};

const subheading = "font-display text-2xl md:text-3xl font-bold tracking-[-0.02em] text-cream text-balance";
const th = "console-label px-4 py-3 font-normal whitespace-nowrap";
const outlineButton =
  "inline-flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-sm font-semibold text-cream transition-colors hover:border-amber/60";
const outlineButtonLarge =
  "inline-flex h-12 items-center justify-center rounded-lg border border-line-strong px-6 font-semibold text-cream transition-colors hover:border-amber/60";
const ctaButton =
  "inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-amber px-6 font-semibold text-coal transition-colors hover:bg-amber-hot";

function OptionMeta({ option }: { option: CommandDocOption }) {
  return (
    <p className="mt-1 text-xs text-dust">
      {TYPE_LABEL[option.type]} · {option.required ? "required" : "optional"}
    </p>
  );
}

function OptionDetails({ option }: { option: CommandDocOption }) {
  return (
    <>
      <p>
        <DocText text={option.description} />
      </p>
      {option.choices && (
        <p className="mt-2 text-dust">
          Choices: <span className="text-dune">{option.choices.join(", ")}</span>
        </p>
      )}
      {option.autocomplete && <p className="mt-2 text-dust">Discord suggests values as you type.</p>}
    </>
  );
}

function OptionsTable({ doc }: { doc: CommandDoc }) {
  if (doc.subcommands) {
    // Options shared by several subcommands (every effect's `enabled`) are explained once, under the table.
    const subOptions = [...new Map(doc.subcommands.flatMap((sub) => sub.options).map((o) => [o.name, o])).values()];
    return (
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Subcommands of {doc.command}</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={th}>Subcommand</th>
              <th scope="col" className={th}>What it does</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {doc.subcommands.map((sub) => (
              <tr key={sub.name} className="align-top">
                <th scope="row" className="px-4 py-3.5 font-normal whitespace-nowrap">
                  <span className="text-cream">
                    <CommandText>{`${doc.command} ${sub.name}`}</CommandText>
                  </span>
                  {sub.options.map((option) => (
                    <p key={option.name} className="mt-1 text-xs text-dust">
                      <code className="font-mono">{option.name}</code> · {TYPE_LABEL[option.type]} ·{" "}
                      {option.required ? "required" : "optional"}
                    </p>
                  ))}
                </th>
                <td className="px-4 py-3.5 text-dune leading-relaxed text-pretty">
                  <DocText text={sub.description} />
                  {sub.options
                    .filter((option) => option.choices)
                    .map((option) => (
                      <p key={option.name} className="mt-1 text-dust">
                        <code className="font-mono">{option.name}</code>: {option.choices!.join(", ")}
                      </p>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subOptions.length > 0 && (
          <dl className="space-y-2 border-t border-line px-4 py-4 text-sm text-dune leading-relaxed text-pretty">
            {subOptions.map((option) => (
              <div key={option.name}>
                <dt className="inline">
                  <code className="font-mono text-cream">{option.name}</code>{" "}
                  <span className="text-dust">
                    ({TYPE_LABEL[option.type]}, {option.required ? "required" : "optional"}):
                  </span>{" "}
                </dt>
                <dd className="inline">
                  <DocText text={option.description} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  if (doc.options.length === 0) {
    return (
      <p className="text-dune leading-relaxed">
        <CommandText>{doc.command}</CommandText> has no options: type it and send.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Options of {doc.command}</caption>
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Option</th>
            <th scope="col" className={th}>What it does</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {doc.options.map((option) => (
            <tr key={option.name} className="align-top">
              <th scope="row" className="px-4 py-3.5 font-normal whitespace-nowrap">
                <code className="font-mono text-cream">{option.name}</code>
                <OptionMeta option={option} />
              </th>
              <td className="px-4 py-3.5 text-dune leading-relaxed text-pretty">
                <OptionDetails option={option} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddButton() {
  return (
    <Link href="/invite?ref=site-command" prefetch={false} data-track-location="command-page" className={ctaButton}>
      <FaDiscord className="h-5 w-5" aria-hidden="true" />
      Add to Discord
    </Link>
  );
}

export default async function CommandPage({ params }: PageProps) {
  const doc = getCommandDoc((await params).slug);
  if (!doc) notFound();

  const related = doc.related
    .map((slug) => getCommandDoc(slug))
    .filter((d): d is CommandDoc => Boolean(d));

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Commands", item: `${SITE_URL}/commands` },
      { "@type": "ListItem", position: 2, name: doc.command, item: `${SITE_URL}/commands/${doc.slug}` },
    ],
  };

  return (
    <div className="pt-18">
      <script
        type="application/ld+json"
        // JSON is escaped so a "<" in copy can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />

      <section className="pt-12 pb-20 lg:pt-20 lg:pb-24" aria-labelledby="command-title">
        <div className="shell">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-x-2 text-sm text-dune" role="list">
              <li>
                <Link
                  href="/commands"
                  className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-cream hover:decoration-amber"
                >
                  Commands
                </Link>
              </li>
              <li aria-hidden="true" className="text-dust">
                ›
              </li>
              <li aria-current="page" className="text-cream/80">
                <CommandText>{doc.command}</CommandText>
              </li>
            </ol>
          </nav>

          <div className="grid gap-x-8 gap-y-12 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <h1
                id="command-title"
                className="font-display font-bold text-cream text-4xl sm:text-5xl leading-[1.04] tracking-[-0.03em] text-balance"
              >
                {doc.title}
              </h1>
              <div className="mt-8 max-w-[44rem] space-y-5 text-lg text-dune leading-relaxed text-pretty">
                {doc.intro.map((paragraph, i) => (
                  <p key={i}>
                    <DocText text={paragraph} />
                  </p>
                ))}
              </div>

              <section className="mt-16" aria-labelledby="options-title">
                <h2 id="options-title" className={subheading}>
                  {doc.subcommands ? "Subcommands" : "Options"}
                </h2>
                <div className="mt-6">
                  <OptionsTable doc={doc} />
                </div>
              </section>

              <section className="mt-16" aria-labelledby="examples-title">
                <h2 id="examples-title" className={subheading}>
                  Examples
                </h2>
                <dl className="mt-6 border-t border-line">
                  {doc.examples.map((example) => (
                    <div
                      key={example.input + example.result}
                      className="grid gap-x-8 gap-y-1.5 border-b border-line py-4 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
                    >
                      <dt className="text-sm text-cream/90 [overflow-wrap:anywhere]">
                        <CommandText>{example.input}</CommandText>
                      </dt>
                      <dd className="text-sm text-dune leading-relaxed text-pretty">
                        <DocText text={example.result} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="mt-16" aria-labelledby="permissions-title">
                <h2 id="permissions-title" className={subheading}>
                  Who can use it
                </h2>
                <ul className="mt-6 space-y-3 text-dune leading-relaxed text-pretty" role="list">
                  {doc.permissions.map((note, i) => (
                    <li key={i} className="border-l border-line pl-4">
                      <DocText text={note} />
                    </li>
                  ))}
                  <li className="border-l border-line pl-4">
                    <DocText text="Admins can also turn a command off for members without Manage Server (`/commanddisable`), keep commands to some text channels (`/settings textchannels`), and block members from the bot (`/settings blacklist`)." />
                  </li>
                </ul>
              </section>

              <section className="mt-16" aria-labelledby="premium-title">
                <h2 id="premium-title" className={subheading}>
                  Premium
                </h2>
                <p className="mt-6 max-w-[44rem] text-dune leading-relaxed text-pretty">
                  <DocText text={doc.premium} />
                </p>
              </section>

              {doc.limits.length > 0 && (
                <section className="mt-16" aria-labelledby="limits-title">
                  <h2 id="limits-title" className={subheading}>
                    Limits
                  </h2>
                  <ul className="mt-6 space-y-3 text-dune leading-relaxed text-pretty" role="list">
                    {doc.limits.map((limit, i) => (
                      <li key={i} className="border-l border-line pl-4">
                        <DocText text={limit} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {doc.dashboard && (
                <section className="mt-16" aria-labelledby="dashboard-title">
                  <h2 id="dashboard-title" className={subheading}>
                    On the web dashboard
                  </h2>
                  <p className="mt-6 max-w-[44rem] text-dune leading-relaxed text-pretty">
                    <DocText text={doc.dashboard} />
                  </p>
                  <Link href="/dashboard" prefetch={false} className={`mt-6 ${outlineButton}`}>
                    Open the dashboard
                  </Link>
                </section>
              )}
            </div>

            <aside className="lg:col-span-4 lg:col-start-9" aria-label={`${doc.command} at a glance`}>
              <div className="rounded-2xl border border-line bg-panel p-6 lg:sticky lg:top-28">
                <p className="console-label">Syntax</p>
                <p className="mt-3 text-sm text-cream [overflow-wrap:anywhere]">
                  <CommandText>{doc.usage}</CommandText>
                </p>
                <p className="mt-6 text-sm text-dune leading-relaxed text-pretty">
                  Bypass is free to add. You need the Manage Server permission on the server you pick.
                </p>
                <div className="mt-5">
                  <AddButton />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-panel/40 border-y border-line" aria-labelledby="related-title">
        <div className="shell">
          <h2 id="related-title" className={subheading}>
            Related commands
          </h2>
          <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {related.map((r) => (
              <li key={r.slug} className="border-t border-line pt-5">
                <Link
                  href={`/commands/${r.slug}`}
                  className="text-cream underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-amber"
                >
                  <CommandText>{r.command}</CommandText>
                </Link>
                <p className="mt-2 text-sm text-dune leading-relaxed text-pretty">{r.summary}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <AddButton />
            <Link href="/commands" className={outlineButtonLarge}>
              Browse all {COMMAND_COUNT} commands
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
