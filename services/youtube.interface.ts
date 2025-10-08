export interface SearchRes {
  success: boolean;
  data: YoutubeTrack[];
  timestamp: string;
}

export interface YoutubeTrack {
  type: string;
  videoId?: string;
  name: string;
  artist?: Artist;
  duration?: number;
  thumbnails: Thumbnail[];
  albumId?: string;
  playlistId?: string;
  year?: number;
  artistId?: string;
}

interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

interface Artist {
  artistId: null | string;
  name: string;
}