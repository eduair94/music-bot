"use client";

import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes } from "react";

/**
 * An "Add Bypass" link for one server: Discord's invite opens in a new tab
 * as before, and this tab moves to that server's page, which waits for
 * Bypass to arrive and then offers the extra stages.
 */
export function SetupInviteLink({
  guildId,
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { guildId: string; href: string }) {
  const router = useRouter();
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        router.push(`/servers/${guildId}?setup=1`);
      }}
    >
      {children}
    </a>
  );
}
