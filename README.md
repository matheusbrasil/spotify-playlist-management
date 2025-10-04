# 🎧 Smart Spotify Playlist Splitter

Cross-platform experience (Express backend + React Native mobile app) that surfaces your Spotify playlists, enriches track metadata with genres, and can auto-build new playlists by genre via the **Smart Split** workflow.

## Highlights
- **Spotify OAuth** (authorization code flow) handled by the Express backend.
- **Playlist explorer**: browse every playlist and inspect full track metadata (song, artist, album, inferred genre).
- **Genre enrichment**: pulls artist genres from Spotify and backfills gaps with the Google Gemini API when configured.
- **Smart Split automation**: preview genre-based splits for any playlist, rename the proposed lists, then create them in Spotify with a tap.
- **React Native (Expo)** mobile client for a polished on-the-go experience.

## Project Structure
```
backend/   # Express + TypeScript API server
mobile/    # React Native (Expo) client
```

## Prerequisites
- Node.js 18.18+ and npm
- Spotify Developer account with a registered application
- Google Gemini API key (optional, but required for AI genre backfilling)
- For mobile development: Expo CLI (`npm install -g expo-cli`) and an emulator or the Expo Go app

---

## Backend Setup (`backend/`)
1. Install dependencies
   ```bash
   cd backend
   npm install
   ```

2. Configure environment variables
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your credentials:
   - `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`: from the Spotify developer dashboard
   - `SPOTIFY_REDIRECT_URI`: must match the URL registered with Spotify (e.g. `http://localhost:4000/auth/callback`)
   - `GEMINI_API_KEY`: required to enrich missing genres
   - `CLIENT_URL`: origin allowed by CORS (e.g. the Expo dev tunnel URL)

3. Run the server
   ```bash
   npm run dev
   ```
   The API listens on `http://localhost:4000` by default.

4. Run unit tests
   ```bash
   npm run test
   ```
   The Jest suite runs with `NODE_ENV=test`, loading values from `.env.test` if present (copy `backend/.env.test.example` to `backend/.env.test` to customise).

> **Tip:** All Spotify/Gemini calls are mocked/stubbed in the tests, so you can run them without live credentials.

### Live integration checks (optional)
If you want to verify real API connectivity, dedicated integration suites are available. These are **disabled by default** and require real credentials:

```bash
# Spotify (needs a valid user access token with playlist scopes)
export SPOTIFY_ACCESS_TOKEN="<copy token>"
npx jest test/spotifyService.integration.test.ts --runInBand

# Google Gemini (needs GEMINI_API_KEY in environment or .env.test)
export GEMINI_API_KEY="<your gemini key>"
npx jest test/geminiService.integration.test.ts --runInBand
```

Both integration tests skip automatically if the required environment variable is missing. Tokens expire, so refresh them before re-running.

### Key API Routes
| Route | Method | Description |
| --- | --- | --- |
| `/auth/start` | POST | Initiate Spotify OAuth, returns authorize URL & session state |
| `/auth/callback` | GET | Spotify redirect target – exchanges code for tokens |
| `/auth/session/:state` | GET | Consume stored tokens (used by the mobile app) |
| `/auth/refresh` | POST | Refresh a Spotify access token |
| `/users/me` | GET | Current Spotify profile |
| `/playlists` | GET | List playlists (summary) |
| `/playlists/:id` | GET | Playlist details with genre-enriched tracks |
| `/smart-split/:id/preview` | GET | Genre-based split preview |
| `/smart-split/:id/apply` | POST | Create the selected split playlists |

---

## Mobile Setup (`mobile/`)
1. Install dependencies
   ```bash
   cd mobile
   npm install
   ```

2. Configure Expo project
   - Update `app.json` → `expo.extra.apiUrl` if your backend is not on `http://localhost:4000`.
   - Ensure the custom scheme (`smartspotify`) is listed in your Spotify app’s **Redirect URIs** as `smartspotify://auth-callback`.

3. Start Expo
   ```bash
   npm run start
   ```
   Open the Expo app (or emulator) and load the project.

### Authentication Flow (Mobile)
1. Mobile calls `POST /auth/start` and receives Spotify’s authorize URL + a state token.
2. Expo opens the Spotify consent screen in a secure browser session.
3. After approval, Spotify redirects to the backend (`/auth/callback`) which stores tokens and forwards to the Expo deep link (`smartspotify://auth-callback?state=...`).
4. The app consumes the state via `/auth/session/:state`, caches access/refresh tokens, and keeps them fresh with `/auth/refresh`.

