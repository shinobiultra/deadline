# Daily Log

## 2026-02-06

- Initialized repo and Vite React TypeScript scaffold.
- Added project structure per spec: features/views/ui/docs/tests/workflows.
- Implemented deadline parsing with timezone validation, DST ambiguity handling, and UTC canonicalization.
- Implemented solar/civil algorithms: equation-of-time toggle, solar meridian, terminator polyline, night polygon, civil offset bands, distance math.
- Implemented landmark crossing solver using bisection over continuous solar phase.
- Built UI: command panel, countdown, stats, distance box, settings drawer, toasts, 2D map, lazy 3D globe.
- Added offline datasets and PWA caching for app shell/data.
- Added unit/property/e2e tests and CI/deploy workflows.
- Added optional timezone polygon accuracy mode with drop-in dataset path (`public/data/timezones/timezones.geojson`) and fallback to offset bands.
- Upgraded timezone UX to reliable searchable select and added AoE (`Etc/GMT+12`) alias support.
- Replaced custom 3D prototype renderer with `react-globe.gl` implementation including drag/zoom orbit controls and sun-driven lighting.
- Added 2D map drag/zoom/reset interactions and improved button styling/motion treatments.
- Validation completed: lint, vitest suite, production build, playwright e2e pass.
