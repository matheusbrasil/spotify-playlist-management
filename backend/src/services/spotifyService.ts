import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import type {
  PlaylistedTrack,
  TrackItem,
  Track,
  SimplifiedPlaylist,
  Playlist,
  Artist as SdkArtist,
  Image as SdkImage,
  SimplifiedArtist,
} from '@spotify/web-api-ts-sdk';
import { env } from '../config/env.js';
import type {
  SpotifyArtist,
  SpotifyImage,
  SpotifyPlaylist,
  SpotifyPlaylistTrack,
  SpotifyTrack,
  SpotifyUser,
} from '../types/spotify.js';
import { AuthTokens } from '../store/sessionStore.js';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

const buildBasicAuthHeader = (): string => Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString('base64');

const toAuthTokens = (payload: SpotifyTokenResponse): AuthTokens => {
  const expiresAt = Date.now() + payload.expires_in * 1000;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    tokenType: payload.token_type,
    scope: payload.scope,
    expiresIn: payload.expires_in,
    expiresAt,
  };
};

const postForm = async (params: URLSearchParams): Promise<SpotifyTokenResponse> => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${buildBasicAuthHeader()}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify token endpoint returned ${response.status} - ${message}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
};

export const getAuthorizeUrl = (state: string): string => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.spotifyClientId,
    redirect_uri: env.spotifyRedirectUri,
    scope: env.spotifyScopes,
    state,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code: string): Promise<AuthTokens> => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.spotifyRedirectUri,
  });

  const payload = await postForm(params);
  const tokens = toAuthTokens(payload);

  if (!tokens.refreshToken) {
    throw new Error('Spotify did not return a refresh token. Ensure requested scopes allow offline access.');
  }

  return tokens;
};

export const refreshAccessToken = async (refreshToken: string): Promise<AuthTokens> => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const payload = await postForm(params);
  return toAuthTokens({
    ...payload,
    refresh_token: payload.refresh_token ?? refreshToken,
  });
};

const createSpotifyClient = (accessToken: string): SpotifyApi =>
  SpotifyApi.withAccessToken(env.spotifyClientId, {
    access_token: accessToken,
    token_type: 'Bearer',
    refresh_token: '',
    expires_in: 3600,
  });

const mapImage = (image: SdkImage): SpotifyImage => ({
  url: image.url,
  height: image.height ?? null,
  width: image.width ?? null,
});

const mapUser = (owner: { id: string; display_name?: string | null }): SpotifyUser => ({
  id: owner.id,
  display_name: owner.display_name ?? undefined,
});

const mapSimplifiedArtist = (artist: SimplifiedArtist): SpotifyArtist => ({
  id: artist.id,
  name: artist.name,
});

const mapArtist = (artist: SdkArtist): SpotifyArtist => ({
  id: artist.id,
  name: artist.name,
  genres: artist.genres,
});

const isTrack = (track: TrackItem | undefined): track is Track => track?.type === 'track';

const mapTrack = (item: PlaylistedTrack): SpotifyPlaylistTrack | null => {
  const track = item.track as TrackItem | undefined;
  if (!isTrack(track)) {
    return null;
  }

  return {
    added_at: item.added_at,
    track: {
      id: track.id,
      name: track.name,
      uri: track.uri,
      artists: track.artists.map(mapSimplifiedArtist),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: (track.album.images ?? []).map(mapImage),
      },
      duration_ms: track.duration_ms,
      preview_url: track.preview_url ?? null,
    },
  };
};

const mapPlaylistSummary = (playlist: SimplifiedPlaylist): SpotifyPlaylist => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description ?? '',
  images: (playlist.images ?? []).map(mapImage),
  uri: playlist.uri,
  public: playlist.public,
  owner: mapUser(playlist.owner),
  tracks: playlist.tracks ? { total: playlist.tracks.total } : undefined,
});

