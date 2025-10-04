import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import type { EnrichedTrack } from '../types/spotify.js';
import { logger } from '../utils/logger.js';

type GenreMap = Record<string, string>;

const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002';

const buildPrompt = (tracks: EnrichedTrack[]): string => {
  const payload = tracks.map((track) => ({
    id: track.id,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album.name,
  }));

  return `You are a music metadata expert with deep knowledge of Spotify's public genre taxonomy and historical music context.
Your primary goal is to infer a single, mainstream, and widely recognizable genre for every song provided.
- **NEVER** use placeholders like "Unknown", "None", "Misc", "Other", "N/A" or blank values. You must infer the closest real genre.
- **Prioritize well-known, high-level genres** that a mainstream Spotify listener would expect (e.g., "Pop", "Rock", "Hip Hop", "Jazz"). For 80s hits, "Pop Rock", "Arena Rock", or "New Wave" are excellent choices.
- **Ensure historical context:** For classic tracks, use the genre they were *known for* at the time of their peak popularity, or their most popular modern equivalent.
- **Formatting:** Always capitalize each word in the genre (Title Case) and keep it concise (1–3 words).

Return the results as strict JSON with the shape {"items": [{"id": string, "genre": string}, ...]}.
Songs: ${JSON.stringify(payload)}`;
};

const buildSingleTrackPrompt = (track: EnrichedTrack): string =>
  `You are a music metadata expert. Infer the single best mainstream Spotify genre for the song described below.
- NEVER use placeholders like "Unknown", "None", "Misc", "Other", "N/A" or blank values.
- Always respond with strict JSON exactly like {"genre": "Genre Name"} (Title Case, 1–3 words).
Song: ${track.name}
Artists: ${track.artists.map((artist) => artist.name).join(', ')}
Album: ${track.album.name}`;

let client: GoogleGenAI | undefined;

const getClient = () => {
  if (!env.geminiApiKey) {
    return undefined;
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: env.geminiApiKey,
    });
  }

  return client;
};

export const isConfigured = (): boolean => Boolean(getClient());

const extractTextFromResponse = (payload: unknown): string => {
  const response = payload as { text?: unknown; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> } | undefined;

  const direct = response?.text;
  if (typeof direct === 'string' && direct.trim()) {
    return direct;
  }

  if (Array.isArray(response?.candidates)) {
    for (const candidate of response.candidates) {
      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts)) continue;
      const combined = parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter((text) => text.trim().length > 0)
        .join('\n');
      if (combined.trim().length > 0) {
        return combined;
      }
    }
  }

  return '';
};

export const inferGenres = async (tracks: EnrichedTrack[]): Promise<GenreMap> => {
  if (tracks.length === 0) {
    return {};
  }

  const ai = getClient();
  if (!ai) {
    return {};
  }

  try {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(tracks) }],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 400,
      },
    });

    const output = extractTextFromResponse(response);
    let parsed: { items?: Array<{ id?: unknown; genre?: unknown }> } = {};

    if (output.trim().length) {
      try {
        parsed = JSON.parse(output);
      } catch (parseError) {
        logger.error('Failed to parse Gemini genre response', parseError);
        return {};
      }
    }

    const map: GenreMap = {};
    for (const item of parsed.items ?? []) {
      const id = typeof item.id === 'string' ? item.id : undefined;
      const genre = typeof item.genre === 'string' ? item.genre.trim() : undefined;
      if (id && genre) {
        map[id] = genre;
      }
    }
    return map;
  } catch (error) {
    logger.error('Failed to infer genres via Google Gemini', error);
    return {};
  }
};

export const inferGenreForTrack = async (track: EnrichedTrack): Promise<string | null> => {
  const ai = getClient();
  if (!ai) {
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildSingleTrackPrompt(track) }],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 200,
      },
    });

    const output = extractTextFromResponse(response).trim();
    if (!output) {
      return null;
    }

    try {
      const parsed = JSON.parse(output) as { genre?: unknown };
      if (parsed && typeof parsed.genre === 'string' && parsed.genre.trim()) {
        return parsed.genre.trim();
      }
    } catch {
      // fall through to plain-text handling
    }

    const cleaned = output.replace(/^"+|"+$/g, '').trim();
    return cleaned.length ? cleaned : null;
  } catch (error) {
    logger.error('Failed to infer single-track genre via Google Gemini', error);
    return null;
  }
};

const buildCoverPrompt = (
  playlistName: string,
  genres: string[],
  tracks: EnrichedTrack[],
): string => {
  const genreList = genres.join(', ');
  const songSnippets = tracks
    .slice(0, 6)
    .map((track) => `${track.name} by ${track.artists.map((artist) => artist.name).join(', ')}`)
    .join('; ');

  return `Design a modern, text-free Spotify playlist cover for a playlist titled "${playlistName}" featuring the genres ${genreList}. Capture the shared mood of these songs: ${songSnippets}. Use vibrant colors, expressive abstract art, and square 1:1 composition.`;
};

export const generatePlaylistCover = async (
  playlistName: string,
  genres: string[],
  tracks: EnrichedTrack[],
): Promise<string | null> => {
  const ai = getClient();
  if (!ai) {
    return null;
  }

  const model = env.geminiImageModel ?? DEFAULT_IMAGE_MODEL;

  try {
    const response = await ai.models.generateImages({
      model,
      prompt: buildCoverPrompt(playlistName, genres, tracks),
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg',
        outputCompressionQuality: 80,
        imageSize: '1K',
        negativePrompt: 'no text, no watermark, no words, no logos',
        includeSafetyAttributes: false,
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    return imageBytes ?? null;
  } catch (error) {
    logger.error('Failed to generate playlist cover via Google Gemini', error);
    return null;
  }
};
