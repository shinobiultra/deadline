# deadLINE

Minimal OSS web app that visualizes a deadline as moving civil/solar lines over Earth.

## stack

- react + typescript + vite
- luxon (timezone-safe parsing)
- d3-geo canvas (2d)
- react-three-fiber (3d globe)
- zustand state + localStorage
- vitest + fast-check + playwright
- vite pwa (offline shell)

## run

```bash
npm install
npm run dev
```

## quality

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## docs

- spec: `docs/spec.md`
- architecture: `docs/architecture.md`
- licenses: `docs/licenses.md`
- agent logs: `docs/agents/implementation/`

## notes

- default civil layer uses UTC offset bands (no ODbL boundary payload).
- optional accuracy mode can load timezone polygons from `public/data/timezones/timezones.geojson`.
- optional timezone polygon mode can be added under `data/timezones/` with attribution.
