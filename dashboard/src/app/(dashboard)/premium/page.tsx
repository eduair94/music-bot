import { auth } from "@/auth";
import { PageHead } from "@/components/fest/account/PageHead";
import { getPlanStatus, hoursLeft, type PlanStatus } from "@/components/fest/account/plan";
import { PremiumPass } from "@/components/fest/account/PremiumPass";
import { btn } from "@/components/fest/account/styles";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import {
  FOUNDER_PRICE_USD,
  FOUNDER_SPOTS,
  PATREON_URL,
  SUPPORT_INVITE_URL,
  TOPGG_VOTE_URL,
} from "../../../../../shared/links";

export const metadata: Metadata = { title: "Premium" };

/**
 * Only perks the bot actually enforces (utils/premiumCheck.ts, utils/playFlow.ts,
 * services/boosters.ts). PRODUCT.md: never claim priority queue, unlimited
 * playlists or bitrate as a quality difference.
 */
const PERKS = [
  {
    title: "24/7 in your voice channel",
    body: "Turn it on with /247. Bypass stays through the quiet stretches and comes back after a restart.",
  },
  {
    title: "Full-length songs",
    body: "When a server caps song length, the songs you queue still play to the end.",
  },
  {
    title: "Every server you use",
    body: "Perks follow your Discord account, so they work wherever you play music with Bypass.",
  },
  {
    title: "The Founders role",
    body: "Your name under Founders in the Bypass support server, synced from Patreon.",
  },
];

function statusLine(plan: PlanStatus | null): string {
  if (!plan) return `Founder is $${FOUNDER_PRICE_USD} a month on Patreon`;
  if (plan.patreon?.founder) return "You're a Founder. Thank you for backing Bypass.";
  if (plan.patreon) return `You back Bypass on Patreon${plan.patreon.tierTitle ? ` (${plan.patreon.tierTitle})` : ""}`;
  if (plan.booster) return "You're boosting the support server, so Founder perks are on";
  if (plan.voteUntil) return `Your vote perks are on for ${hoursLeft(plan.voteUntil)}`;
  return "You're on Free";
}

export default async function PremiumPage() {
  const session = await auth();
  const plan = session?.user?.discordId ? await getPlanStatus(session.user.discordId) : null;
  const patron = Boolean(plan?.patreon);

  return (
    <>
      <PageHead title="Premium" status={statusLine(plan)} />

      <div className="grid gap-x-10 px-4 pb-24 sm:px-6 lg:grid-cols-12">
        {/* The pass hangs from the page's rule. */}
        <div className="mx-auto w-full max-w-[15rem] sm:max-w-[19rem] lg:col-span-5 lg:max-w-none xl:col-span-4 xl:col-start-2">
          <div className="lg:sticky lg:top-16">
            <PremiumPass price={FOUNDER_PRICE_USD} spots={FOUNDER_SPOTS} />
          </div>
        </div>

        <div className="min-w-0 pt-10 lg:col-span-7 lg:pt-14 xl:col-span-6">
          <h2 className="bill text-[40px]">What Founders get</h2>
          <ul className="mt-5 max-w-[46rem] border-b border-rule">
            {PERKS.map((p) => (
              <li key={p.title} className="grid gap-1 border-t border-rule py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                <h3 className="text-[16px] font-semibold text-ink">{p.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-2">{p.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href={PATREON_URL} target="_blank" rel="noreferrer" className={btn("ink", "lg")}>
              {patron ? "Manage on Patreon" : "Become a Founder"} <ArrowUpRight size={16} aria-hidden />
            </a>
            <p className="text-[13px] text-ink-3">
              ${FOUNDER_PRICE_USD} a month, billed by Patreon. Cancel there anytime.
            </p>
          </div>

          <h2 className="bill mt-20 text-[40px]">Two free ways in</h2>
          <div className="mt-5 grid max-w-[46rem] border-t-2 border-ink sm:grid-cols-2">
            <section className="py-5 sm:pr-6">
              <h3 className="bill text-[28px]">Vote on top.gg</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                Each vote turns on 24/7 mode for you for 12 hours. When it runs out, vote again.
              </p>
              <a href={TOPGG_VOTE_URL} target="_blank" rel="noreferrer" className={btn("outline", "md", "mt-4")}>
                Vote on top.gg <ArrowUpRight size={15} aria-hidden />
              </a>
            </section>
            <section className="border-t border-rule py-5 sm:border-l sm:border-t-0 sm:pl-6">
              <h3 className="bill text-[28px]">Boost the support server</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                Boosters get 24/7 and full-length songs for as long as the boost lasts. Nothing to link.
              </p>
              <a href={SUPPORT_INVITE_URL} target="_blank" rel="noreferrer" className={btn("outline", "md", "mt-4")}>
                Join the support server <ArrowUpRight size={15} aria-hidden />
              </a>
            </section>
          </div>

          <h2 className="bill mt-20 text-[40px]">How it works</h2>
          <ol className="mt-5 max-w-[62ch] space-y-4">
            {[
              <>Join the Founder tier on Patreon.</>,
              <>In your Patreon settings, connect your Discord account so Bypass can match you.</>,
              <>
                Bypass picks it up on its own. Check with <code className="[font-family:inherit] font-semibold text-ink">/patreon status</code>, or
                run <code className="[font-family:inherit] font-semibold text-ink">/patreon sync</code> if it hasn&apos;t shown up yet.
              </>,
            ].map((step, i) => (
              <li key={i} className="flex gap-4 text-[15px] leading-relaxed text-ink-2">
                <span className="clock mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-ink text-[15px] text-ink">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
