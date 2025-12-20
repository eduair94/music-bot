export interface Config {
  TOKEN: string;
  MONGODB_URI?: string;
  MAX_PLAYLIST_SIZE: number;
  PRUNING: boolean;
  STAY_TIME: number;
  DEFAULT_VOLUME: number;
  LOCALE: string;
}
