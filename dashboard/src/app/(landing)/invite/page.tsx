/**
 * Bot Invite Page
 * 
 * Redirects to the Discord OAuth2 authorization URL
 */

import { redirect } from "next/navigation";

const BOT_CLIENT_ID = process.env.DISCORD_BOT_CLIENT_ID || process.env.AUTH_DISCORD_ID;

export default function InvitePage() {
  // Permissions: View Channels, Connect, Speak, Use Voice Activity
  const permissions = "36700160";
  const scopes = "bot applications.commands";
  
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${BOT_CLIENT_ID}&permissions=${permissions}&scope=${encodeURIComponent(scopes)}`;
  
  redirect(inviteUrl);
}
