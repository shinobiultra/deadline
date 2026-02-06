# Versioning

## Policy

- semantic versioning (`MAJOR.MINOR.PATCH`)
- current line: `0.x` (fast iteration, minor can include breaking changes)
- tag each release commit (`v0.3.1`, etc.)

## Current release

- `v0.3.1`
- focus: deterministic demo/screenshot pipeline, clearer deadline workflow UX, and robust detail-map interactions under slow/failed tile loads

## Release checklist

1. `npm run quality:full`
2. update `CHANGELOG.md`
3. bump `package.json` version
4. commit: `release: vX.Y.Z`
5. tag: `git tag vX.Y.Z`
6. push branch + tag
7. verify GitHub Pages deployment workflow
