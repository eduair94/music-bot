import SectionHeader from "@/components/landing/SectionHeader";
import Testimonials from "@/components/landing/Testimonials";
import type { PublicStats } from "@/lib/public-stats-shape";
import type { Testimonial } from "@/lib/testimonials-shape";
import { GITHUB_URL } from "@/lib/site";
import Link from "next/link";
import { INVITE_PERMISSION_LIST } from "../../../../shared/invitePermissions";

const SPELLED = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const permissionCount = INVITE_PERMISSION_LIST.length;
const permissionWord = SPELLED[permissionCount] ?? String(permissionCount);

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const linkClass =
  "text-sm font-medium text-cream underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-amber";

interface TrustItem {
  title: string;
  body: string;
  meta: React.ReactNode;
  link: React.ReactNode;
}

/**
 * Things a server admin can verify before inviting Bypass: the source, the
 * live status, the permission list. Live values come from the page (they may
 * be null, in which case the line is left out rather than faked). Quotes the
 * owner featured follow the three checks; with none, that block is absent.
 */
export default function Trust({
  stats,
  pushedAt,
  testimonials = [],
}: {
  stats: PublicStats | null;
  pushedAt: string | null;
  testimonials?: Testimonial[];
}) {
  const items: TrustItem[] = [
    {
      title: "Open source",
      body: "The bot and this website are public on GitHub under the MIT license. Read how playback, storage and payments work, or open an issue.",
      meta: pushedAt ? <>Last code push {dateFormat.format(new Date(pushedAt))}</> : null,
      link: (
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Read the code<span className="sr-only"> on GitHub (opens in a new tab)</span>
        </a>
      ),
    },
    {
      title: "Live status",
      body: "Every player sends a heartbeat every 20 seconds. The status page shows which players are up, their gateway latency and how long they have been running.",
      meta: stats ? (
        <span className="inline-flex items-center gap-2.5">
          <span className={stats.online === 0 ? "led led--off" : "led"} aria-hidden="true" />
          <span>
            <span className="font-mono tabular-nums text-cream">{stats.online}</span> of{" "}
            <span className="font-mono tabular-nums text-cream">{stats.players.length}</span> players online
          </span>
        </span>
      ) : null,
      link: (
        <Link href="/status" prefetch={false} className={linkClass}>
          Open the status page
        </Link>
      ),
    },
    {
      title: `${permissionWord[0].toUpperCase()}${permissionWord.slice(1)} permissions, no admin`,
      body: "Bypass asks only for what voice playback and the player message need. It never asks for Administrator, moderation or any Manage permission.",
      meta: null,
      link: (
        <Link href="/install#permissions" className={linkClass}>
          See each permission and why
        </Link>
      ),
    },
  ];

  return (
    <section id="trust" className="py-24 lg:py-32 border-b border-line" aria-labelledby="trust-title">
      <div className="shell">
        <SectionHeader
          id="trust-title"
          title="Check it before you add it."
          lede="The code is public, the status is live, and every permission is listed with the reason it is there."
        />

        {/* Four-row subgrid (title, body, live line, link) so the rows line up across columns. */}
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {items.map((item) => (
            <li key={item.title} className="row-span-4 grid grid-rows-subgrid gap-y-0 border-t border-line pt-5 sm:pt-6">
              <h3 className="font-display text-xl font-semibold text-cream">{item.title}</h3>
              <p className="mt-2 max-w-[40ch] text-[0.9375rem] text-dune leading-relaxed text-pretty">{item.body}</p>
              <p className="mt-4 text-sm text-dune empty:mt-0">{item.meta}</p>
              <p className="mt-4">{item.link}</p>
            </li>
          ))}
        </ul>

        <Testimonials items={testimonials} />
      </div>
    </section>
  );
}
