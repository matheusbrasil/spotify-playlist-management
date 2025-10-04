import type { Request, Response } from 'express';
import { getPlaylistWithTracks, getUserPlaylists } from '../services/spotifyService.js';
import { enrichTracksWithGenres, ensureGenre } from '../services/genreService.js';
import { requireAccessToken } from '../utils/auth.js';
import type { EnrichedTrack } from '../types/spotify.js';

const mapTrack = (track: EnrichedTrack) => ({
  id: track.id,
  name: track.name,
  uri: track.uri,
  album: {
    id: track.album.id,
    name: track.album.name,
    images: track.album.images,
  },
  artists: track.artists.map((artist) => ({
    id: artist.id,
    name: artist.name,
  })),
  genre: ensureGenre(track.genre),
  genreSource: track.sourceGenre ?? 'fallback',
  durationMs: track.duration_ms,
  previewUrl: track.preview_url ?? null,
});

export const listPlaylists = async (req: Request, res: Response) => {
  const accessToken = requireAccessToken(req);
  const playlists = await getUserPlaylists(accessToken);

  const payload = playlists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? '',
    images: playlist.images ?? [],
    owner: {
      id: playlist.owner?.id,
      name: playlist.owner?.display_name ?? playlist.owner?.id ?? 'Unknown',
    },
    trackCount: playlist.tracks?.total ?? 0,
  }));

  res.json(payload);
};

export const getPlaylistDetail = async (req: Request<{ playlistId: string }>, res: Response) => {
  const accessToken = requireAccessToken(req);
  const { playlistId } = req.params;

  const { playlist, tracks } = await getPlaylistWithTracks(accessToken, playlistId);
  const enriched = await enrichTracksWithGenres(accessToken, tracks);

  res.json({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? '',
    images: playlist.images ?? [],
    owner: {
      id: playlist.owner?.id,
      name: playlist.owner?.display_name ?? playlist.owner?.id ?? 'Unknown',
    },
    trackCount: playlist.tracks?.total ?? enriched.length,
    tracks: enriched.map(mapTrack),
  });
};
