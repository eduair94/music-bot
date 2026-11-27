import { ChatInputCommandInteraction } from "discord.js";
import { PatreonService } from "../services/patreon";
import { PremiumFeature } from "./premiumFeatures";
import { premiumUpsell } from "./upsell";
import { hasActiveVote, isVotePerk } from "../services/votes";
import { isBoosterPerk, isSupportBooster } from "../services/boosters";
import { isLinked } from "./instance";

export { PREMIUM_FEATURES, type PremiumFeature } from "./premiumFeatures";

/**
 * Check if user has a specific premium feature
 */
export async function hasPremiumFeature(
  userId: string,
  feature: PremiumFeature
): Promise<boolean> {
  // A private bot is a paid perk of its owner: everyone it plays for gets the Premium features.
  if (isLinked) return true;
  const patreonService = PatreonService.getInstance();
  const premiumInfo = await patreonService.getPremiumFeatures(userId);
  if (premiumInfo.features.includes(feature)) return true;
  // A recent vote on a listing site unlocks some perks for 12 hours.
  if (isVotePerk(feature) && (await hasActiveVote(userId))) return true;
  // Boosting the support server unlocks Founder perks while the boost lasts.
  return isBoosterPerk(feature) && (await isSupportBooster(userId));
}

/**
 * Check premium and, when the user does not have it, reply with the Founder
 * offer. Returns true if the user has the feature.
 */
export async function requirePremiumFeature(
  interaction: ChatInputCommandInteraction,
  feature: PremiumFeature
): Promise<boolean> {
  if (await hasPremiumFeature(interaction.user.id, feature)) return true;

  if (interaction.deferred || interaction.replied) await interaction.editReply(premiumUpsell(feature) as any);
  else await interaction.reply(premiumUpsell(feature));
  return false;
}

/**
 * Check if user is a premium patron (any tier)
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const patreonService = PatreonService.getInstance();
  return patreonService.isPremiumUser(userId);
}

/**
 * Check if user is a Founder tier patron
 */
export async function isFounderUser(userId: string): Promise<boolean> {
  const patreonService = PatreonService.getInstance();
  return patreonService.isFounderUser(userId);
}
