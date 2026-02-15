# Versioning

## Policy

- semantic versioning (`MAJOR.MINOR.PATCH`)
- current line: `0.x` (fast iteration, minor can include breaking changes)
- tag each release commit (`v0.4.1`, etc.)

## Current release

- `v0.4.1`
- focus: analytics instrumentation (prod+DNT aware), edge-safe HUD/collision fixes, multi-viewport overlap tests, GH-pages smoke stability hardening

## Release checklist

1. `npm run quality:full`
2. update `CHANGELOG.md`
3. bump `package.json` version
4. commit: `release: vX.Y.Z`
5. tag: `git tag vX.Y.Z`
6. push branch + tag
7. verify GitHub Pages deployment workflow
