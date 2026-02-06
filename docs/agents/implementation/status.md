# Status

- Scope: v1 core delivered.
- Verification: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` all pass locally.
- Accuracy mode: optional timezone polygons supported via `public/data/timezones/timezones.geojson`.
- AoE: supported as `Anywhere on Earth (AoE, UTC-12)` mapped to `Etc/GMT+12`.
- 3D: implemented with `react-globe.gl` with orbit drag/zoom and dynamic lighting.
- Known gap: timezone polygon data itself is not bundled by default to avoid ODbL payload/attribution coupling.
