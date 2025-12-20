export interface Config {
  TOKEN: string;
  MONGODB_URI?: string;
  MAX_PLAYLIST_SIZE: number;
  PRUNING: boolean;
  STAY_TIME: number;
  DEFAULT_VOLUME: number;
  LOCALE: string;
  OWNER_ID?: string;
  // Patreon integration
  PATREON_CLIENT_ID?: string;
  PATREON_CLIENT_SECRET?: string;
  PATREON_CREATOR_ACCESS_TOKEN?: string;
  PATREON_CAMPAIGN_ID?: string;
  PATREON_WEBHOOK_SECRET?: string;
  PATREON_FOUNDER_TIER_ID?: string;
}
