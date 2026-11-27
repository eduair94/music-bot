import { auth } from "@/auth";
import { InviteSlab } from "@/components/fest/account/InviteSlab";
import { PageHead } from "@/components/fest/account/PageHead";
import { SignOutButton } from "@/components/fest/account/SignOutButton";
import { InviteTile, ServerRow, type ServerTile } from "@/components/fest/account/ServerTiles";
import { btn } from "@/components/fest/account/styles";
import { demoFleet } from "@/lib/dash/demo";
import { fetchUserGuilds, hasManagePermission } from "@/lib/discord";
import { enhanceGuildsWithBotInfo } from "@/lib/discord-server";
import { presenceFrom, readStagePresence, type PresenceSource, type StagePresence } from "@/lib/stage-presence";
import type { GuildWithBot } from "@/types/discord";
import { RotateCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { instanceName } from "../../../../../shared/fleet";
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

/** Synthetic stage presence for the `?preview=full` servers; Basement Shows is left without live state. */
function demoPresence(): Map<string, StagePresence> {
  const lane = (instance: number, inGuild: boolean, online = true, playing?: [string, string, string]): PresenceSource => ({
    instance,
    name: instanceName(instance),
    inGuild,
    online,
    playback: playing ? { isConnected: true, voiceChannelName: playing[2], currentTrack: { title: playing[0], author: playing[1] } } : null,
  });
  return new Map([
    ["p1", presenceFrom([lane(1, true, true, ["Weightless", "Marconi Union", "Reading Room"]), lane(2, true), lane(3, false), lane(4, false)])],
    [
      "p2",
      presenceFrom([
        lane(1, true, true, ["Sandstorm", "Darude", "Squad 1"]),
        lane(2, true, true, ["Levels", "Avicii", "Squad 2"]),
        lane(3, true),
        lane(4, true, false),
      ]),
    ],
    ["p4", presenceFrom([lane(1, true), lane(2, false), lane(3, false), lane(4, false)])],
  ]);
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

  // Stage presence: one Redis pipeline for every real server (none when it's
  // unavailable: rows then show without live state); demo servers use fixtures.
  const presence = preview
    ? demoPresence()
    : await readStagePresence(open.filter((g) => g.id !== "demo").map((g) => g.id));
  if (DEMO && open.some((g) => g.id === "demo")) presence.set("demo", presenceFrom(demoFleet().instances));
  const onAir = open.reduce((n, g) => n + (presence.get(g.id)?.onAir ?? 0), 0);
  const live = open.some((g) => presence.has(g.id));

  const status = error
    ? "Couldn't load your servers"
    : !session && !preview
      ? `Demo server · ${onAir} on air · sign in to see yours`
      : `${open.length} with Bypass${live ? ` · ${onAir} on air` : ""}${addable.length ? ` · ${addable.length} you can add it to` : ""}`;

  // A short list leaves the rest of the page to the open stage: invite Bypass right there.
  const slab = !error && open.length <= 3;
  const invites = addable.map((guild) => ({ guild, href: botInviteUrl(CLIENT_ID, guild.id) }));

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

        {open.length > 0 ? (
          <ul className="border-b border-ink" aria-label="Servers with Bypass">
            {open.map((g, i) => (
              <li key={g.id} className="min-w-0">
                <ServerRow guild={g} presence={presence.get(g.id)} row={i} />
              </li>
            ))}
          </ul>
        ) : null}

        {slab ? <InviteSlab empty={open.length === 0} inviteHref={botInviteUrl(CLIENT_ID)} addable={invites} /> : null}

        {!slab && invites.length > 0 ? (
          <section aria-labelledby="add-bypass" className="mt-16">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
              <h2 id="add-bypass" className="bill text-[36px]">
                Add Bypass
              </h2>
              <p className="pb-1 text-[14px] text-ink-2">Servers where you have Manage Server and Bypass isn&apos;t in yet.</p>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {invites.map(({ guild, href }) => (
                <li key={guild.id} className="min-w-0">
                  <InviteTile guild={guild} href={href} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
