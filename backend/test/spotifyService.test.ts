import { jest } from '@jest/globals';
import type { PlaylistedTrack, TrackItem } from '@spotify/web-api-ts-sdk';

jest.mock('../src/config/env.js', () => ({
  env: {
    spotifyClientId: 'test-client-id',
    spotifyClientSecret: 'test-client-secret',
    spotifyRedirectUri: 'http://localhost/callback',
    spotifyScopes: 'playlist-read-private',
    geminiApiKey: 'test-gemini-key',
    geminiModel: 'gemini-2.5-flash',
  },
}));

type SpotifyProfileResponse = { id: string; display_name?: string };

const profileMock = jest.fn();
const playlistsPageMock = jest.fn();
const getPlaylistMock = jest.fn();
const getPlaylistItemsMock = jest.fn();
const withAccessTokenMock = jest.fn(() => ({
  currentUser: {
    profile: profileMock,
    playlists: {
      playlists: playlistsPageMock,
    },
  },
  playlists: {
    getPlaylist: getPlaylistMock,
    getPlaylistItems: getPlaylistItemsMock,
    addItemsToPlaylist: jest.fn(),
  },
  artists: {
    get: jest.fn(),
  },
}));

jest.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withAccessToken: withAccessTokenMock,
  },
}));

import { getCurrentUserProfile, getPlaylistWithTracks, getUserPlaylists } from '../src/services/spotifyService.js';

describe('spotifyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a Spotify client and returns the mapped profile', async () => {
    (profileMock as jest.Mock).mockImplementation(async () => ({
      id: 'user-123',
      display_name: 'Test User',
    }));

    const result = await getCurrentUserProfile('access-token');

    expect(withAccessTokenMock).toHaveBeenCalledWith('test-client-id', {
      access_token: 'access-token',
      refresh_token: '',
      token_type: 'Bearer',
      expires_in: 3600,
    });

    expect(result).toEqual({
      id: 'user-123',
      display_name: 'Test User',
    });
  });

  it('maps playlist summaries from the Spotify API', async () => {
    (playlistsPageMock as jest.Mock).mockImplementation(async () => ({
      items: [
        {
          id: 'playlist-1',
          name: 'Focus Mix',
          description: 'Lo-fi focus playlist',
          images: [{ url: 'cover.jpg', width: 640, height: 640 }],
          uri: 'spotify:playlist:1',
          public: false,
          owner: {
            id: 'owner-1',
            display_name: 'Owner',
            external_urls: { spotify: '' },
            href: '',
            type: 'user',
            uri: '',
          },
          tracks: { total: 12 },
        },
      ],
      next: undefined,
      offset: 0,
      limit: 50,
    }));

    const playlists = await getUserPlaylists('token');

    expect(playlists).toEqual([
      {
        id: 'playlist-1',
        name: 'Focus Mix',
        description: 'Lo-fi focus playlist',
        images: [{ url: 'cover.jpg', width: 640, height: 640 }],
        uri: 'spotify:playlist:1',
        public: false,
        owner: { id: 'owner-1', display_name: 'Owner' },
        tracks: { total: 12 },
      },
    ]);
  });

  it('returns enriched playlist details with filtered tracks', async () => {
    (getPlaylistMock as jest.Mock).mockImplementation(async () => ({
      id: 'playlist-1',
      name: 'Focus Mix',
      description: 'Lo-fi focus playlist',
      images: [],
      uri: 'spotify:playlist:1',
      public: true,
      owner: {
        id: 'owner-1',
        display_name: 'Owner',
        external_urls: { spotify: '' },
        href: '',
        type: 'user',
        uri: '',
      },
      tracks: {
        total: 1,
        items: [],
      },
    }));

    const trackItem = ({
      added_at: '2023-01-01T00:00:00Z',
      added_by: {} as never,
      is_local: false,
      track: {
        type: 'track',
        id: 'track-1',
        name: 'Song Title',
        uri: 'spotify:track:1',
        duration_ms: 200000,
        preview_url: null,
        album: {
          id: 'album-1',
          name: 'Album',
          images: [],
          album_type: 'album',
          total_tracks: 1,
          available_markets: [],
          external_urls: { spotify: '' },
          href: '',
          release_date: '2023',
          release_date_precision: 'year',
          type: 'album',
          uri: '',
        },
        artists: [
          {
            id: 'artist-1',
            name: 'Artist',
            external_urls: { spotify: '' },
            href: '',
            type: 'artist',
            uri: '',
          },
        ],
        available_markets: [],
        disc_number: 1,
        episode: false,
        explicit: false,
        external_urls: { spotify: '' },
        href: '',
        is_local: false,
        track: true,
        track_number: 1,
        is_playable: true,
        linked_from: undefined,
        restrictions: undefined,
        external_ids: { isrc: 'isrc', ean: 'ean', upc: 'upc' },
        popularity: 50,
      } as unknown as TrackItem,
      primary_color: '#000000',
      video_thumbnail: { url: 'thumb.jpg' },
    } as unknown) as PlaylistedTrack<TrackItem>;

    const episodeItem = ({
      ...trackItem,
      track: { type: 'episode' } as unknown as TrackItem,
    } as unknown) as PlaylistedTrack<TrackItem>;

    (getPlaylistItemsMock as jest.Mock).mockImplementation(async () => ({
      items: [trackItem, episodeItem],
      next: undefined,
      offset: 0,
      limit: 50,
    }));

    const { playlist, tracks } = await getPlaylistWithTracks('token', 'playlist-1');

    expect(playlist.tracks?.items).toHaveLength(1);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].track.name).toBe('Song Title');
  });
});
