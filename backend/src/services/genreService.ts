import { getMultipleArtists } from './spotifyService.js';
import { inferGenreForTrack, inferGenres, isConfigured as isGeminiConfigured } from './geminiService.js';
import type { EnrichedTrack, SpotifyPlaylistTrack } from '../types/spotify.js';

const SANITIZED_UNKNOWN = new Set([
  'unknown',
  'unknown genre',
  'n/a',
  'none',
  'misc',
  'other',
  'tbd',
  '???',
]);

const DEFAULT_GENRE = 'Pop';

const sanitizeGenre = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (SANITIZED_UNKNOWN.has(lower)) {
    return null;
  }
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export const ensureGenre = (input?: string | null): string => sanitizeGenre(input) ?? DEFAULT_GENRE;

const isGenreMissing = (input?: string | null): boolean => sanitizeGenre(input) === null;

export const normalizeGenreKey = (genre: string): string => ensureGenre(genre).toLowerCase();

export const enrichTracksWithGenres = async (
  accessToken: string,
  playlistTracks: SpotifyPlaylistTrack[],
): Promise<EnrichedTrack[]> => {
  const tracks = playlistTracks
    .map((entry) => entry.track)
    .filter((track): track is EnrichedTrack => Boolean(track && track.id));

  if (tracks.length === 0) {
    return [];
  }

  const artistIds = tracks.flatMap((track) => track.artists.map((artist) => artist.id));
  const artistMap = await getMultipleArtists(accessToken, artistIds);

  const enriched: EnrichedTrack[] = tracks.map((track) => {
    const copy: EnrichedTrack = { ...track };
    copy.genre = undefined;
    copy.sourceGenre = undefined;
    for (const artist of track.artists) {
      const detailed = artistMap[artist.id];
      if (detailed?.genres?.length) {
        const normalized = sanitizeGenre(detailed.genres[0]);
        if (normalized) {
          copy.genre = normalized;
          copy.sourceGenre = 'spotify';
          break;
        }
      }
    }
    return copy;
  });

  const missing = enriched.filter((track) => {
    const missingGenre = isGenreMissing(track.genre);
    if (missingGenre) {
      track.genre = undefined;
    }
    return missingGenre;
  });

  if (missing.length && isGeminiConfigured()) {
    const genreMap = await inferGenres(missing);
    const unresolved: EnrichedTrack[] = [];

    for (const track of missing) {
      const generated = genreMap[track.id];
      const normalized = sanitizeGenre(generated);
      if (normalized) {
        track.genre = normalized;
        track.sourceGenre = 'gemini';
      } else {
        unresolved.push(track);
      }
    }

    for (const track of unresolved) {
      const retry = await inferGenreForTrack(track);
      const normalized = sanitizeGenre(retry);
      if (normalized) {
        track.genre = normalized;
        track.sourceGenre = 'gemini';
      }
    }
  }

  return enriched.map((track) => ({
    ...track,
    genre: ensureGenre(track.genre),
    sourceGenre: track.sourceGenre ?? 'fallback',
  }));
};

