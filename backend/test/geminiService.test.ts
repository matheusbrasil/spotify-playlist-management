import { jest } from '@jest/globals';

jest.mock('../src/config/env.js', () => ({
  env: {
    spotifyClientId: 'test-client-id',
    spotifyClientSecret: 'test-client-secret',
    spotifyRedirectUri: 'http://localhost/callback',
    spotifyScopes: 'playlist-read-private',
    geminiApiKey: 'test-gemini-key',
    geminiModel: 'gemini-1.5-flash',
  },
}));

const generateContentMock = jest.fn();
const googleConstructorMock = jest.fn().mockImplementation(() => ({
  models: {
    generateContent: generateContentMock,
  },
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: googleConstructorMock,
}));

import { inferGenres, isConfigured } from '../src/services/geminiService.js';

describe('geminiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports configuration when an API key is set', () => {
    expect(isConfigured()).toBe(true);
    expect(googleConstructorMock).toHaveBeenCalledWith({ apiKey: 'test-gemini-key' });
  });

  it('sends the prompt to Gemini and maps the response', async () => {
    generateContentMock.mockImplementation(async () => ({
      text: JSON.stringify({
        items: [
          { id: 'track-1', genre: 'Chill Hop' },
          { id: 'track-2', genre: 'Indie Pop' },
        ],
      }),
    }));

    const result = await inferGenres([
      {
        id: 'track-1',
        name: 'Song One',
        uri: 'spotify:track:1',
        duration_ms: 200000,
        preview_url: null,
        artists: [{ id: 'artist-1', name: 'Artist One' }],
        album: { id: 'album-1', name: 'Album One', images: [] },
      },
      {
        id: 'track-2',
        name: 'Song Two',
        uri: 'spotify:track:2',
        duration_ms: 210000,
        preview_url: null,
        artists: [{ id: 'artist-2', name: 'Artist Two' }],
        album: { id: 'album-2', name: 'Album Two', images: [] },
      },
    ]);

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash',
      }),
    );

    expect(result).toEqual({
      'track-1': 'Chill Hop',
      'track-2': 'Indie Pop',
    });
  });
});
