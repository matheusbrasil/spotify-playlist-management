import type { Request, Response } from 'express';
import {
  getCurrentUserProfile,
  getPlaylistWithTracks,
  createPlaylist,
  addTracksToPlaylist,
  setPlaylistCoverImage,
} from '../services/spotifyService.js';
import { enrichTracksWithGenres } from '../services/genreService.js';
import { generatePlaylistCover } from '../services/geminiService.js';
import { normalizeGenreKey } from '../services/genreService.js';
import { requireAccessToken } from '../utils/auth.js';
import type { EnrichedTrack } from '../types/spotify.js';
import { HttpError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const formatGenreLabel = (genre?: string | null): string => {
  if (!genre) return 'Unknown';
  const trimmed = genre.trim();
  if (!trimmed) return 'Unknown';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const groupTracksByGenre = (tracks: EnrichedTrack[]): Map<string, EnrichedTrack[]> => {
  return tracks.reduce((acc, track) => {
    const genre = formatGenreLabel(track.genre);
    const existing = acc.get(genre) ?? [];
    existing.push(track);
    acc.set(genre, existing);
    return acc;
  }, new Map<string, EnrichedTrack[]>());
};

const suggestName = (originalName: string, genre: string): string => {
  const trimmed = originalName.trim();
  const base = trimmed.length ? trimmed : 'Playlist';
  return `${base} • ${formatGenreLabel(genre)}`;
};

const suggestMixName = (originalName: string, genres: string[]): string => {
  const trimmed = originalName.trim();
  const base = trimmed.length ? trimmed : 'Playlist';
  if (!genres.length) {
    return base;
  }

  const formatted = genres.map(formatGenreLabel);
  if (formatted.length === 1) {
    return `${base} • ${formatted[0]}`;
  }
  if (formatted.length === 2) {
    return `${base} • ${formatted[0]} & ${formatted[1]}`;
  }
  if (formatted.length === 3) {
    return `${base} • ${formatted[0]}, ${formatted[1]} & ${formatted[2]}`;
  }
  return `${base} • ${formatted[0]}, ${formatted[1]} + More`;
};

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
  genre: formatGenreLabel(track.genre),
  genreSource: track.sourceGenre ?? 'fallback',
  durationMs: track.duration_ms,
  previewUrl: track.preview_url ?? null,
});

const uniqueUris = (tracks: EnrichedTrack[]): string[] => {
  const set = new Set<string>();
  for (const track of tracks) {
    if (track.uri) {
      set.add(track.uri);
    }
  }
  return Array.from(set);
};

const filterTracksByGenres = (tracks: EnrichedTrack[], genres: string[]): EnrichedTrack[] => {
  if (!genres.length) {
    return [];
  }
  const normalized = new Set(genres.map((genre) => normalizeGenreKey(genre)));
  return tracks.filter((track) => normalized.has(normalizeGenreKey(track.genre ?? 'Unknown')));
};

const buildDescription = (sourceName: string, genres: string[]): string =>
  `Generated from "${sourceName}" focusing on ${genres.map(formatGenreLabel).join(', ')}.`;

export const previewSmartSplit = async (
  req: Request<{ playlistId: string }>,
  res: Response,
) => {
  const accessToken = requireAccessToken(req);
  const { playlistId } = req.params;

  const { playlist, tracks } = await getPlaylistWithTracks(accessToken, playlistId);
  const enriched = await enrichTracksWithGenres(accessToken, tracks);
  const grouped = groupTracksByGenre(enriched);

  const splits = Array.from(grouped.entries()).map(([genre, genreTracks]) => ({
    genre,
    suggestedName: suggestName(playlist.name, genre),
    trackCount: genreTracks.length,
    tracks: genreTracks.map(mapTrack),
  }));

  const allGenres = Array.from(grouped.keys());
  const suggestedMixName = suggestMixName(playlist.name, allGenres);

  res.json({
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? '',
      trackCount: playlist.tracks?.total ?? enriched.length,
      suggestedMixName,
    },
    splits,
  });
};

interface ApplySplitBody {
  splits: Array<{
    genre: string;
    name: string;
    trackUris: string[];
    makePublic?: boolean;
  }>;
  descriptionTemplate?: string;
}

