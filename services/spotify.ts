import axios, { AxiosInstance } from "axios";

/**
 * Spotify API Response Types
 */
interface SpotifyArtist {
  uri: string;
  profile: {
    name: string;
  };
}

interface SpotifyCoverArt {
  sources: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

interface SpotifyAlbum {
  uri: string;
  name: string;
  coverArt: SpotifyCoverArt;
  id: string;
}

interface SpotifyTrackData {
  uri: string;
  id: string;
  name: string;
  albumOfTrack: SpotifyAlbum;
  artists: {
    items: SpotifyArtist[];
  };
  contentRating: {
    label: string;
  };
  duration: {
    totalMilliseconds: number;
  };
  playability: {
    playable: boolean;
  };
}

interface SpotifySearchResult {
  data: SpotifyTrackData;
}

interface SpotifySearchResponse {
  tracks: SpotifySearchResult[];
}

/**
 * Formatted track information for easy consumption
 */
export interface SpotifyTrack {
  uri: string;
  id: string;
  name: string;
  artist: string;
  artists: string[];
  albumName: string;
  albumArt: string | null;
  albumArtSmall: string | null;
  albumArtMedium: string | null;
  albumArtLarge: string | null;
  durationMs: number;
  durationFormatted: string;
  isPlayable: boolean;
  isExplicit: boolean;
}

/**
 * SpotifyService - Handles Spotify API integration
 * 
 * This service manages all interactions with the custom Spotify search API
 * and provides formatted track information for the music bot.
 */
export class SpotifyService {
  private static instance: SpotifyService;
  private baseUrl = "https://trustpilot.digitalshopuy.com/spotify-data";
  private axiosInstance: AxiosInstance;
  private cache: Map<string, { data: SpotifyTrack; expires: number }> = new Map();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        "User-Agent": "Discord-Music-Bot/2.9.0"
      }
    });
  }

  public static getInstance(): SpotifyService {
    if (!this.instance) {
      this.instance = new SpotifyService();
    }
    return this.instance;
  }

  /**
   * Search for tracks on Spotify
   * @param query - Search query (song name, artist, or combination)
   * @returns Array of formatted Spotify tracks
   */
  public async searchTracks(query: string): Promise<SpotifyTrack[]> {
    try {
      console.log(`[SpotifyService] Ì¥ç Searching for: "${query}"`);

      const response = await this.axiosInstance.get<SpotifySearchResponse>("/search", {
        params: {
          q: query,
          type: "tracks"
        }
      });

      if (!response.data?.tracks || response.data.tracks.length === 0) {
        console.log(`[SpotifyService] ‚ùå No results found for: "${query}"`);
        return [];
      }

      const tracks = response.data.tracks.map(result => this.formatTrack(result.data));
      console.log(`[SpotifyService] ‚úÖ Found ${tracks.length} tracks`);
      
      return tracks;
    } catch (error: any) {
      console.error("[SpotifyService] ‚ùå Search error:", error.message);
      throw new Error(`Failed to search Spotify: ${error.message}`);
    }
  }

  /**
   * Search for a single track and return the best match
   * @param query - Search query
   * @returns The first (best match) track or null if no results
   */
  public async searchTrack(query: string): Promise<SpotifyTrack | null> {
    // Check cache first
    const cacheKey = `track:${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      console.log(`[SpotifyService] Ì≥¶ Cache hit for: "${query}"`);
      return cached.data;
    }

    const tracks = await this.searchTracks(query);
    
    if (tracks.length === 0) {
      return null;
    }

    const track = tracks[0];
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: track,
      expires: Date.now() + this.cacheTimeout
    });

    return track;
  }

  /**
   * Format raw Spotify API track data into a clean, usable format
   * @param data - Raw track data from Spotify API
   * @returns Formatted track information
   */
  private formatTrack(data: SpotifyTrackData): SpotifyTrack {
    const coverArt = data.albumOfTrack?.coverArt?.sources || [];
    
    // Spotify returns images in order: [300x300, 64x64, 640x640]
    const albumArtLarge = coverArt.find(s => s.width === 640)?.url || null;
    const albumArtMedium = coverArt.find(s => s.width === 300)?.url || null;
    const albumArtSmall = coverArt.find(s => s.width === 64)?.url || null;
    const albumArt = albumArtLarge || albumArtMedium || albumArtSmall;

    const durationMs = data.duration?.totalMilliseconds || 0;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const artists = data.artists?.items?.map(a => a.profile?.name).filter(Boolean) || [];
    const artist = artists[0] || "Unknown";

    return {
      uri: data.uri,
      id: data.id,
      name: data.name,
      artist,
      artists,
      albumName: data.albumOfTrack?.name || "Unknown Album",
      albumArt,
      albumArtSmall,
      albumArtMedium,
      albumArtLarge,
      durationMs,
      durationFormatted,
      isPlayable: data.playability?.playable ?? true,
      isExplicit: data.contentRating?.label === "EXPLICIT"
    };
  }

  /**
   * Clear the cache (useful for testing or memory management)
   */
  public clearCache(): void {
    this.cache.clear();
    console.log("[SpotifyService] Ì∑ëÔ∏è Cache cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
