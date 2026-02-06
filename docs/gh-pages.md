# GitHub Pages Rendering Notes

## Why this page exists

Project-site hosting runs under a repository subpath (`/<repo>/`), not root (`/`).
If assets or chunks are loaded from absolute root paths, 2D/3D rendering can fail even when the app shell loads.

## Build mode for pages

Use the GH-pages build env:

```bash
GITHUB_PAGES=true GITHUB_PAGES_REPO=deadline npm run build
```

`vite.config.ts` uses these env vars to set:

- `base` for JS/CSS chunks
- PWA `start_url` and `scope`

Deploy workflow already uses this mode.

## Asset URL rule (important)

Never hardcode absolute public paths like `/data/...` or `/textures/...`.

Use:

- `assetUrl('data/world-110m.topo.json')`
- `assetUrl('textures/earth-dark.jpg')`

`assetUrl` resolves through `import.meta.env.BASE_URL`, which keeps local and GH Pages paths consistent.

## Runtime sanity check

In debug mode (`?debug=1`), the app probes key assets:

- `data/world-110m.topo.json`
- `textures/earth-dark.jpg`
- `data/landmarks_core.json`

If any fetch fails, a red `assets broken: ...` banner is shown.

## CI smoke gate

Run GH-pages smoke tests locally:

```bash
GH_PAGES_REPO=deadline GH_PAGES_PORT=4176 npm run test:e2e:gh-pages
```

The smoke suite validates:

1. 2D canvas has non-empty pixels.
2. 3D globe canvas has a WebGL context.
3. No page errors during startup.

## Common failure signatures

- `GET .../assets/<chunk>.js 404`
  - base path mismatch; verify GH build env and deploy artifact.
- Map visible shell but no land/lines
  - broken `world-110m.topo.json` path.
- Globe frame but black/no texture
  - broken `earth-dark.jpg` path.
- Service worker serving stale files
  - hard refresh + unregister SW when debugging (`Application -> Service Workers`).
