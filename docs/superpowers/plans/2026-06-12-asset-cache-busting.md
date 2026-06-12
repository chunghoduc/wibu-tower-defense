# Plan — Asset cache busting (fix stale-PNG sprite breakage)

Spec: docs/superpowers/specs/2026-06-12-asset-cache-busting-design.md

## Task 1 — Pure version helper (TDD)
- RED: `tests/assetVersion.test.ts`
  - `versioned(path)` appends `?v=<ASSET_VERSION>` to a plain path.
  - preserves an existing query with `&v=` instead of `?v=`.
  - leaves absolute `data:`/`http(s):` URLs untouched (defensive).
  - `ASSET_VERSION` is a non-empty string with no whitespace/`?`/`&`.
- GREEN: `src/data/assetVersion.ts` exporting `ASSET_VERSION` + `versioned()`.

## Task 2 — Wire PreloadScene
- Route every generated-asset URL in `PreloadScene.preload()` through
  `versioned(...)` (spritesheets, images, svg). Texture KEYS stay unchanged.
- No behavior change in dev (query ignored by the static server) and tests.

## Task 3 — Hosting cache policy + guard test
- `firebase.json`: split the single media-glob header into
  - `js|css|woff2` → `public, max-age=31536000, immutable` (content-hashed).
  - `png|jpg|jpeg|gif|svg|webp|mp3|ogg|wav` → `public, max-age=3600, must-revalidate`.
- RED/GREEN guard: `tests/firebaseCachePolicy.test.ts` parses `firebase.json`
  and asserts no `immutable` directive is attached to any glob that matches a
  stable-named media extension.

## Task 4 — Verify + deploy
- `tsc --noEmit`, full `vitest run`, `vite build`.
- Deploy: `npm run build` + `npx firebase-tools deploy --only hosting`.
- Re-curl a live sprite: confirm `cache-control` no longer says `immutable` and
  that a `?v=` request returns the asset.
- Update memory (`project_asset_cache_busting`).
