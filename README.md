# deadLINE

Minimal OSS web app that visualizes a deadline as moving civil/solar lines over Earth (2D map + 3D globe).

## stack

- react + typescript + vite
- luxon (timezone-safe parsing)
- d3-geo canvas (2d)
- react-globe.gl / globe.gl / three (3d globe with drag/zoom orbit controls)
- radix switch + custom segmented controls (no browser checkbox UI)
- tsparticles (`@tsparticles/react` + slim engine) for near-deadline sparks
- zustand + localStorage
- vitest + fast-check + playwright
- vite pwa (offline shell + cached static assets)

## local setup

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

## local testing

Run all quality checks:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run ui:capture
```

Run production preview locally:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Then open `http://localhost:4173`.

## manual smoke checklist

1. Enter a deadline date/time/timezone and confirm countdown updates.
2. Set timezone to `Anywhere on Earth (AoE, UTC-12)` and confirm it is accepted.
3. Toggle between `2d map` and `3d globe`.
4. Toggle day/night, solar line, civil zones, landmarks.
5. Set location (city chip or geolocation) and confirm distance box updates.
6. Open `settings`, enable optional notifications, and check toast behavior.
7. Switch preview mode between `now`, `deadline`, and `scrub`.
8. On 2d map: drag horizontally for continuous wrap, wheel zoom, then `reset view` (must snap back).
9. Use `snap` in stage header and verify PNG download.
10. Enable debug mode (`?debug=1` or `Ctrl+Shift+D`) and verify overlap warnings/capture tools.

## optional timezone polygon accuracy mode

By default, civil-time rendering uses UTC offset bands.

To enable real timezone polygons:

1. Add `public/data/timezones/timezones.geojson`.
2. Start app and enable `settings -> accuracy mode (timezone polygons)`.
3. Status should show `timezone polygons loaded`.

Dataset format details are in `public/data/timezones/README.md`.

## deploy: github pages (free)

This repo includes `.github/workflows/deploy-gh-pages.yml`.

1. Push `main` to GitHub.
2. In GitHub repo settings, open `Pages` and set source to `GitHub Actions` (if not auto-set).
3. Wait for workflow `deploy gh pages` to pass.
4. Open the Pages URL from workflow output or repo Pages settings.

## deploy: vercel (free)

1. Import the GitHub repo in Vercel.
2. Framework preset: `Vite` (auto-detected).
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Deploy.

## online verification checklist

1. Open deployed URL in a fresh browser profile/tab.
2. Confirm map renders and countdown runs.
3. Toggle to globe and confirm illuminated hemisphere + solar meridian render.
4. Confirm 3d solar now/deadline paths are visible and interactive.
5. Verify city search/location and settings work.
6. Optional: enable browser notifications and verify permission prompt works.
7. Optional offline check: load once, then disable network in devtools and refresh.

## docs

- spec: `docs/spec.md`
- architecture: `docs/architecture.md`
- licenses: `docs/licenses.md`
- agent logs: `docs/agents/implementation/`