### Smart Split Flow
1. Open a playlist and tap **Smart Split by Genre**.
2. The app calls `/smart-split/:playlistId/preview` – the backend groups tracks by genre and suggests playlist names.
3. Toggle which splits to create, tweak the names if desired, then hit **Create Selected Playlists**.
4. The backend creates new Spotify playlists (private by default) and populates them with the genre tracks.

---

## Development Tips
- The backend stores OAuth sessions in memory for simplicity. In production, replace `sessionStore` with a persistent solution (Redis, DB, etc.).
- `GEMINI_API_KEY` is optional; when absent, missing genres remain `Unknown`.
- For reference builds that integrate the Zoom MS-60B+, review the setup guidance adapted from [pthrrr's Raspberry Pi MIDI host notes](https://gist.github.com/pthrrr/7e6d40f720b1a1ebd9618dc95c08bc65).

---

## Raspberry Pi MIDI Host + 3.5" Display

These steps condense the workflow from the reference gist above so you can turn a Raspberry Pi into a USB MIDI host for the Zoom MS-60B+ and reuse this repository’s lightweight chain display for a 3.5" touchscreen.

### 1. Prepare the Raspberry Pi

1. Flash Raspberry Pi OS Lite (64-bit) to a microSD card and boot the Pi.
2. Update packages and enable the touchscreen frame buffer:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo raspi-config  # Enable SPI/I2C if your display requires it, configure locale/timezone
   ```
3. Install USB MIDI utilities and autoconnect helpers:
   ```bash
   sudo apt install -y alsa-utils aconnectgui python3-alsaaudio python3-rtmidi
   sudo systemctl enable --now aconnectd.service || true
   ```
4. Connect the Zoom pedal via USB; verify it enumerates as a MIDI device:
   ```bash
   aconnect -l
   ```
   You should see the Zoom MS-60B+ listed under the client section.

### 2. Bridge MIDI Ports Automatically

Create a systemd service to bridge the Zoom pedal to a class-compliant MIDI controller (or virtual port) so the pedal receives clock/PC messages without manual intervention.

```bash
sudo tee /etc/systemd/system/zoom-midi-bridge.service <<'SERVICE'
[Unit]
Description=Auto-connect Zoom MS-60B+ MIDI ports
After=sound.target

[Service]
Type=simple
ExecStart=/usr/bin/aconnect 'ZOOM MS-60B+':0 20:0
Restart=on-failure

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl enable --now zoom-midi-bridge.service
```

Adjust the `ExecStart` ports to match the output from `aconnect -l` in your environment (the right-hand numbers are the ALSA client:port identifiers).

### 3. Deploy the Effect Chain Display

1. Copy the `rpi-display/` directory to the Pi (e.g., via `scp`).
2. Use the [zoom-explorer](https://github.com/matheusbrasil/zoom-explorer) tooling on your workstation to export the current chain as JSON. Save the JSON file as `effects.json` in `rpi-display/` (follow the schema shown in `sample-chain.json`).
3. From the Zoom MS-60B+ effect list PDF, export/crop the individual effect thumbnails and place them into `rpi-display/assets/effects/` using lowercase filenames that match the IDs in `effects-catalog.json` (e.g., `svt.png`).
4. Serve the viewer and open it in a kiosk browser on the Pi:
   ```bash
   cd ~/rpi-display
   python3 -m http.server 8000
   ```
5. Launch Chromium in kiosk mode on the 3.5" touchscreen:
   ```bash
   chromium-browser --kiosk http://localhost:8000
   ```

The viewer skips the first slot in the chain (often used for noise reduction) and renders up to four subsequent effects with their artwork and slot numbers. Hitting the **Refresh** button reloads the JSON file so you can update the chain without restarting the kiosk.

> **Tip:** If you prefer an offline workflow, symlink your exported chain JSON to `sample-chain.json` or update `app.js` to point at your preferred filename.
- Adjust Spotify scopes via `SPOTIFY_SCOPES` if you need more privileges.
- The React Native client currently stores tokens in-memory. Add secure storage if you need persistence across app restarts.

## Next Steps
- Add automated tests (backend unit/integration, mobile UI tests).
- Harden error handling and introduce structured logging/monitoring.
- Persist user sessions and playlists in a database for analytics.

Enjoy building smarter Spotify playlists! 🎶
