import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import { resolve } from 'path';

if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: resolve(process.cwd(), '.env.test') });
}

jest.unmock('../src/config/env.js');

import { inferGenres, isConfigured } from '../src/services/geminiService.js';

const apiKey = process.env.GEMINI_API_KEY ?? '';

const describeMaybe = apiKey ? describe : describe.skip;

describeMaybe('geminiService (integration)', () => {
  it('reports configured when an API key is present', () => {
    expect(isConfigured()).toBe(true);
  });

  it('can run a live genre inference prompt', async () => {
    const tracks = [
      {
        id: 'track-1',
        name: 'Lush Life',
        uri: 'spotify:track:1',
        duration_ms: 200000,
        preview_url: null,
        artists: [{ id: 'artist-1', name: 'Zara Larsson' }],
        album: { id: 'album-1', name: 'So Good', images: [] },
      },
      {
        id: 'track-2',
        name: 'Take Five',
        uri: 'spotify:track:2',
        duration_ms: 300000,
        preview_url: null,
        artists: [{ id: 'artist-2', name: 'The Dave Brubeck Quartet' }],
        album: { id: 'album-2', name: 'Time Out', images: [] },
      },
    ];

    const result = await inferGenres(tracks);

    expect(Object.keys(result)).toEqual(expect.arrayContaining(['track-1', 'track-2']));
    expect(typeof result['track-1']).toBe('string');
  });
});

if (!apiKey) {
  describe.skip('geminiService (integration)', () => {
    it('requires GEMINI_API_KEY to be set to run', () => {
      /* Skipped intentionally */
    });
  });
}
