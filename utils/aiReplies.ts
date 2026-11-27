import { InteractionEditReplyOptions, InteractionReplyOptions, MessageFlags } from "discord.js";
import { AiAccess, remainingToday } from "../services/ai/aiAccess";
import type { ClaudeFailure } from "../services/ai/claudeCredits";
import { i18n } from "./i18n";
import { premiumUpsell } from "./upsell";

/** Replies shared by /ai and /radio prompt. */

/** Out of AI uses today: the Founder offer for free servers, a plain note for premium ones. */
export function aiQuotaMessage(access: AiAccess): InteractionReplyOptions {
  if (!access.premium) {
    return { ...premiumUpsell("ai_dj"), content: `⏳ ${i18n.__mf("ai.trialUsed", { limit: access.daily })}` } as InteractionReplyOptions;
  }
  return { content: `⏳ ${i18n.__mf("ai.dailyLimit", { limit: access.daily })}`, flags: MessageFlags.Ephemeral };
}

export function aiFailureMessage(reason: ClaudeFailure): string {
  switch (reason) {
    case "unconfigured":
      return `🤖 ${i18n.__("ai.unconfigured")}`;
    case "unavailable":
      return `🤖 ${i18n.__("ai.busy")}`;
    case "refused":
      return `🤖 ${i18n.__("ai.refused")}`;
    default:
      return `🤖 ${i18n.__("ai.failed")}`;
  }
}

/** "Free trial: 2 of 3 left today" for servers without premium; null otherwise. */
export async function aiTrialNote(access: AiAccess, guildId: string): Promise<string | null> {
  if (access.premium || access.unlimited) return null;
  const left = await remainingToday(guildId, access.daily).catch(() => null);
  if (left === null) return null;
  return i18n.__mf("ai.trialNote", { left, limit: access.daily });
}

/** A reply for an already deferred (public) interaction: the private flag can't apply there. */
export function publicReply(reply: InteractionReplyOptions): InteractionEditReplyOptions {
  const { flags: _flags, ephemeral: _ephemeral, ...rest } = reply as InteractionReplyOptions & { ephemeral?: boolean };
  return rest as InteractionEditReplyOptions;
}
