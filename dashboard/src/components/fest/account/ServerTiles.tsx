import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, ShieldCheck, User } from "lucide-react";
import { GuildBadge } from "../TopBar";

export interface ServerTile {
  id: string;
  name: string;
  icon: string | null;
  manage: boolean;
}

/**
 * A server with Bypass, printed flat on the stock under an ink rule. The
 * whole tile is the link; hover and focus fill it with ink.
 */
export function OpenTile({ guild }: { guild: ServerTile }) {
  return (
    <Link
      href={`/servers/${guild.id}`}
      className="group flex min-w-0 items-center gap-4 border-t-2 border-ink px-2 py-4 transition-colors duration-150 hover:bg-ink hover:text-stock focus-visible:bg-ink focus-visible:text-stock"
    >
      <span className="rounded-[4px] transition-shadow duration-150 group-hover:shadow-[0_0_0_1.5px_#f2ede4] group-focus-visible:shadow-[0_0_0_1.5px_#f2ede4]">
        <GuildBadge guild={guild} size={48} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="bill block truncate text-[30px] leading-[0.95]">{guild.name}</span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 transition-colors group-hover:text-stock/80 group-focus-visible:text-stock/80">
          {guild.manage ? <ShieldCheck size={14} aria-hidden /> : <User size={14} aria-hidden />}
          {guild.manage ? "Manage Server" : "Member"}
        </span>
      </span>
      <ArrowRight
        size={20}
        aria-hidden
        className="shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1"
      />
    </Link>
  );
}

/** A server you manage where Bypass is missing: dashed, because it's absent. */
export function InviteTile({ guild, href }: { guild: ServerTile; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Add Bypass to ${guild.name} (opens Discord)`}
      className="group flex min-w-0 items-center gap-3.5 rounded-[4px] border-[1.5px] border-dashed border-ink/45 px-3 py-3 transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-stock focus-visible:bg-ink focus-visible:text-stock"
    >
      <span className="opacity-80 grayscale transition-[filter,opacity] duration-150 group-hover:opacity-100 group-hover:grayscale-0">
        <GuildBadge guild={guild} size={36} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{guild.name}</span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold">
        <Plus size={14} aria-hidden />
        Add Bypass
        <ArrowUpRight size={14} aria-hidden className="opacity-60" />
      </span>
    </a>
  );
}
