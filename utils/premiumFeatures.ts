/**
 * Premium feature names for display. Kept apart from premiumCheck so the
 * upsell builder can name a feature without pulling in the Patreon service.
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
