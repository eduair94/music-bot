import { i18n } from "./i18n";

/**
 * Premium feature names for display. Kept apart from premiumCheck so the
 * upsell builder can name a feature without pulling in the Patreon service.
 * These English names mirror `premium.feature.*` in locales/en.json; use
 * premiumFeatureName() for anything shown to users.
 */
export const PREMIUM_FEATURES = {
  audio_filters: "Audio Filters",
  stay_24_7: "24/7 Mode",
  max_quality: "Maximum Quality",
  priority_queue: "Priority Queue",
  unlimited_playlists: "Unlimited Playlists",
  longer_songs: "No Duration Limit",
  ai_dj: "AI DJ",
  vote_features: "Vote on Features",
  founder_role: "Founder Role",
  direct_support: "Direct Support",
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;

/** A feature's display name in the active language ("24/7 Mode"); unknown ids are returned as-is. */
export function premiumFeatureName(feature: string): string {
  return feature in PREMIUM_FEATURES ? i18n.__(`premium.feature.${feature}`) : feature;
}
