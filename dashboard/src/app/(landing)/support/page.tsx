/**
 * Support Page
 * 
 * Redirects users to the Discord support server
 */

import { redirect } from "next/navigation";

export default function SupportPage() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE || 'https://discord.gg/5w6PErKpyK';
  
  if (discordInvite) {
    redirect(discordInvite);
  }
  
  // Fallback if no Discord invite is configured
  redirect("/");
}
