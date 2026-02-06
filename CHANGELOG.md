# Changelog

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
