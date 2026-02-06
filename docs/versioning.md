# Versioning

## Policy

- semantic versioning (`MAJOR.MINOR.PATCH`)
- current line: `0.x` (fast iteration, minor can include breaking changes)
- tag each release commit (`v0.2.1`, etc.)

## Current release

- `v0.2.1`
- focus: wide-layout UX, reliable manual 3D rotation behavior, and deployment doc/runbook updates

## Release checklist

1. `npm run quality:full`
2. update `CHANGELOG.md`
3. bump `package.json` version
4. commit: `release: vX.Y.Z`
5. tag: `git tag vX.Y.Z`
6. push branch + tag
7. verify GitHub Pages deployment workflow
