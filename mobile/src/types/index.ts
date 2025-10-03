export interface Image {
  url: string;
  height: number | null;
  width: number | null;
}

export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  id: string;
  name: string;
  images: Image[];
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  album: Album;
  artists: Artist[];
  genre: string;
  genreSource: string;
  durationMs: number;
  previewUrl: string | null;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string;
  images: Image[];
  owner: {
    id: string;
    name: string;
  };
  trackCount: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: Track[];
}

export interface SplitRecommendation {
  genre: string;
  suggestedName: string;
  trackCount: number;
  tracks: Track[];
}

export interface SmartSplitPreview {
  playlist: {
    id: string;
    name: string;
    description: string;
    trackCount: number;
    suggestedMixName?: string;
  };
  splits: SplitRecommendation[];
}

export interface CreatedPlaylist {
  id: string;
  name: string;
  genre?: string;
  genres?: string[];
  trackCount: number;
  uri?: string;
  isPublic?: boolean;
  coverImageSet?: boolean;
}

export interface CreateMixResponse {
  playlist: CreatedPlaylist;
}
