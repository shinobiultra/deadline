# Versioning

## Policy

- semantic versioning (`MAJOR.MINOR.PATCH`)
- current line: `0.x` (fast iteration, minor can include breaking changes)
- tag each release commit (`v0.2.0`, etc.)

## Current release

- `v0.2.0`
- focus: UX workflow clarity, detail zoom reliability, strict quality gates, Apache-2.0 licensing, hook automation

## Release checklist

1. `npm run quality:full`
2. update `CHANGELOG.md`
3. bump `package.json` version
4. commit: `release: vX.Y.Z`
5. tag: `git tag vX.Y.Z`
6. push branch + tag
7. verify GitHub Pages deployment workflow
