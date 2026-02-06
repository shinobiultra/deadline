# UI Guide

## Experience model

- primary layout: `command deck` left, `map stage` right
- stage modes: `2d map`, `3d globe`, `detail zoom`
- interaction style: lowercase labels, neon outlines, dark default, reduced-motion safe

## Deadline workflow (what users should see)

1. set deadline date + time
2. pick timezone (`local`, `utc`, `aoe`, searchable IANA)
3. resolve UTC instant (live in tracker card)
4. verify lines on map/globe (`now`, `deadline`, `scrub`)
5. optional location for distance/remaining context

The command panel shows both:

- `workflow`: step-by-step progress status
- `deadline tracker`: input wall time, resolved UTC instant, target clock, deadline offset

## Controls

- date/time inputs have internal picker icon buttons and reserved input padding
- no native checkbox styling; all layer toggles use switch pills
- quick adjust chips: `-1d`, `-1h`, `-15m`, `+15m`, `+1h`, `+1d`, `now+24h`
- debug mode: `?debug=1` or `Ctrl+Shift+D`

## Map stage behavior

- 2d map supports endless horizontal wrap
- drag to pan, wheel to zoom, double-click zoom
- `reset view` returns to baseline zoom/center with snap animation
- detail view auto-exits back to deadLINE view when zoom drops below `2.2`

## 3d behavior

- `react-globe.gl` orbit controls (drag rotate, wheel zoom)
- sun-driven day/night lighting
- visible solar `now` beam + deadline ghost path
- hover/readout text explains timezone and target relation

## UX debugging tools

- overlap + hit-target detector (`data-debug-key`)
- one-click capture: `screenshot.png` + `layout.json`
- `npm run ui:capture` produces deterministic desktop/mobile screenshots into `artifacts/ui/`
