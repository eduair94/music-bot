/**
 * Bot Invite Page
 *
 * Redirects to the Discord OAuth2 authorization URL.
 *
 * Rendered per request on purpose: the client id comes from the container's
 * runtime env (docker `env_file`), which is NOT present during `docker build`.
 * A static prerender would bake `client_id=undefined` into the redirect.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Permissions: View Channels, Connect, Speak, Use Voice Activity
const PERMISSIONS = "36700160";
const SCOPES = "bot applications.commands";

export default function InvitePage() {
  const clientId =
    process.env.DISCORD_BOT_CLIENT_ID ||
    process.env.NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID ||
    process.env.AUTH_DISCORD_ID;

  if (!clientId) {
    console.error(
      "[invite] No Discord client id in env (DISCORD_BOT_CLIENT_ID / NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID / AUTH_DISCORD_ID); sending visitor to the support server instead."
    );
    redirect("/support");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: PERMISSIONS,
    scope: SCOPES,
  });

  redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
