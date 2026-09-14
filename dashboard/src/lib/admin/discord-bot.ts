import "server-only";

const DISCORD_API_BASE = "https://discord.com/api/v10";

/** Make the bot leave a guild. 404 from Discord counts as already gone. */
export async function leaveGuild(guildId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, status: 500, error: "DISCORD_BOT_TOKEN not configured" };
  const res = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store"
  });
  if (res.status === 204 || res.status === 404) return { ok: true };
  if (res.status === 429) return { ok: false, status: 429, error: "Rate limited by Discord, retry later" };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: `Discord ${res.status}: ${body.slice(0, 200)}` };
}
