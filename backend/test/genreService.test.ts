import { jest } from '@jest/globals';

const getMultipleArtistsMock = jest.fn();
const inferGenresMock = jest.fn();
const inferGenreForTrackMock = jest.fn();
const isConfiguredMock = jest.fn();

jest.unstable_mockModule('../src/services/spotifyService.js', () => ({
  getMultipleArtists: getMultipleArtistsMock,
}));

jest.unstable_mockModule('../src/services/geminiService.js', () => ({
  inferGenres: inferGenresMock,
  inferGenreForTrack: inferGenreForTrackMock,
  isConfigured: isConfiguredMock,
}));

const { enrichTracksWithGenres } = await import('../src/services/genreService.js');

describe('enrichTracksWithGenres', () => {
  const baseTrack = {
    added_at: '2024-01-01T00:00:00Z',
    track: {
      id: 'track-1',
      name: 'Song One',
      uri: 'spotify:track:1',
      duration_ms: 200000,
      preview_url: null,
      album: { id: 'album-1', name: 'Album One', images: [] },
      artists: [
        { id: 'artist-1', name: 'Artist One' },
        { id: 'artist-2', name: 'Artist Two' },
      ],
    },
  } as const;

  beforeEach(() => {
    jest.resetAllMocks();
    getMultipleArtistsMock.mockResolvedValue({
      'artist-1': { genres: ['hip hop'] },
      'artist-2': { genres: ['lo-fi'] },
    });
    isConfiguredMock.mockReturnValue(true);
  });

  it('uses Spotify genres when available', async () => {
    inferGenresMock.mockResolvedValue({});

    const result = await enrichTracksWithGenres('token', [baseTrack as any]);

    expect(result).toHaveLength(1);
    expect(result[0].genre).toBe('Hip Hop');
    expect(result[0].sourceGenre).toBe('spotify');
    expect(inferGenresMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Gemini when Spotify has no genres', async () => {
    getMultipleArtistsMock.mockResolvedValue({
      'artist-1': { genres: [] },
      'artist-2': { genres: [] },
    });
    inferGenresMock.mockResolvedValue({ 'track-1': 'indie pop' });

    const result = await enrichTracksWithGenres('token', [baseTrack as any]);

    expect(result[0].genre).toBe('Indie Pop');
    expect(result[0].sourceGenre).toBe('gemini');
  });

  it('retries per track and ultimately falls back to a default genre', async () => {
    getMultipleArtistsMock.mockResolvedValue({
      'artist-1': { genres: [] },
      'artist-2': { genres: [] },
    });

    inferGenresMock.mockResolvedValue({ 'track-1': 'N/A' });
    inferGenreForTrackMock.mockResolvedValueOnce(null);

    const result = await enrichTracksWithGenres('token', [baseTrack as any]);

    expect(inferGenreForTrackMock).toHaveBeenCalledTimes(1);
    expect(result[0].genre).toBe('Pop');
    expect(result[0].sourceGenre).toBe('fallback');
  });
});
