# Changelog

## 0.3.1 - 2026-02-06

- added deterministic demo mode (`?demo=1`) for docs/screens and visual tests:
  - fixed deadline baseline: `2026-02-05 00:00 AoE` (`21:00 JST`)
  - frozen clock for drift-free captures
  - capture variant (`?capture=1`) for stable screenshot conditions
- improved deadline UX clarity and safety in the command deck:
  - stronger active target banner + state chips (`synced`, `draft unsaved`, `locked`)
  - slot rename and guarded delete controls
  - apply/discard actions shown only while draft is dirty
  - workflow card auto-collapses when fully complete
- fixed detail-map robustness so hover and zoom interactions no longer depend on raster tile completion
- improved zoom ergonomics:
  - cursor-anchored zoom in 2D map and detail map
  - wheel-based globe dolly toward cursor raycast hit
- added seam-safe 2D solar-line rendering and compact visual legend
- added deterministic screenshot governance:
  - `npm run ui:capture` now updates `docs/screens/*`
  - CI gate verifies screenshot currency via `npm run screens:check` with strict pixel-drift tolerance
- expanded UI docs with per-control rationale in `docs/ui-controls.md`

## 0.3.0 - 2026-02-06

- added safe deadline-slot workflow:
  - active deadline bar with slot switch/new/duplicate/lock actions
  - draft/apply/discard editing model and keyboard shortcuts
  - slot persistence in localStorage with capped history
- improved deadline clarity in stage header with active/deadline-draft status line
- fixed alert-threshold sequencing to avoid spurious deadline threshold notifications
- improved render smoothness/perf balance:
  - dual-clock flow in app (`ui` 1Hz + `render` rAF)
  - throttled heavy 2D/3D astronomy recompute cadences
  - rAF-based globe overlay path updates
- hardened GH Pages compatibility:
  - env-aware Vite base for project-site deploys
  - asset URL normalization via `import.meta.env.BASE_URL`
  - debug-mode asset sanity checks with explicit error banner
  - GH-pages subpath smoke tests + preview server
- expanded CI with dedicated GH-pages rendering smoke job
- added docs:
  - `docs/gh-pages.md`
  - `docs/render-loop.md`
  - updated deploy/testing/docs index references

## 0.2.1 - 2026-02-06

- changed layout to prioritize a wide, shorter map stage
- moved secondary utility cards around the map stage to reduce vertical stretch
- fixed 3D manual rotation by removing per-tick camera recenter behavior
- added `reset orbit` action and manual-orbit status feedback in globe view
- extended e2e coverage for globe rotation intent and debug-layout `warnings: 0`
- added deployment runbook: `docs/deploy.md`
- synced docs index, UI/testing/versioning docs, and release metadata

## 0.2.0 - 2026-02-06

- improved command panel UX with workflow tree + deadline tracker card
- added explicit live-tracking status for deadline edit feedback
- supported `Anywhere on Earth (AoE)` timezone flow in controls and tests
- hardened detail zoom behavior with auto-return on low zoom
- added deterministic UI capture pipeline and debug layout tooling
- introduced strict quality gates:
  - prettier formatting checks
  - stricter TypeScript compiler options
  - stricter ESLint type-aware rules
  - perf report thresholds + artifact output
- added `prek` pre-commit/pre-push hook configuration
- added Apache-2.0 license file and metadata
- expanded docs for UI, testing, and versioning
