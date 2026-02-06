# Testing And Quality

## Test matrix

- static: `format:check`, `lint`, `typecheck`
- unit: `tests/unit/*`
- property-based: `tests/property/*` (fast-check)
- e2e: `tests/e2e/*` (Playwright, Chromium)
  - includes debug-layout assertion (`warnings: 0`)
  - includes globe manual-rotate and `reset orbit` coverage
  - includes GH-pages subpath smoke (`tests/e2e/gh-pages.spec.ts` via dedicated config)
- UI capture: `scripts/capture_ui.mjs` screenshots for manual visual review
- performance: `scripts/perf_report.mjs` bundle-size thresholds + artifact report

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run perf:report
npm run test:e2e
npm run test:e2e:gh-pages
npm run ui:capture
```

Full local gate:

```bash
npm run quality:full
```

## Pre-commit (prek)

Repository hook config: `.pre-commit-config.yaml`

- pre-commit:
  - prettier write on staged files
  - eslint fix on staged TS/JS files
  - strict typecheck
  - unit + property tests
- pre-push:
  - e2e suite
  - perf report with thresholds

CI also runs a GH-pages smoke job that builds with `GITHUB_PAGES=true` and validates map/globe rendering under a repo subpath.

Install hooks:

```bash
npm run hooks:install
```

Run hooks manually:

```bash
npm run hooks:run
npm run hooks:run:push
```

## Perf thresholds

Default thresholds in `scripts/perf_report.mjs`:

- main app bundle: `<= 2,200,000` bytes
- globe chunk: `<= 2,200,000` bytes
- main CSS bundle: `<= 130,000` bytes

Override in CI/local when needed:

```bash
PERF_MAX_MAIN_JS_BYTES=2300000 npm run perf:report
```
