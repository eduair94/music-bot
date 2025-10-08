/**
 * Platform Detection Utility
 * Provides robust platform detection and validation for music URLs
 */

import { MusicPlatform as PlatformEnum } from '../interfaces/MusicPlatform';
import {
  detectPlatform,
  detectSoundCloudType,
  type MusicPlatform
} from './patterns';

export interface PlatformInfo {
  platform: PlatformEnum;
  rawPlatform: MusicPlatform | null;
  isSupported: boolean;
  requiresSpecialHandling: boolean;
  contentType?: string;
  extractorArgs?: string[];
}

/**
 * Get detailed information about a music URL
 */
export function getPlatformInfo(url: string): PlatformInfo {
  const rawPlatform = detectPlatform(url);
  
  if (!rawPlatform) {
    return {
      platform: PlatformEnum.Unknown,
      rawPlatform: null,
      isSupported: false,
      requiresSpecialHandling: false
    };
  }

  switch (rawPlatform) {
    case 'youtube':
      return {
        platform: PlatformEnum.YouTube,
        rawPlatform,
        isSupported: true,
        requiresSpecialHandling: false,
        extractorArgs: ['--extractor-args', 'youtube:player_client=android']
      };

    case 'soundcloud8':
      const scType = detectSoundCloudType(url);
      return {
        platform: PlatformEnum.SoundCloud,
        rawPlatform,
        isSupported: true,
        requiresSpecialHandling: false,
        contentType: scType,
        extractorArgs: [
          '--extractor-args',
          'soundcloud:formats=http_aac,hls_aac,http_opus,hls_opus,http_mp3,hls_mp3'
        ]
      };

    case 'bandcamp':
      return {
        platform: PlatformEnum.Bandcamp,
        rawPlatform,
        isSupported: true,
        requiresSpecialHandling: false
      };

    case 'spotify':
      return {
        platform: PlatformEnum.Spotify,
        rawPlatform,
        isSupported: true, // Now supported via YouTube bridge
        requiresSpecialHandling: false // Changed to false - we handle it via YouTube bridge
      };

    case 'audiomack':
      return {
        platform: PlatformEnum.Audiomack,
        rawPlatform,
        isSupported: true,
        requiresSpecialHandling: false
      };

    case 'mixcloud':
      return {
        platform: PlatformEnum.Mixcloud,
        rawPlatform,
        isSupported: true,
        requiresSpecialHandling: false
      };

    default:
      return {
        platform: PlatformEnum.Unknown,
        rawPlatform,
        isSupported: false,
        requiresSpecialHandling: false
      };
  }
}

/**
 * Check if a URL is from a supported platform
 */
export function isSupportedPlatform(url: string): boolean {
  const info = getPlatformInfo(url);
  return info.isSupported;
}

/**
 * Get yt-dlp compatible extractor arguments for a platform
 */
export function getExtractorArgs(url: string): string[] {
  const info = getPlatformInfo(url);
  return info.extractorArgs || [];
}

/**
 * Validate a music URL and get detailed error if invalid
 */
export function validateMusicUrl(url: string): { 
  valid: boolean; 
  error?: string; 
  platform?: PlatformEnum;
} {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Invalid URL format' };
  }

  const info = getPlatformInfo(url);

  if (info.platform === PlatformEnum.Unknown) {
    return { 
      valid: false, 
      error: 'Unsupported platform. Supported platforms: YouTube, SoundCloud, Spotify, Bandcamp, Audiomack, Mixcloud' 
    };
  }

  if (info.requiresSpecialHandling) {
    return {
      valid: false,
      error: `${info.platform} links are not yet supported. Coming soon!`,
      platform: info.platform
    };
  }

  if (!info.isSupported) {
    return {
      valid: false,
      error: `${info.platform} is not currently supported`,
      platform: info.platform
    };
  }

  return { valid: true, platform: info.platform };
}
