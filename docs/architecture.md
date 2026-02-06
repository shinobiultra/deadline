# Architecture

## Modules

- `src/features/deadline`: input parsing, UTC conversion, validation, state store.
- `src/features/deadline/slots.ts`: persisted deadline-slot manager (`active`, `draft`, lock state, capped slot list).
- `src/features/solar`: equation of time, declination, solar/civil line math, terminator points.
- `src/features/civil`: UTC offset stripe model.
- `src/features/civil/timezonePolygons.ts`: optional polygon dataset loader and civil-time zone matching.
- `src/features/landmarks`: core dataset, crossing scheduler, alert generation.
- `src/views/map2d`: canvas rendering of land, day/night, deadline lines.
- `src/views/globe3d`: lazy-loaded `react-globe.gl` scene with orbit controls, sun-driven lighting, and solar/terminator paths.
- `src/ui`: panel, settings, toasts, counters.
- `src/ui/DebugOverlay.tsx`: debug capture mode with overlap checks + screenshot/layout export.
- `src/ui/NearDeadlineEffects.tsx`: staged urgency FX using `tsparticles`.

## Data Flow

1. User edits deadline draft inputs (safe-edit mode).
2. `apply` commits draft to active slot; `discard` restores draft from active slot.
3. `parseDeadlineInput` produces canonical deadline instant + target minute from active slot.
4. Dual clocks drive behavior:
5. `ui clock` (1 Hz): countdown text, cards, alert thresholds.
6. `render clock` (rAF): smooth line drift and follow behavior in visual layers.
7. 2D/3D views consume shared derived values (`solar now/deadline lines`, `terminator`, `civil bands/polygons`) with throttled expensive recomputes.
8. Alert engine computes threshold/crossing transitions and emits toasts/notifications once.

## Offline

- Vite PWA caches app shell + static datasets.
- No server dependencies.

## Tradeoffs

- Civil layer defaults to offset bands (license-light and small payload).
- Optional accuracy mode loads `public/data/timezones/timezones.geojson` and highlights true timezone polygons when present.
- Equation-of-time is enabled by deterministic approximation toggle.
- Timezone polygon mode is deferred as optional ODbL add-on.
