"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Search, User, Crown, LifeBuoy, ListMusic, Bot, Shield, Plus, MessageSquare } from "lucide-react";
import FeedbackTrigger from "@/components/feedback/FeedbackTrigger";
import { cx, Menu, MenuItem } from "./ui";

export interface SwitcherGuild {
  id: string;
  name: string;
  icon: string | null;
}

/** Four stage bars: the bill's mark. */
export function FestMark({ size = 28 }: { size?: number }) {
  const bars = ["#e8402a", "#2a5bd7", "#f5b700", "#1f9d55"];
  const h = [0.62, 1, 0.78, 0.5];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      {bars.map((c, i) => (
        <rect key={c} x={2 + i * 6.5} y={26 - 24 * h[i]} width="5" height={24 * h[i]} fill={c} />
      ))}
    </svg>
  );
}

function guildIcon(g: SwitcherGuild, size = 64): string | null {
  return g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=${size}` : null;
}

export function GuildBadge({ guild, size = 24 }: { guild: SwitcherGuild; size?: number }) {
  const src = guildIcon(guild);
  const initials = guild.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-[3px] border border-ink/20" />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] bg-ink font-bold text-stock"
    >
      {initials}
    </span>
  );
}

const GUILD_TABS = [
  { href: "", label: "Fleet" },
  { href: "/player", label: "Player" },
  { href: "/permissions", label: "Permissions" },
  { href: "/settings", label: "Settings" },
  { href: "/activity", label: "Activity" },
];

const ROOT_TABS = [
  { href: "/servers", label: "Servers" },
  { href: "/collections", label: "Collections" },
  { href: "/premium", label: "Premium" },
];

export function TopBar({
  guilds,
  user,
  isOwner,
}: {
  guilds: SwitcherGuild[];
  user: { name: string; image: string | null };
  isOwner: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const m = pathname.match(/^\/servers\/([^/]+)/);
  const guildId = m?.[1];
  const current = guilds.find((g) => g.id === guildId);
  const base = guildId ? `/servers/${guildId}` : "";
  const tabs = guildId ? GUILD_TABS.map((t) => ({ ...t, href: base + t.href })) : ROOT_TABS;
  const isActive = (href: string) =>
    guildId && href === base ? pathname === base : pathname === href || pathname.startsWith(href + "/");

  const openSearch = () => window.dispatchEvent(new CustomEvent("fest:add-song"));

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-stock/95 backdrop-blur-[2px] pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/servers" className="flex shrink-0 items-center gap-2" aria-label="Bypass servers">
          <FestMark />
          <span className="bill hidden text-[30px] sm:inline">Bypass</span>
        </Link>

        <Menu
          label="Switch server"
          trigger={({ open, toggle, id }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={id}
              className="flex h-10 max-w-[13rem] items-center gap-2 rounded-[4px] border border-ink px-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-stock"
            >
              {current ? <GuildBadge guild={current} size={22} /> : null}
              <span className="truncate">{current?.name ?? "Your servers"}</span>
              <ChevronDown size={14} className={cx("shrink-0 transition-transform", open && "rotate-180")} />
            </button>
          )}
        >
          {(close) => (
            <div className="max-h-[60vh] overflow-y-auto">
              {guilds.length === 0 ? (
                <p className="px-3 py-2 text-sm text-ink-3">No servers with Bypass yet.</p>
              ) : (
                guilds.map((g) => (
                  <Link
                    key={g.id}
                    href={`/servers/${g.id}`}
                    onClick={close}
                    className={cx(
                      "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-ink hover:text-stock",
                      g.id === guildId && "font-semibold",
                    )}
                  >
                    <GuildBadge guild={g} size={22} />
                    <span className="truncate">{g.name}</span>
                  </Link>
                ))
              )}
              <div className="my-1 border-t border-rule" />
              <Link href="/servers" onClick={close} className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-ink hover:text-stock">
                <Plus size={16} /> Add Bypass to a server
              </Link>
            </div>
          )}
        </Menu>

        <nav aria-label="Sections" className="hidden min-w-0 items-center gap-1 lg:flex">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive(t.href) ? "page" : undefined}
              className={cx(
                "rounded-[4px] px-3 py-2 text-sm font-semibold transition-colors",
                isActive(t.href) ? "bg-ink text-stock" : "text-ink hover:bg-ink/[0.07]",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {guildId ? (
            <button
              type="button"
              onClick={openSearch}
              className="hidden h-10 w-[min(26rem,30vw)] items-center gap-2 rounded-[4px] border border-ink/30 bg-paper px-3 text-sm text-ink-3 transition-colors hover:border-ink md:flex"
            >
              <Search size={16} />
              <span className="truncate">Search songs or paste a link</span>
              <kbd className="ml-auto rounded-[3px] border border-ink/25 px-1.5 text-xs text-ink-2">/</kbd>
            </button>
          ) : null}
          {guildId ? (
            <button
              type="button"
              onClick={openSearch}
              aria-label="Add a song"
              className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-ink md:hidden"
            >
              <Search size={18} />
            </button>
          ) : null}

          <FeedbackTrigger
            skin="fest"
            label="Send feedback"
            className="flex h-10 items-center gap-2 rounded-[4px] border border-ink px-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-stock"
          >
            <MessageSquare size={16} aria-hidden />
            <span className="hidden xl:inline">Feedback</span>
          </FeedbackTrigger>

          <Menu
            label="Account"
            align="right"
            trigger={({ open, toggle, id }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={id}
                className="flex h-10 items-center gap-2 rounded-[4px] border border-ink px-1.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-stock sm:pr-3"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" width={26} height={26} className="rounded-[3px]" />
                ) : (
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[3px] bg-stage-2 text-xs text-white">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[8rem] truncate sm:inline">{user.name}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLink href="/profile" onClick={close} icon={<User size={16} />}>Profile</MenuLink>
                <MenuLink href="/collections" onClick={close} icon={<ListMusic size={16} />}>Collections</MenuLink>
                <MenuLink href="/premium" onClick={close} icon={<Crown size={16} />}>Premium</MenuLink>
                <MenuLink href="/my-bots" onClick={close} icon={<Bot size={16} />}>Your own bots</MenuLink>
                <MenuLink href="/help" onClick={close} icon={<LifeBuoy size={16} />}>Help</MenuLink>
                {isOwner ? <MenuLink href="/admin" onClick={close} icon={<Shield size={16} />}>Owner console</MenuLink> : null}
                <div className="my-1 border-t border-rule" />
                <MenuItem onSelect={() => void signOut({ callbackUrl: "/" })}>
                  <LogOut size={16} /> Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {/* Below lg the sections scroll as a row under the bar. */}
      <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-t border-rule px-4 py-1.5 lg:hidden">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-[4px] px-3 py-1.5 text-sm font-semibold",
              isActive(t.href) ? "bg-ink text-stock" : "text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function MenuLink({ href, onClick, icon, children }: { href: string; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-stock"
    >
      {icon}
      {children}
    </Link>
  );
}