export const applySmartSplit = async (
  req: Request<{ playlistId: string }, unknown, ApplySplitBody>,
  res: Response,
) => {
  const accessToken = requireAccessToken(req);
  const { playlistId } = req.params;
  const { splits, descriptionTemplate } = req.body;

  if (!Array.isArray(splits) || splits.length === 0) {
    throw new HttpError(400, 'splits must be a non-empty array');
  }

  const sanitizedSplits = splits.filter((split) => split.trackUris?.length);
  if (!sanitizedSplits.length) {
    throw new HttpError(400, 'No tracks provided for playlist creation');
  }

  const { playlist } = await getPlaylistWithTracks(accessToken, playlistId);
  const user = await getCurrentUserProfile(accessToken);

  const results = [];
  for (const split of sanitizedSplits) {
    const genreLabel = formatGenreLabel(split.genre);
    const description = descriptionTemplate
      ? descriptionTemplate.replaceAll('{{genre}}', genreLabel).replaceAll('{{source}}', playlist.name)
      : `Smart split from "${playlist.name}" (${genreLabel})`;

    const newPlaylist = await createPlaylist(
      accessToken,
      user.id,
      split.name,
      description,
      Boolean(split.makePublic),
    );
    await addTracksToPlaylist(accessToken, newPlaylist.id, Array.from(new Set(split.trackUris)));
    results.push({
      id: newPlaylist.id,
      name: newPlaylist.name,
      genre: genreLabel,
      trackCount: split.trackUris.length,
      uri: newPlaylist.uri,
    });
  }

  res.json({
    created: results,
  });
};

interface FilterGenresBody {
  genres?: string[];
}

export const filterPlaylistByGenres = async (
  req: Request<{ playlistId: string }, unknown, FilterGenresBody>,
  res: Response,
) => {
  const accessToken = requireAccessToken(req);
  const { playlistId } = req.params;
  const { genres } = req.body;

  if (!Array.isArray(genres) || genres.length === 0) {
    throw new HttpError(400, 'genres must be a non-empty array');
  }

  const { playlist, tracks } = await getPlaylistWithTracks(accessToken, playlistId);
  const enriched = await enrichTracksWithGenres(accessToken, tracks);
  const filtered = filterTracksByGenres(enriched, genres);

  const formattedGenres = Array.from(
    new Set(filtered.map((track) => formatGenreLabel(track.genre))),
  );
  const suggestedName = suggestMixName(playlist.name, formattedGenres);

  res.json({
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? '',
    },
    genres: formattedGenres,
    trackCount: filtered.length,
    suggestedName,
    tracks: filtered.map(mapTrack),
  });
};

interface CreateMixBody {
  genres?: string[];
  name?: string;
  makePublic?: boolean;
}

export const createPlaylistFromGenres = async (
  req: Request<{ playlistId: string }, unknown, CreateMixBody>,
  res: Response,
) => {
  const accessToken = requireAccessToken(req);
  const { playlistId } = req.params;
  const { genres, name, makePublic } = req.body;

  if (!Array.isArray(genres) || genres.length === 0) {
    throw new HttpError(400, 'genres must be a non-empty array');
  }

  const { playlist, tracks } = await getPlaylistWithTracks(accessToken, playlistId);
  const enriched = await enrichTracksWithGenres(accessToken, tracks);
  const filtered = filterTracksByGenres(enriched, genres);

  if (!filtered.length) {
    throw new HttpError(400, 'No tracks match the selected genres');
  }

  const formattedGenres = Array.from(
    new Set(filtered.map((track) => formatGenreLabel(track.genre))),
  );
  const desiredName = name?.trim()?.length ? name.trim() : suggestMixName(playlist.name, formattedGenres);
  const description = buildDescription(playlist.name, formattedGenres);
  const user = await getCurrentUserProfile(accessToken);

  const newPlaylist = await createPlaylist(accessToken, user.id, desiredName, description, Boolean(makePublic));
  const uris = uniqueUris(filtered);
  await addTracksToPlaylist(accessToken, newPlaylist.id, uris);

  const coverImage = await generatePlaylistCover(desiredName, formattedGenres, filtered);
  let coverImageSet = false;
  if (coverImage) {
    try {
      await setPlaylistCoverImage(accessToken, newPlaylist.id, coverImage);
      coverImageSet = true;
    } catch (error) {
      logger.warn('Failed to set playlist cover image', error);
    }
  }

  res.json({
    playlist: {
      id: newPlaylist.id,
      name: newPlaylist.name,
      genres: formattedGenres,
      trackCount: uris.length,
      uri: newPlaylist.uri,
      isPublic: Boolean(newPlaylist.public ?? makePublic),
      coverImageSet,
    },
  });
};

