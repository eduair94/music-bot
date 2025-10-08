
export interface SpotifyPlaylistRes {
  collaborative: boolean;
  external_urls: Externalurls;
  followers: Followers;
  href: string;
  id: string;
  images: Image[];
  primary_color: string;
  name: string;
  description: string;
  type: string;
  uri: string;
  owner: Owner;
  public: boolean;
  snapshot_id: string;
  tracks: Tracks;
}

interface Tracks {
  limit: number;
  next: null;
  offset: number;
  previous: null;
  href: string;
  total: number;
  items: Item[];
}

interface Item {
  added_at: string;
  primary_color: null;
  video_thumbnail: Videothumbnail;
  is_local: boolean;
  added_by: Addedby;
  track: Track;
}

interface Track {
  preview_url: null | string;
  available_markets: string[];
  explicit: boolean;
  type: string;
  episode: boolean;
  track: boolean;
  album: Album;
  artists: Artist[];
  disc_number: number;
  track_number: number;
  duration_ms: number;
  external_ids: Externalids;
  external_urls: Externalurls;
  href: string;
  id: string;
  name: string;
  popularity: number;
  uri: string;
  is_local: boolean;
}

interface Externalids {
  isrc: string;
}

interface Artist {
  external_urls: Externalurls;
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

interface Addedby {
  external_urls: Externalurls;
  id: string;
  type: string;
  uri: string;
  href: string;
}

interface Videothumbnail {
  url: null;
}

interface Owner {
  href: string;
  id: string;
  type: string;
  uri: string;
  display_name: string;
  external_urls: Externalurls;
}

interface Image {
  url: string;
  height: null;
  width: null;
}

interface Followers {
  href: null;
  total: number;
}

interface Externalurls {
  spotify: string;
}
export interface SpotifyAlbumRes {
  albums: Album[];
}

interface Album {
  album_type: string;
  total_tracks: number;
  available_markets: string[];
  external_urls: Externalurls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  type: string;
  uri: string;
  artists: Artist[];
  tracks: Tracks;
  copyrights: Copyright[];
  external_ids: Externalids;
  genres: any[];
  label: string;
  popularity: number;
}

interface Externalids {
  upc: string;
}

interface Copyright {
  text: string;
  type: string;
}

interface Tracks {
  href: string;
  limit: number;
  next: null;
  offset: number;
  previous: null;
  total: number;
  items: Item[];
}

interface Item {
  artists: Artist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_urls: Externalurls;
  href: string;
  id: string;
  name: string;
  preview_url: string;
  track_number: number;
  type: string;
  uri: string;
  is_local: boolean;
}

interface Artist {
  external_urls: Externalurls;
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

interface Externalurls {
  spotify: string;
}


export interface SpotifyTrackRes {
  tracks: Track[];
}

interface Externalids {
  isrc: string;
}

interface Album {
  album_type: string;
  artists: Artist[];
  available_markets: string[];
  external_urls: Externalurls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  type: string;
  uri: string;
}

interface Artist {
  external_urls: Externalurls;
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

interface Externalurls {
  spotify: string;
}