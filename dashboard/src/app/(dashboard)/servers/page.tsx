import { auth } from "@/auth";
import { PageHead } from "@/components/fest/account/PageHead";
import { SignOutButton } from "@/components/fest/account/SignOutButton";
import { InviteTile, OpenTile, type ServerTile } from "@/components/fest/account/ServerTiles";
import { btn } from "@/components/fest/account/styles";
import { fetchUserGuilds, hasManagePermission } from "@/lib/discord";
import { enhanceGuildsWithBotInfo } from "@/lib/discord-server";
import type { GuildWithBot } from "@/types/discord";
import { ArrowUpRight, RotateCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { botInviteUrl } from "../../../../../shared/links";

export const metadata: Metadata = { title: "Your servers" };

const DEMO = process.env.NEXT_PUBLIC_DASH_DEMO === "1";
const CLIENT_ID = process.env.DISCORD_BOT_CLIENT_ID || undefined;

const byName = (a: ServerTile, b: ServerTile) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function tile(g: GuildWithBot): ServerTile {
  return { id: g.id, name: g.name, icon: g.icon, manage: g.owner || hasManagePermission(g.permissions) };
}

/** Demo-only previews of the other states (`?preview=full|empty|error`), so they can be designed without Discord. */
function demoGuilds(): GuildWithBot[] {
  const g = (id: string, name: string, botInGuild: boolean, manage: boolean): GuildWithBot => ({
    id,
    name,
    icon: null,
    owner: false,
    permissions: manage ? "32" : "0",
    features: [],
    botInGuild,
    hasManagePermission: manage,
  });
  return [
    g("p1", "Lo-fi Library", true, false),
    g("p2", "Ranked Grind", true, true),
    g("p3", "Basement Shows", true, false),
    g("p4", "Study Hall", true, false),
    g("p5", "Karaoke Fridays", false, true),
    g("p6", "Tabletop Tuesdays", false, true),
    g("p7", "Weekend Raid Team", false, true),
  ];
}

export default async function ServersPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const session = await auth();
  if (!session && !DEMO) redirect("/login");
  const preview = DEMO ? (await searchParams).preview : undefined;

  let guilds: GuildWithBot[] = [];
  let error: string | null = null;
  if (preview === "error") {
    error = "Rate limited by Discord. Please try again in 4 seconds";
  } else if (preview === "full") {
    guilds = demoGuilds();
  } else if (session?.accessToken) {
    try {
      guilds = await enhanceGuildsWithBotInfo(await fetchUserGuilds(session.accessToken));
    } catch (e) {
      error = e instanceof Error ? e.message : "Discord didn't answer";
    }
  } else if (session) {
    error = "Your Discord sign-in has expired";
  }

  // Any member can open a server that has Bypass; Manage Server can add it elsewhere.
  const open = guilds.filter((g) => g.botInGuild).map(tile).sort(byName);
  const addable = guilds
    .filter((g) => !g.botInGuild && (g.owner || hasManagePermission(g.permissions)))
    .map(tile)
    .sort(byName);
  if (DEMO && !error && preview !== "empty") open.unshift({ id: "demo", name: "Night Owls", icon: null, manage: true });
  if (preview === "empty") addable.push(...demoGuilds().filter((g) => !g.botInGuild).map(tile));

  const status = error
    ? "Couldn't load your servers"
    : !session && !preview
      ? "Demo server · sign in to see yours"
      : `${open.length} with Bypass${addable.length ? ` · ${addable.length} you can add it to` : ""}`;

  return (
    <>
      <PageHead title="Your servers" status={status} />

      <div className="px-4 pb-24 pt-8 sm:px-6">
        {error ? (
          <section className="grid max-w-5xl items-center gap-8 py-6 sm:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <h2 className="bill text-[40px]">Discord didn&apos;t send your server list</h2>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                {error}. Your servers and settings are fine; this page just couldn&apos;t read the list. Try again in a few
                seconds, or sign in again if it keeps happening.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/servers" prefetch={false} className={btn("ink")}>
                  <RotateCw size={16} aria-hidden /> Try again
                </Link>
                {session ? <SignOutButton label="Sign in again" callbackUrl="/login" icon={false} /> : null}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dash/empty-stage.webp" alt="" width={960} height={640} className="w-full max-w-[18rem]" />
          </section>
        ) : null}

        {!error && open.length === 0 ? (
          <section className="grid max-w-5xl items-center gap-8 py-4 sm:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <h2 className="bill text-[40px]">No stage set up yet</h2>
              <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
                Bypass isn&apos;t in any server you&apos;re in. Add it to a server where you have Manage Server, then
                come back here to run the player, the queue and the permissions from the browser.
              </p>
              <a href={botInviteUrl(CLIENT_ID)} target="_blank" rel="noreferrer" className={btn("ink", "lg", "mt-6")}>
                Add Bypass to a server <ArrowUpRight size={16} aria-hidden />
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dash/empty-stage.webp" alt="" width={960} height={640} className="w-full max-w-[22rem] sm:order-none" />
          </section>
        ) : null}

        {open.length > 0 ? (
          <ul className="grid gap-x-8 border-b border-rule sm:grid-cols-2 xl:grid-cols-3" aria-label="Servers with Bypass">
            {open.map((g) => (
              <li key={g.id} className="min-w-0">
                <OpenTile guild={g} />
              </li>
            ))}
          </ul>
        ) : null}

        {addable.length > 0 ? (
          <section aria-labelledby="add-bypass" className="mt-16">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
              <h2 id="add-bypass" className="bill text-[36px]">
                Add Bypass
              </h2>
              <p className="pb-1 text-[14px] text-ink-2">Servers where you have Manage Server and Bypass isn&apos;t in yet.</p>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {addable.map((g) => (
                <li key={g.id} className="min-w-0">
                  <InviteTile guild={g} href={botInviteUrl(CLIENT_ID, g.id)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
