/**
 * Support Page
 *
 * Redirects users to the Discord support server
 */

import { DISCORD_INVITE } from "@/lib/site";
import { redirect } from "next/navigation";

export default function SupportPage() {
  redirect(DISCORD_INVITE);
}
