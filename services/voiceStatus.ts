import { Client, DiscordAPIError } from "discord.js";
import { truncate } from "../utils/format";

/**
 * Voice channel status ("♪ Song — Artist" under the channel name), the way
 * people see what is playing without opening the text channel.
 *
 * Needs the Set Voice Channel Status permission. Servers that invited the bot
 * before it was in the invite link lack it, so a refusal is remembered for an
 * hour instead of being retried on every track.
 */
const denied = new Map<string, number>();
const DENY_TTL_MS = 60 * 60 * 1000;
const lastStatus = new Map<string, string>();

export async function setVoiceStatus(client: Client, channelId: string | null | undefined, status: string): Promise<void> {
  if (!channelId) return;
  const deniedAt = denied.get(channelId);
  if (deniedAt && Date.now() - deniedAt < DENY_TTL_MS) return;

  const text = truncate(status, 120);
  if (lastStatus.get(channelId) === text) return;

  try {
    await client.rest.put(`/channels/${channelId}/voice-status`, { body: { status: text } });
    if (text) lastStatus.set(channelId, text);
    else lastStatus.delete(channelId);
  } catch (error) {
    const code = error instanceof DiscordAPIError ? error.code : undefined;
    // 50013 Missing Permissions, 50001 Missing Access, 10003 Unknown Channel
    if (code === 50013 || code === 50001 || code === 10003) {
      if (!denied.has(channelId)) console.log(`[VoiceStatus] No permission to set status in ${channelId} (${code}); skipping for 1 h`);
      denied.set(channelId, Date.now());
      return;
    }
    console.warn(`[VoiceStatus] Could not set status on ${channelId}:`, (error as Error)?.message ?? error);
  }
}

export function clearVoiceStatus(client: Client, channelId: string | null | undefined): Promise<void> {
  return setVoiceStatus(client, channelId, "");
}

export function nowPlayingStatus(title: string, author?: string | null): string {
  const artist = author && author !== "Unknown" ? ` — ${author}` : "";
  return `♪ ${title}${artist}`;
}
