# Zoom MS-60B+ Chain Display

This folder contains a minimalist web viewer designed for a Raspberry Pi with a 3.5" touchscreen. It renders up to four effects from the Zoom MS-60B+ chain (skipping the first slot) using artwork exported from the official effect list PDF.

## Files

- `index.html` – Static markup optimised for a 480×320 display.
- `styles.css` – Dark theme styling inspired by the pedal UI.
- `app.js` – Fetches the effect chain JSON and effect metadata.
- `effects-catalog.json` – Maps effect IDs to friendly names and local artwork.
- `sample-chain.json` – Example chain you can use for quick validation.
- `assets/` – Drop your cropped effect images here (PNG recommended).

## Usage

1. Export your current Zoom chain using [`zoom-explorer`](https://github.com/matheusbrasil/zoom-explorer). Save it as `effects.json` (schema matches `sample-chain.json`).
2. Extract the effect thumbnails from the official PDF and place them in `assets/effects/`.
3. Start a static web server:
   ```bash
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in Chromium kiosk mode on the Pi. Press **Refresh** on the screen any time you overwrite `effects.json`.

The script gracefully falls back to `sample-chain.json` if `effects.json` is not present, making it easy to test locally before wiring in live exports.
