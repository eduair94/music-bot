import { ChatInputCommandInteraction } from "discord.js";
import { PatreonService } from "../services/patreon";
import { PremiumFeature } from "./premiumFeatures";
import { premiumUpsell } from "./upsell";

export { PREMIUM_FEATURES, type PremiumFeature } from "./premiumFeatures";

/**
 * Check if user has a specific premium feature
 */
export async function hasPremiumFeature(
  userId: string,
  feature: PremiumFeature
): Promise<boolean> {
  const patreonService = PatreonService.getInstance();
  const premiumInfo = await patreonService.getPremiumFeatures(userId);
  return premiumInfo.features.includes(feature);
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

  await interaction.reply(premiumUpsell(feature));
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
