# Architecture

## Modules

- `src/features/deadline`: input parsing, UTC conversion, validation, state store.
- `src/features/solar`: equation of time, declination, solar/civil line math, terminator points.
- `src/features/civil`: UTC offset stripe model.
- `src/features/civil/timezonePolygons.ts`: optional polygon dataset loader and civil-time zone matching.
- `src/features/landmarks`: core dataset, crossing scheduler, alert generation.
- `src/views/map2d`: canvas rendering of land, day/night, deadline lines.
- `src/views/globe3d`: lazy-loaded `react-globe.gl` scene with orbit controls, sun-driven lighting, and solar/terminator paths.
- `src/ui`: panel, settings, toasts, counters.

## Data Flow

1. User edits deadline input.
2. `parseDeadlineInput` produces canonical deadline instant + target minute.
3. A 1 Hz clock tick drives derived render state for `effectiveTime` (`now` or `deadline` preview).
4. 2D/3D views consume shared derived values (`solarLon`, `terminator`, `civilBands`).
5. Alert engine computes pending time/crossing events and emits toasts/notifications once.

## Offline

- Vite PWA caches app shell + static datasets.
- No server dependencies.

## Tradeoffs

- Civil layer defaults to offset bands (license-light and small payload).
- Optional accuracy mode loads `public/data/timezones/timezones.geojson` and highlights true timezone polygons when present.
- Equation-of-time is enabled by deterministic approximation toggle.
- Timezone polygon mode is deferred as optional ODbL add-on.
