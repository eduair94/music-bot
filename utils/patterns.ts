// ============================================================================
// YouTube Patterns
// ============================================================================
export const videoPattern = /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/;
export const playlistPattern = /^.*(list=)([^#\&\?]*).*/;

// ============================================================================
// SoundCloud Patterns
// ============================================================================
// Main SoundCloud track or user URL
export const scRegex = /^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/;
// Mobile SoundCloud short URL
export const mobileScRegex = /^https?:\/\/(soundcloud\.app\.goo\.gl)\/(.*)$/;
// SoundCloud playlist/set URL
export const scPlaylistRegex = /^https?:\/\/(www\.)?soundcloud\.com\/[^/]+\/sets\/[^/?]+/;
// SoundCloud track URL
export const scTrackRegex = /^https?:\/\/(www\.)?soundcloud\.com\/[^/]+\/[^/?]+(?:\?.*)?$/;
// SoundCloud user/artist URL
export const scUserRegex = /^https?:\/\/(www\.)?soundcloud\.com\/[^/]+\/?$/;

// ============================================================================
// Spotify Patterns
// ============================================================================
// Spotify track URL (with optional intl- locale prefix)
export const spotifyTrackRegex = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(track)\/([a-zA-Z0-9]+)/;
// Spotify album URL (with optional intl- locale prefix)
export const spotifyAlbumRegex = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(album)\/([a-zA-Z0-9]+)/;
// Spotify playlist URL (with optional intl- locale prefix)
export const spotifyPlaylistRegex = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(playlist)\/([a-zA-Z0-9]+)/;
// Spotify artist URL (with optional intl- locale prefix)
export const spotifyArtistRegex = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(artist)\/([a-zA-Z0-9]+)/;
// General Spotify URL (with optional intl- locale prefix)
export const spotifyRegex = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([a-zA-Z0-9]+)/;

// ============================================================================
// Platform Detection Patterns
// ============================================================================
export const platformPatterns = {
  youtube: videoPattern,
  soundcloud: scRegex,
  soundcloudMobile: mobileScRegex,
  soundcloudPlaylist: scPlaylistRegex,
  soundcloudTrack: scTrackRegex,
  soundcloudUser: scUserRegex,
} as const;

// ============================================================================
// Music Platform Patterns (for future expansion)
// ============================================================================
export const musicPlatforms = {
  youtube: /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/,
  soundcloud8: /^https?:\/\/(www\.|m\.)?soundcloud\.com\/(.*)$/,
  spotify: /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/,
  bandcamp: /^https?:\/\/([^.]+\.)?bandcamp\.com\/(track|album)\/([^/?]+)/,
  audiomack: /^https?:\/\/(www\.)?audiomack\.com\/[^/?]+\/[^/?]+/,
  mixcloud: /^https?:\/\/(www\.)?mixcloud\.com\/([^/]+)\/([^/?]+)/,
} as const;

// ============================================================================
// Utility Patterns
// ============================================================================
export const isURL =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

// ============================================================================
// Platform Type Definition
// ============================================================================
export type MusicPlatform = keyof typeof musicPlatforms;
export type SoundCloudType = 'track' | 'playlist' | 'user' | 'mobile' | 'unknown';
export type SpotifyType = 'track' | 'album' | 'playlist' | 'artist' | 'unknown';

// ============================================================================
// Platform Detection Utilities
// ============================================================================

/**
 * Detects which music platform a URL belongs to
 * @param url - The URL to check
 * @returns The platform name or null if not recognized
 */
export function detectPlatform(url: string): MusicPlatform | null {
  for (const [platform, pattern] of Object.entries(musicPlatforms)) {
    if (pattern.test(url)) {
      return platform as MusicPlatform;
    }
  }
  return null;
}

/**
 * Detects the type of SoundCloud URL
 * @param url - The SoundCloud URL to check
 * @returns The SoundCloud content type
 */
export function detectSoundCloudType(url: string): SoundCloudType {
  if (mobileScRegex.test(url)) return 'mobile';
  if (scPlaylistRegex.test(url)) return 'playlist';
  if (scUserRegex.test(url)) return 'user';
  if (scTrackRegex.test(url)) return 'track';
  if (scRegex.test(url)) return 'track'; // Default to track for generic SC URLs
  return 'unknown';
}

/**
 * Checks if a URL is a valid SoundCloud URL
 * @param url - The URL to check
 * @returns True if the URL is a valid SoundCloud URL
 */
export function isSoundCloudUrl(url: string): boolean {
  return scRegex.test(url) || mobileScRegex.test(url);
}

/**
 * Detects the type of Spotify URL
 * @param url - The Spotify URL to check
 * @returns The Spotify content type
 */
export function detectSpotifyType(url: string): SpotifyType {
  if (spotifyTrackRegex.test(url)) return 'track';
  if (spotifyAlbumRegex.test(url)) return 'album';
  if (spotifyPlaylistRegex.test(url)) return 'playlist';
  if (spotifyArtistRegex.test(url)) return 'artist';
  return 'unknown';
}

/**
 * Extracts Spotify ID from URL
 * @param url - The Spotify URL
 * @returns The Spotify ID or null
 */
export function extractSpotifyId(url: string): string | null {
  const match = spotifyRegex.exec(url);
  // With the updated regex, the ID is now in group 4 (after intl-locale and type)
  return match ? match[4] : null;
}

/**
 * Checks if a URL is a valid Spotify URL
 * @param url - The URL to check
 * @returns True if the URL is a valid Spotify URL
 */
export function isSpotifyUrl(url: string): boolean {
  return spotifyRegex.test(url);
}
