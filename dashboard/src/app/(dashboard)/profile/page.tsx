import { auth } from "@/auth";
import { PageHead } from "@/components/fest/account/PageHead";
import { getPlanStatus, hoursLeft, planName, type PlanStatus } from "@/components/fest/account/plan";
import { SignOutButton } from "@/components/fest/account/SignOutButton";
import { btn } from "@/components/fest/account/styles";
import { ArrowRight, Bot, LayoutGrid, LifeBuoy, ListMusic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Profile" };

const DEMO = process.env.NEXT_PUBLIC_DASH_DEMO === "1";

const LINKS = [
  { href: "/servers", icon: LayoutGrid, title: "Your servers", body: "Every server you share with Bypass, and the ones you can add it to." },
  { href: "/collections", icon: ListMusic, title: "Collections", body: "Setlists you saved with /collections, ready to load in any server." },
  { href: "/my-bots", icon: Bot, title: "Your own bots", body: "Run the Bypass player on a bot you created in the Discord Developer Portal." },
  { href: "/help", icon: LifeBuoy, title: "Help", body: "Getting started, the main commands, and answers to common questions." },
];

function PlanBlock({ plan, signedIn }: { plan: PlanStatus | null; signedIn: boolean }) {
  if (signedIn && !plan) {
    return (
      <>
        <p className="bill text-[44px] leading-none text-ink-3">Unknown</p>
        <p className="mt-2 text-[15px] text-ink-2">We couldn&apos;t read your plan just now. Reload the page in a moment.</p>
      </>
    );
  }
  const name = plan ? planName(plan) : "Free";
  const extras: string[] = [];
  if (plan?.booster) extras.push("You boost the support server, so you get 24/7 and full-length songs while the boost lasts.");
  if (plan?.voteUntil) extras.push(`Your top.gg vote keeps 24/7 on for ${hoursLeft(plan.voteUntil)}.`);
  return (
    <>
      <p className="bill text-[44px] leading-none">{name}</p>
      <p className="mt-2 text-[15px] text-ink-2">
        {plan?.patreon?.founder
          ? "Founder on Patreon: 24/7 and full-length songs in every server you use."
          : plan?.patreon
            ? "Paid membership on Patreon."
            : "Every core command is free. Founder adds 24/7 and full-length songs."}
      </p>
      {extras.map((x) => (
        <p key={x} className="mt-1.5 text-[15px] text-ink-2">
          {x}
        </p>
      ))}
    </>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session && !DEMO) redirect("/login");

  const user = {
    name: session?.user?.name ?? "rook",
    image: session?.user?.image ?? null,
    email: session?.user?.email ?? null,
    discordId: session?.user?.discordId ?? null,
  };
  const plan = user.discordId ? await getPlanStatus(user.discordId) : null;

  return (
    <>
      <PageHead title="Profile" status={session ? "Signed in with Discord" : "Demo account · sign in to see yours"} />

      <div className="grid gap-x-10 gap-y-12 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-12">
        {/* Who you are */}
        <section aria-label="Account" className="lg:col-span-4 xl:col-span-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" width={112} height={112} className="h-28 w-28 rounded-[4px] border-2 border-ink object-cover" />
          ) : (
            <span aria-hidden className="bill flex h-28 w-28 items-center justify-center rounded-[4px] border-2 border-ink bg-ink text-[64px] text-stock">
              {user.name.slice(0, 1)}
            </span>
          )}
          <h2 className="bill mt-5 break-words text-[44px]">{user.name}</h2>
          <dl className="mt-4 space-y-3 border-t border-rule pt-4 text-[14px]">
            <div>
              <dt className="text-ink-3">Discord ID</dt>
              <dd className="clock mt-0.5 text-[17px] text-ink">{user.discordId ?? "Not available"}</dd>
            </div>
            {user.email ? (
              <div>
                <dt className="text-ink-3">Email from Discord</dt>
                <dd className="mt-0.5 break-all text-ink">{user.email}</dd>
              </div>
            ) : null}
          </dl>
          {session ? <SignOutButton className="mt-6" /> : null}
        </section>

        <div className="min-w-0 lg:col-span-8 xl:col-span-7">
          {/* Plan */}
          <section aria-labelledby="plan">
            <h2 id="plan" className="bill text-[32px]">
              Plan
            </h2>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t-2 border-ink pt-4">
              <div className="min-w-0 max-w-[52ch]">
                <PlanBlock plan={plan} signedIn={Boolean(user.discordId)} />
              </div>
              <Link href="/premium" className={btn(plan?.patreon ? "outline" : "ink")}>
                {plan?.patreon ? "About Premium" : "See Premium"} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </section>

          {/* Elsewhere in your account */}
          <section aria-labelledby="shortcuts" className="mt-16">
            <h2 id="shortcuts" className="bill text-[32px]">
              Shortcuts
            </h2>
            <ul className="mt-3 border-b border-rule">
              {LINKS.map(({ href, icon: Icon, title, body }) => (
                <li key={href} className="border-t border-rule first:border-t-2 first:border-ink">
                  <Link
                    href={href}
                    className="group flex items-center gap-4 px-2 py-3.5 transition-colors duration-150 hover:bg-ink hover:text-stock focus-visible:bg-ink focus-visible:text-stock"
                  >
                    <Icon size={20} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">{title}</span>
                      <span className="block text-[14px] text-ink-2 transition-colors group-hover:text-stock/75 group-focus-visible:text-stock/75">
                        {body}
                      </span>
                    </span>
                    <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
