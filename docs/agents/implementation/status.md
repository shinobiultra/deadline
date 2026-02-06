# Status

- Scope: v1 core delivered.
- Verification: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` all pass locally.
- Accuracy mode: optional timezone polygons supported via `public/data/timezones/timezones.geojson`.
- Known gap: timezone polygon data itself is not bundled by default to avoid ODbL payload/attribution coupling.
