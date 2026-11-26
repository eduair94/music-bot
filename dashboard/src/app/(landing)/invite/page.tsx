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
import { INVITE_PERMISSIONS } from "../../../../../shared/links";

export const dynamic = "force-dynamic";

// View/send in text channels (player panel), connect + speak in voice and
// stage channels, and set the voice channel status. See shared/links.ts.
const PERMISSIONS = INVITE_PERMISSIONS;
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
    integration_type: "0",
  });

  redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
