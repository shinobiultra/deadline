# deadLINE Specification (v1)

Source: user-provided implementation brief on February 6, 2026.

## 0. Pitch

`deadLINE` is a minimalist web app that turns a deadline (`date + time + timezone`) into a moving line sweeping west across Earth in 2D and 3D, comparing civil time vs solar time.

## 1. Goals

- Parse timezone-safe deadlines and convert to UTC instant.
- Support long-horizon deadlines (`>24h`) with a clear unwind/fast-forward visualization mode.
- Keep a screenshot at the top of `README.md` so the project intent is obvious immediately.
- Render day/night terminator + two deadline lines:
  - Civil: timezone-chunked.
  - Solar: continuous meridian.
- Show countdown, distance-to-line, and crossing notifications.
- Work client-side only, static hosting friendly, offline after first load.

## 2. UX Summary

- stage header greeting requirement: `got a deadline? and wonder where on earth it literally is?`
- Full-screen map-first shell (no permanent side panel, no permanent bottom cards).
- Only 4 always-visible controls:
  - deadline chip (top-left)
  - `2d|3d` + `snap|share` cluster (top-right)
  - layers button (bottom-right)
  - countdown HUD (bottom-left)
- Deadline editing/settings live inside dismissible drawers/popovers.
- Detail map is a layers-driven lens (`auto|off|on`), not a top-level mode button.
- Optional alerts remain: time thresholds + landmark crossings.

## 3. Core Definitions

- `deadline_utc`: absolute instant derived from local input.
- `target_hhmm`: wall-clock target minute of day from input time.
- Civil time: timezone offset + DST.
- Solar time: longitude-driven continuous local solar time (optionally equation-of-time corrected).

## 4. Data & Licensing

- Base geography from Natural Earth / world-atlas.
- Optional timezone polygons are ODbL (kept separate if enabled).
- Sun math from SunCalc/Astronomy-style calculations.
- No Google Earth embedding.

## 5. Rendering Decision

- 2D: D3 geo + canvas.
- 3D: Three via React Three Fiber.
- No provider tokens required.

## 6. Stack

- React + TypeScript + Vite
- Tailwind CSS
- Luxon for TZ handling
- SunCalc + deterministic solar math utilities
- Zustand state
- Vitest + fast-check + Playwright
- GitHub Actions + GitHub Pages deploy

## 7. Algorithms (Implemented)

- Deadline conversion with DST ambiguity detection.
- Solar meridian: `lon = 15 * ((targetMin - utcMin - E) / 60)` (wrapped).
- Terminator via sun declination + subsolar longitude sampling.
- Civil stripe highlighting based on UTC offset bands.
- Distance-to-line in minutes and km along latitude.
- Landmark crossings solved by bisection over a continuous solar phase function.

## 8. Design Direction

- Hacker vibe: lowercase labels, neon accents, dark atmosphere, scanline/noise effect.

## 9. Repo Shape

Implemented in this repo with features/views/ui/docs/tests/workflows.

## 10. Agent Procedure

This repo includes `docs/agents/implementation/*` logs for work tracking.

## 11-15. Quality, Performance, Privacy, Roadmap

- Robust tests for timezone and solar math.
- Client-only storage in localStorage.
- Lazy 3D loading and static hosting deployment path.
- Optional roadmap items retained in architecture/open-questions docs.
