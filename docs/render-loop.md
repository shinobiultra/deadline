# Render Loop And Timing

## Goals

- keep countdown/readouts stable and cheap
- keep moving line motion smooth
- avoid recomputing expensive geo/astro work every frame

## Clock split

The app uses two clocks:

1. `ui clock` (1 Hz)
   - source: `useIntervalNow(1000)`
   - used for countdown text, alerts, coarse cards

2. `render clock` (rAF via `useRenderNow`)
   - adaptive target: desktop ~60fps, coarse pointer/mobile ~30fps
   - used for smooth line drift and animated map/globe presentation

## 2D cadence

`Map2DView` keeps smooth solar-line motion per render frame while throttling heavy work:

- solar now-line longitude: continuous (render clock)
- civil bands (now): sampled at 1s cadence
- day/night polygon + terminator polyline: sampled at 5s cadence

This keeps interaction smooth while reducing expensive terminator recomputation cost.

## 3D cadence

`Globe3DView` uses:

- solar line path positions from continuous longitude updates
- sun lighting sample at 1s cadence
- terminator path sample at 5s cadence
- screen-space overlay path updates on rAF (adaptive fps)

The globe stays interactive and visually continuous without forcing full heavy recompute every frame.

## Detail zoom follow

`DetailMapView` follow mode uses an rAF loop with `jumpTo` interpolation toward target lon/lat.

- `follow line: on` keeps center tracking the moving solar line
- zooming out below 2.2 exits detail mode back to main deadLINE map

## Instrumentation

Debug mode (`?debug=1`) displays perf snippets:

- `fps`
- `render drift ms`
- `terminator compute ms`

Use this together with `npm run perf:report` and Playwright e2e to validate smoothness and guard regressions.
