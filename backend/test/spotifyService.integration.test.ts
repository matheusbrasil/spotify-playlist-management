import { jest } from '@jest/globals';

// Ensure we use the real environment variables (no mocks here)
jest.unmock('../src/config/env.js');

import {
  getCurrentUserProfile,
  getUserPlaylists,
  getPlaylistWithTracks,
} from '../src/services/spotifyService.js';

const accessToken = process.env.SPOTIFY_ACCESS_TOKEN ?? '';

const describeMaybe = accessToken ? describe : describe.skip;

describeMaybe('spotifyService (integration)', () => {
  it('reads the current user profile with a live token', async () => {
    const profile = await getCurrentUserProfile(accessToken);
    expect(profile.id).toBeTruthy();
  });

  it('lists user playlists and can fetch tracks for the first playlist', async () => {
    const playlists = await getUserPlaylists(accessToken);
    expect(Array.isArray(playlists)).toBe(true);

    if (!playlists.length) {
      console.warn('No playlists found for this account; skipping playlist detail assertion.');
      return;
    }

    const first = playlists[0];
    const { playlist, tracks } = await getPlaylistWithTracks(accessToken, first.id);

    expect(playlist.id).toBe(first.id);
    expect(Array.isArray(tracks)).toBe(true);
  });
});

if (!accessToken) {
  // Provide a helpful hint when the suite is skipped
  describe.skip('spotifyService (integration)', () => {
    it('requires SPOTIFY_ACCESS_TOKEN to be set to run', () => {
      /* Skipped on purpose */
    });
  });
}

