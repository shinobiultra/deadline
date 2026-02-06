# Decisions

## D-001: default civil layer uses UTC offset stripes

Reason: zero-license friction, minimal payload, clear civil-vs-solar comparison.

## D-002: use equation-of-time approximation toggle

Reason: preserves nerd mode while keeping implementation small and deterministic.

## D-003: 2D projection is equirectangular for terminator shading simplicity

Reason: reliable day/night polygon fill and straightforward line rendering.

## D-004: pre-commit framework is `prek` with strict local hooks

Reason: deterministic cross-language hook runner with fast install (`uvx`) and explicit staged+pre-push quality gates.

## D-005: performance checks are enforced via bundle-threshold script

Reason: practical, deterministic perf guardrails without requiring external hosted tooling.

## D-006: map stage should be wide-first, not full-height stretch

Reason: world-map interaction is better with horizontal space; avoiding grid stretch prevents unusable tall empty regions.

## D-007: 3D camera should not auto-recenter every tick

Reason: periodic recentering fights user drag and makes manual globe orbit feel broken.

## D-008: deadline edits must use draft/apply by default

Reason: live-editing the active deadline made accidental overwrites too easy for real deadline tracking.

## D-009: GH Pages build must be base-path aware

Reason: project-site hosting under `/<repo>/` breaks absolute asset/chunk paths and can blank map/globe rendering.

## D-010: split smooth motion from expensive astro recompute cadence

Reason: smooth visual drift needs rAF updates, but day/night/terminator recompute every frame wastes budget and hurts mobile performance.
