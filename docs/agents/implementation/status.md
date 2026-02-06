# Status

- Scope: v1 core delivered with additional UX hardening and debug tooling.
- Verification: `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, `npm run ui:capture` pass locally.
- AoE: supported as `Anywhere on Earth (AoE, UTC-12)` mapped to `Etc/GMT+12`.
- 2D map: infinite horizontal wrap, zoom/pan, reset animation, now+deadline lines.
- 3D globe: `react-globe.gl` with orbit interaction and visible solar/terminator paths.
- Debug tooling: overlap detector + screenshot/layout export is implemented.
- Known gap: timezone polygon data itself is not bundled by default to avoid ODbL payload/attribution coupling.
