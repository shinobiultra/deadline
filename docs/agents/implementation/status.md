# Status

- Version: `0.2.1`.
- Scope: v1 core + UX hardening + strict quality and hook automation.
- Verification gates:
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run perf:report`
  - `npm run test:e2e`
  - `npm run ui:capture`
- AoE: supported as `Anywhere on Earth (AoE, UTC-12)` mapped to `Etc/GMT+12`.
- 2D map: infinite horizontal wrap, zoom/pan/reset, now+deadline visualization.
- 3D globe: `react-globe.gl` with reliable manual orbit interaction, reset orbit control, and visible solar/terminator paths.
- Detail mode: MapLibre raster open-map style with zoom-out auto-return to deadLINE view.
- Layout: command deck left, wide map stage right, utility cards around map stage (below map).
- Debug tooling: overlap detector + screenshot/layout export.
- Known gap: timezone polygon data is still optional to avoid default ODbL payload coupling.
