export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name?: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  preview_url?: string | null;
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string | null;
  images: SpotifyImage[];
  uri?: string;
  public?: boolean;
  tracks?: {
    total: number;
    items?: SpotifyPlaylistTrack[];
  };
  owner: SpotifyUser;
}

export interface EnrichedTrack extends SpotifyTrack {
  genre?: string;
  sourceGenre?: 'spotify' | 'gemini' | 'unknown';
}

export interface GenreSplit {
  genre: string;
  tracks: EnrichedTrack[];
  suggestedName: string;
}
