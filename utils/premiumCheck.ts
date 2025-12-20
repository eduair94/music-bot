import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { PatreonService } from "../services/patreon";

/**
 * Premium feature names for display
 */
export const PREMIUM_FEATURES = {
  audio_filters: "Audio Filters",
  stay_24_7: "24/7 Mode",
  max_quality: "Maximum Quality",
  priority_queue: "Priority Queue",
  unlimited_playlists: "Unlimited Playlists",
  longer_songs: "No Duration Limit",
  vote_features: "Vote on Features",
  founder_role: "Founder Role",
  direct_support: "Direct Support",
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;

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
 * Check premium and reply with upgrade message if needed
 * Returns true if user has the feature, false otherwise
 */
export async function requirePremiumFeature(
  interaction: ChatInputCommandInteraction,
  feature: PremiumFeature
): Promise<boolean> {
  const hasFeature = await hasPremiumFeature(interaction.user.id, feature);

  if (!hasFeature) {
    const featureName = PREMIUM_FEATURES[feature];
    const embed = new EmbedBuilder()
      .setTitle("Premium Feature")
      .setColor("#F96854")
      .setDescription(
        `**${featureName}** is a premium feature!\n\n` +
        "Unlock this and more with a Patreon subscription.\n\n" +
        "Use `/premium` to learn more about premium features."
      )
      .setFooter({ text: "Support us and get exclusive features!" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return false;
  }

  return true;
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
