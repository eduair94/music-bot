/**
 * Music Platform Types and Interfaces
 * Defines supported music platforms and their metadata structures
 */

export enum MusicPlatform {
  YouTube = 'youtube',
  SoundCloud = 'soundcloud',
  Bandcamp = 'bandcamp',
  Spotify = 'spotify',
  Audiomack = 'audiomack',
  Mixcloud = 'mixcloud',
  Vimeo = 'vimeo',
  Unknown = 'unknown'
}

export enum SoundCloudContentType {
  Track = 'track',
  Playlist = 'playlist',
  User = 'user',
  Search = 'search'
}

export interface PlatformMetadata {
  platform: MusicPlatform;
  platformId?: string;
  platformUrl?: string;
  artist?: string;
  album?: string;
  releaseDate?: string;
  genre?: string[];
  thumbnailUrl?: string;
  description?: string;
  playCount?: number;
  likeCount?: number;
}

export interface SoundCloudMetadata extends PlatformMetadata {
  platform: MusicPlatform.SoundCloud;
  contentType: SoundCloudContentType;
  waveformUrl?: string;
  downloadable?: boolean;
  streamable?: boolean;
}

export interface PlatformDetectionResult {
  platform: MusicPlatform;
  url: string;
  isValid: boolean;
  contentType?: string;
}

export interface FormatOptions {
  preferredCodec?: 'opus' | 'aac' | 'mp3';
  preferredProtocol?: 'http' | 'hls';
  quality?: 'best' | 'high' | 'medium' | 'low';
}
