import { auth } from "@/auth";
import { ToastProvider } from "@/components/fest/Toast";
import { TopBar, type SwitcherGuild } from "@/components/fest/TopBar";
import { fetchUserGuilds } from "@/lib/discord";
import { enhanceGuildsWithBotInfo } from "@/lib/discord-server";
import type { Metadata } from "next";
import { Anybody, Public_Sans } from "next/font/google";
import { redirect } from "next/navigation";

const anybody = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-anybody",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public",
});

const OWNER_ID = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
const DEMO = process.env.NEXT_PUBLIC_DASH_DEMO === "1";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function switcherGuilds(accessToken: string | undefined): Promise<SwitcherGuild[]> {
  const demo: SwitcherGuild[] = DEMO ? [{ id: "demo", name: "Night Owls", icon: null }] : [];
  if (!accessToken) return demo;
  try {
    const guilds = await enhanceGuildsWithBotInfo(await fetchUserGuilds(accessToken));
    return [...demo, ...guilds.filter((g) => g.botInGuild).map((g) => ({ id: g.id, name: g.name, icon: g.icon }))];
  } catch {
    return demo;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session && !DEMO) redirect("/login");

  const guilds = await switcherGuilds(session?.accessToken);
  const user = {
    name: session?.user?.name ?? "rook",
    image: session?.user?.image ?? null,
  };
  const isOwner = Boolean(session?.user?.discordId && session.user.discordId === OWNER_ID);

  return (
    <div className={`fest ${anybody.variable} ${publicSans.variable}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-ink focus:px-3 focus:py-2 focus:text-stock">
        Skip to content
      </a>
      <ToastProvider>
        <TopBar guilds={guilds} user={user} isOwner={isOwner} />
        <main id="main" className="min-w-0">
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
