# Deployment Guide

## GitHub Pages

1. Push `main` branch.
2. Open repository settings -> `Pages`.
3. Set source to `GitHub Actions`.
4. Wait for workflow `deploy gh pages` to complete.
5. Open the published URL from workflow output.

Build in this workflow runs with GH-pages env:

```bash
GITHUB_PAGES=true GITHUB_PAGES_REPO=<repo-name> npm run build
```

See `docs/gh-pages.md` for base-path and asset URL rules.

Local GH-pages smoke:

```bash
GH_PAGES_REPO=deadline GH_PAGES_PORT=4176 npm run test:e2e:gh-pages
```

## Vercel

1. Import the repository into Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Deploy and open the generated `.vercel.app` URL.

## Post-deploy verification checklist

1. Set deadline date/time/timezone and confirm countdown updates.
2. Confirm `aoe` timezone works (`Anywhere on Earth`).
3. Verify map is wide layout with command panel at left and support cards around map stage.
4. In `2d map`: drag wraps endlessly, zoom works, `reset view` snaps back.
5. In `3d globe`: drag rotates reliably, wheel zoom works, `reset orbit` re-centers.
6. Toggle `detail zoom`: map tiles and deadline lines render; zoom out below `2.2` auto-returns.
7. Enable debug mode (`?debug=1`) and confirm warnings remain `0` on desktop.
8. Verify snapshot export works (`snap`).
9. Open `?debug=1` and confirm no red `assets broken` banner.