const mapPlaylistDetails = (playlist: Playlist): SpotifyPlaylist => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description ?? '',
  images: (playlist.images ?? []).map(mapImage),
  uri: playlist.uri,
  public: playlist.public,
  owner: mapUser(playlist.owner),
  tracks: {
    total: playlist.tracks.total,
  },
});

export const getCurrentUserProfile = async (accessToken: string): Promise<SpotifyUser> => {
  const client = createSpotifyClient(accessToken);
  const profile = await client.currentUser.profile();
  return mapUser(profile);
};

export const getUserPlaylists = async (accessToken: string): Promise<SpotifyPlaylist[]> => {
  const client = createSpotifyClient(accessToken);
  const playlists: SpotifyPlaylist[] = [];

  const limit = 50;
  let offset = 0;

  let page = await client.currentUser.playlists.playlists(limit, offset);
  playlists.push(...page.items.map(mapPlaylistSummary));

  while (page.next) {
    offset += page.items.length;
    page = await client.currentUser.playlists.playlists(limit, offset);
    playlists.push(...page.items.map(mapPlaylistSummary));
  }

  return playlists;
};

export const getPlaylistWithTracks = async (
  accessToken: string,
  playlistId: string,
): Promise<{ playlist: SpotifyPlaylist; tracks: SpotifyPlaylistTrack[] }> => {
  const client = createSpotifyClient(accessToken);
  const playlist = await client.playlists.getPlaylist(playlistId);
  const playlistSummary = mapPlaylistDetails(playlist);

  const tracks: SpotifyPlaylistTrack[] = [];
  const limit = 50;
  let offset = 0;

  let page = await client.playlists.getPlaylistItems(playlistId, undefined, undefined, limit, offset);
  tracks.push(...page.items.map(mapTrack).filter(Boolean) as SpotifyPlaylistTrack[]);

  while (page.next) {
    offset += page.items.length;
    page = await client.playlists.getPlaylistItems(playlistId, undefined, undefined, limit, offset);
    tracks.push(...page.items.map(mapTrack).filter(Boolean) as SpotifyPlaylistTrack[]);
  }

  playlistSummary.tracks = {
    total: playlist.tracks.total,
    items: tracks,
  };

  return {
    playlist: playlistSummary,
    tracks,
  };
};

export const getMultipleArtists = async (
  accessToken: string,
  artistIds: string[],
): Promise<Record<string, SpotifyArtist>> => {
  const ids = Array.from(new Set(artistIds)).filter(Boolean);
  if (!ids.length) {
    return {};
  }

  const client = createSpotifyClient(accessToken);
  const artists: Record<string, SpotifyArtist> = {};

  let index = 0;
  while (index < ids.length) {
    const batch = ids.slice(index, index + 50);
    const response = await client.artists.get(batch);
    for (const artist of response) {
      if (artist?.id) {
        artists[artist.id] = mapArtist(artist);
      }
    }
    index += 50;
  }

  return artists;
};

export const createPlaylist = async (
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic: boolean,
): Promise<SpotifyPlaylist> => {
  const client = createSpotifyClient(accessToken);
  const created = await client.playlists.createPlaylist(userId, {
    name,
    description,
    public: isPublic,
  });

  return mapPlaylistDetails(created);
};

export const addTracksToPlaylist = async (
  accessToken: string,
  playlistId: string,
  trackUris: string[],
): Promise<void> => {
  if (!trackUris.length) {
    return;
  }

  const client = createSpotifyClient(accessToken);
  const pending = [...trackUris];

  while (pending.length) {
    const chunk = pending.splice(0, 100);
    await client.playlists.addItemsToPlaylist(playlistId, chunk);
  }
};

export const setPlaylistCoverImage = async (
  accessToken: string,
  playlistId: string,
  base64Jpeg: string,
): Promise<void> => {
  const client = createSpotifyClient(accessToken);
  await client.playlists.addCustomPlaylistCoverImage(playlistId, base64Jpeg);
};
