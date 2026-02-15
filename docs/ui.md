# UI Guide (Map-First v1)

## Experience Model

- default layout is full-screen map/globe (no permanent side panel, no permanent bottom cards)
- only 4 controls are always visible:
  - `deadline chip` (top-left)
  - `2d|3d + snap + share` cluster (top-right)
  - `layers` button (bottom-right)
  - `countdown hud` (bottom-left)
- all other controls are in drawers/popovers
- opening line is onboarding-only (`got a deadline? and wonder where on earth it literally is?`) and fades out automatically
- corner HUD uses safe-area offsets and viewport collision rules:
  - on narrow widths, top-right cluster collapses to a compact menu trigger
  - countdown width clamps to preserve separation from layers button

## Primary Surfaces

### deadline chip

- shows active slot summary + UTC/JST conversion + state pill (`synced|draft|locked`)
- click opens deadline drawer
- right-click opens quick actions (`new`, `dup`, `lock`, `share`)

### mode cluster

- segmented: `2d`, `3d`
- actions: `snap`, `share`
- switching keeps timeline/layer state and uses stored 2d/globe focus context
- compact behavior: under narrow width, cluster becomes a single menu button to prevent edge overlap

### layers panel

- base map: `deadLINE dark`, `osm light`, `osm dark`
- overlays: `solar lines`, `civil timezones`, `terminator`, `landmarks`
- detail lens: `auto|off|on`
- effects: `off|subtle|spicy`
- compact legend is available here (not always printed over map)

### countdown hud

- compact single-line countdown (`T-...`)
- opens info drawer on click

## Drawers

### deadline drawer

- slot manager: switch/new/duplicate/lock/delete(+confirm phrase)
- draft-based editor: date, time, timezone search/select, quick adjust chips
- `apply` / `discard` shown only while dirty
- location controls: use location, pick on map/globe, clear, city search
- advanced section: apparent solar, timezone polygon mode, alert thresholds, notifications, reduced motion, dst ambiguity selector

### info drawer

- distance/remaining summary
- collapsible stats section
- upcoming crossings/event log
- debug subsection when `?debug=1`

## Visualization Notes

- 2d: infinite wrap + cursor-anchored zoom
- detail lens is not a top-level mode; controlled from layers
- 3d includes:
  - sun lighting + subsolar marker
  - solar now/deadline paths
  - soft terminator band
  - hover tooltip with civil time, solar time, and delta-to-target minutes

## Screenshot Baseline

- deterministic capture mode: `?demo=1&capture=1`
- fixed demo deadline: `2026-02-05 00:00 AoE` (`2026-02-05 12:00 UTC`, `21:00 JST`)
- frozen demo now: `2026-02-05T08:21:44Z`
- capture presets:
  - `?demo=1&capture=1&view=2d`
  - `?demo=1&capture=1&view=3d`
  - `?demo=1&capture=1&view=detail`
