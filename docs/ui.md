# UI Guide

## Experience model

- primary layout: `command deck` left, wide map stage right
- secondary cards (`countdown`, `stats`, `distance`, `settings`) live under map stage
- stage modes: `2d map`, `3d globe`, `detail zoom`
- interaction style: lowercase labels, neon outlines, dark default, reduced-motion safe

## Deadline workflow (what users should see)

0. choose active deadline slot (or create/duplicate one)
1. set deadline date + time
2. pick timezone (`local`, `utc`, `aoe`, searchable IANA)
3. resolve UTC instant (live in tracker card)
4. verify lines on map/globe (`now`, `deadline`, `scrub`)
5. optional location for distance/remaining context

The command panel shows both:

- `workflow`: step-by-step progress status
- `deadline tracker`: input wall time, resolved UTC instant, target clock, deadline offset
- `active deadline`: slot picker + lock + draft/apply/discard safety state

## Controls

- date/time inputs have internal picker icon buttons and reserved input padding
- no native checkbox styling; all layer toggles use switch pills
- draft safety controls:
  - `apply` commits draft edits to active deadline
  - `discard` restores draft from active deadline
  - `lock` prevents accidental updates to active slot
- quick adjust chips: `-1d`, `-1h`, `-15m`, `+15m`, `+1h`, `+1d`, `now+24h`
- debug mode: `?debug=1` or `Ctrl+Shift+D`

## Map stage behavior

- 2d map supports endless horizontal wrap
- drag to pan, wheel to zoom, double-click zoom
- `reset view` returns to baseline zoom/center with snap animation
- detail view auto-exits back to deadLINE view when zoom drops below `2.2`

## 3d behavior

- `react-globe.gl` orbit controls (drag rotate, wheel zoom)
- manual orbit is sticky: user drag disables auto-orbit drift until `reset orbit`
- sun-driven day/night lighting
- visible solar `now` beam + deadline ghost path
- hover/readout text explains timezone and target relation

## UX debugging tools

- overlap + hit-target detector (`data-debug-key`)
- one-click capture: `screenshot.png` + `layout.json`
- `npm run ui:capture` produces deterministic demo screenshots into `docs/screens/` (and mirrors to `artifacts/ui/`)

## Screenshot Baseline

- demo mode URL: `?demo=1&capture=1`
- fixed demo deadline: `2026-02-05 00:00 AoE` (`2026-02-05 12:00 UTC`, `21:00 JST`)
- frozen demo now: `2026-02-05T08:21:44Z`
- view presets for capture:
  - `?demo=1&capture=1&view=2d`
  - `?demo=1&capture=1&view=3d`
  - `?demo=1&capture=1&view=detail`

## Control Audit

Detailed control-level justification is maintained in `docs/ui-controls.md`.
