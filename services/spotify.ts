/**
 * Spotify Service
 * Handles Spotify API integration and bridges to YouTube search
 */

import axios, { AxiosInstance } from 'axios';
import { detectSpotifyType, extractSpotifyId } from '../utils/patterns';
import { SpotifyAlbumRes, SpotifyPlaylistRes, SpotifyTrackRes } from "./spotify.interface";
import { searchYoutube } from "./youtube";
import { YoutubeTrack } from "./youtube.interface";


export interface SpotifyTrackInfo {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  thumbnail?: string;
  releaseDate?: string;
  isrc?: string;
  youtubeUrl?: string;
}

export interface SpotifyAlbumInfo {
  id: string;
  name: string;
  artists: string[];
  tracks: SpotifyTrackInfo[];
  thumbnail?: string;
  releaseDate?: string;
}

export interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  owner: string;
  tracks: SpotifyTrackInfo[];
  thumbnail?: string;
  description?: string;
}

export class SpotifyService {
  private tokenExpiry: number = 0;
  private static instance: SpotifyService;

  baseUrl = 'https://trustpilot.digitalshopuy.com/spotify-data/'

  private axios: AxiosInstance;

  private constructor() {
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  public static getInstance(): SpotifyService {
    if (!SpotifyService.instance) {
      SpotifyService.instance = new SpotifyService();
    }
    return SpotifyService.instance;
  }

  /**
   * Check if Spotify credentials are configured
   */
  public static isConfigured(): boolean {
    return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  }

  /**
   * Process a Spotify URL and return YouTube URLs
   */
  public async processSpotifyUrl(url: string): Promise<string[]> {

    const type = detectSpotifyType(url);
    const id = extractSpotifyId(url);

    console.log(`Spotify URL detected. Type: ${type}, ID: ${id}`, url);

    if (!id) {
      throw new Error('Invalid Spotify URL');
    }

    switch (type) {
      case 'track':
        return await this.getTrackYoutubeUrl(id);
      
      case 'album':
        return await this.getAlbumYoutubeUrls(id);
      
      case 'playlist':
        return await this.getPlaylistYoutubeUrls(id);
      
      case 'artist':
        throw new Error('Artist URLs are not supported yet. Please use a specific track, album, or playlist.');
      
      default:
        throw new Error('Unsupported Spotify URL type');
    }
  }

  getTrack(trackId: string): Promise<SpotifyTrackRes> {
    return this.axios.get('/tracks', {
      params: {
        ids: trackId
      },
    }).then(res=> res.data).catch(err => null);
  }

  /**
   * Get track information and find it on YouTube
   */
  private async getTrackYoutubeUrl(trackId: string): Promise<string[]> {
    try {
      const track = await this.getTrack(trackId);
      const trackInfo = this.parseTrack(track);
      
      // Search YouTube for the track
      const youtubeUrl = await this.searchYouTube(trackInfo);
      
      return youtubeUrl ? [youtubeUrl] : [];
    } catch (error) {
      console.error(`Spotify: Failed to get track ${trackId}:`, error);
      throw new Error('Failed to fetch Spotify track');
    }
  }

  /**
   * Get album information and find tracks on YouTube
   */
  private async getAlbumYoutubeUrls(albumId: string): Promise<string[]> {
    try {
      const albumRes = await this.getAlbum(albumId);
      const album = albumRes.albums[0];
      const tracks = album.tracks.items;
      
      // Limit to first 5 tracks
      const tracksToProcess = tracks.slice(0, 50);
      
      console.log(`Spotify: Processing album "${album.name}" - queuing first ${tracksToProcess.length} of ${tracks.length} tracks`);
      
      const youtubeUrls: string[] = [];
      
      for (const track of tracksToProcess) {
        const trackInfo: SpotifyTrackInfo = {
          id: track.id,
          name: track.name,
          artists: track.artists.map((a: any) => a.name),
          album: album.name,
          duration: Math.floor(track.duration_ms / 1000),
          thumbnail: album.images[0]?.url
        };
        
        const youtubeUrl = await this.searchYouTube(trackInfo);
        if (youtubeUrl) {
          youtubeUrls.push(youtubeUrl);
        }
      }
      
      return youtubeUrls;
    } catch (error) {
      console.error(`Spotify: Failed to get album ${albumId}:`, error);
      throw new Error('Failed to fetch Spotify album');
    }
  }
  getAlbum(albumId: string): Promise<SpotifyAlbumRes> {
   return this.axios.get('/albums', {
      params: {
        ids: albumId
      },
    }).then(res=> res.data).catch(err => null);
  }

  getPlaylist(playlistId: string): Promise<SpotifyPlaylistRes> {
    return this.axios.get('/playlist', {
      params: {
        id: playlistId
      },
    }).then(res=> res.data).catch(err => null);
  }

  /**
   * Get playlist information and find tracks on YouTube
   */
  private async getPlaylistYoutubeUrls(playlistId: string): Promise<string[]> {
    try {
      const playlist = await this.getPlaylist(playlistId);
      const items = playlist.tracks.items;

      // Limit to first 5 tracks
      const itemsToProcess = items.slice(0, 5);

      console.log(`Spotify: Processing playlist "${playlist.name}" - queuing first ${itemsToProcess.length} of ${items.length} tracks`);

      const youtubeUrls: string[] = [];
      
      for (const item of itemsToProcess) {
        if (!item.track || item.track.type !== 'track') continue;
        
        const track = item.track;
        const trackInfo: SpotifyTrackInfo = {
          id: track.id,
          name: track.name,
          artists: track.artists.map(a => a.name),
          album: track.album.name,
          duration: Math.floor(track.duration_ms / 1000),
          thumbnail: track.album.images[0]?.url
        };
        
        const youtubeUrl = await this.searchYouTube(trackInfo);
        if (youtubeUrl) {
          youtubeUrls.push(youtubeUrl);
        }
      }
      
      return youtubeUrls;
    } catch (error) {
      console.error(`Spotify: Failed to get playlist ${playlistId}:`, error);
      throw new Error('Failed to fetch Spotify playlist');
    }
  }

  /**
   * Search YouTube for a Spotify track
   */
  private async searchYouTube(track: SpotifyTrackInfo): Promise<string | null> {
    try {
      // Build search query with artist and track name
      // Try multiple search strategies for better results
      const searchQueries = [
        `${track.artists.join(' ')} ${track.name} official audio`,
        `${track.artists.join(' ')} ${track.name} audio`,
        `${track.artists.join(' ')} ${track.name}`,
        `${track.name} ${track.artists[0]}` // Try reversed order
      ];
      
      for (const searchQuery of searchQueries) {
        try {
          console.log(`Spotify → YouTube: Searching for "${searchQuery}"`);
          
          // Use youtube-sr to search
          const youtubeRes = await searchYoutube(searchQuery);
          const results = youtubeRes.data;
          
          if (results && results.length > 0) {
            // Prefer results that are closer to the track duration
            const bestMatch = this.findBestMatch(results, track);
            
            if (bestMatch) {
              const youtubeUrl = `https://youtube.com/watch?v=${bestMatch.videoId}`;
              console.log(`Spotify → YouTube: Found "${bestMatch.name}" (duration match: ${Math.abs((bestMatch.duration || 0) - track.duration)}s difference)`);
              return youtubeUrl;
            }
          }
        } catch (searchError) {
          console.warn(`Spotify → YouTube: Search attempt failed for "${searchQuery}":`, searchError);
          continue; // Try next query
        }
      }
      
      console.warn(`Spotify → YouTube: No results found after trying all search strategies for "${track.artists.join(', ')} - ${track.name}"`);
      return null;
    } catch (error) {
      console.error(`Spotify → YouTube: Search failed for "${track.name}":`, error);
      return null;
    }
  }

  /**
   * Find the best matching YouTube video based on duration
   */
  private findBestMatch(results: YoutubeTrack[], track: SpotifyTrackInfo): YoutubeTrack | null {
    if (results.length === 0) return null;
    
    // If we have duration info, prefer videos with similar duration (within 10 seconds)
    if (track.duration > 0) {
      const withDuration = results.filter(r => r.duration && Math.abs(r.duration - track.duration) <= 10);
      if (withDuration.length > 0) {
        // Return the one with closest duration
        return withDuration.reduce((prev, curr) => 
          Math.abs((curr.duration || 0) - track.duration) < Math.abs((prev.duration || 0) - track.duration) ? curr : prev
        );
      }
    }
    
    // Otherwise, return the first result
    return results[0];
  }

  /**
   * Parse Spotify track response
   */
  private parseTrack(trackRes: SpotifyTrackRes): SpotifyTrackInfo {
    const track = trackRes.tracks[0];
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => a.name),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      thumbnail: track.album.images[0]?.url,
      releaseDate: track.album.release_date,
      isrc: track.external_ids?.isrc
    };
  }

  /**
   * Get track metadata only (without YouTube search)
   */
  public async getTrackMetadata(trackId: string): Promise<SpotifyTrackInfo> {    
    try {
      const track = await this.getTrack(trackId);
      return this.parseTrack(track);
    } catch (error) {
      console.error(`Spotify: Failed to get track metadata ${trackId}:`, error);
      throw new Error('Failed to fetch Spotify track metadata');
    }
  }
}
