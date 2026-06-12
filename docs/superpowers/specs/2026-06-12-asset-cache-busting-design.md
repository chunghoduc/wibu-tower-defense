# Design — Fix broken sprite animation after art updates (asset cache busting)

## Symptom (reported)
"Fix enemies animation — the game is showing all enemy frames at the same time."

## Investigation (evidence)
- The current build renders **every** tower / enemy / boss / hero as a single
  frame in every scene. Proven at runtime:
  - `texture.firstFrame === "0"` for sliced spritesheets, so `add.image(key)`
    and `add.sprite(key)` (no frame arg) show frame `0`, never the full `__BASE`
    strip.
  - Observed `displayWidth === frameWidth × scale` for towers (128), bosses
    (256/160) and enemies (300) — never the full strip width.
  - Headless screenshots of a live wave show single, coherent creatures.
- The deployed PNG dimensions match the bundled manifest's frame layout for a
  **fresh** visitor (verified via `curl` against the live host) — so a clean
  cache renders correctly. The bug therefore cannot reproduce on first visit.

## Root cause
`firebase.json` sends `Cache-Control: public, max-age=31536000, immutable` for
**all** `*.png|jpg|…|mp3|…` assets. But the generated sprite/bg/audio assets are
served under **stable filenames** (`assets/sprites/tower/seren-skyfall.png`),
while the JS bundle (which embeds `spriteManifest.ts`) is **content-hashed**
(`index-<hash>.js`, served behind a `no-cache` `index.html`).

Consequence: when art is regenerated and redeployed under the same filename, a
**returning** player loads the *new* manifest (fresh JS) but their browser keeps
the *old* PNG forever (`immutable`). If the old cached PNG's frame layout differs
from the new manifest's `frameWidth`/`frames` (exactly what happened today: 7
towers went 1–3 frames → an 8-frame sheet), Phaser slices the stale image against
the new geometry and the animation renders wrong/garbled. Fresh caches are fine;
returning caches are poisoned — which is why it never reproduced in a clean run.

## Decision
Make generated-asset URLs **change when their content changes**, and stop marking
stable-named media as `immutable`:

1. **Version-stamp generated-asset URLs.** A single `ASSET_VERSION` string is
   appended as `?v=<version>` to every runtime-loaded generated asset
   (sprites, bg, ui, fx, materials, item/skill/jewel icons, role icons, castle,
   hero-doll, terrain svg). Bumping `ASSET_VERSION` on a deploy that regenerates
   art changes every URL, so even an already-poisoned `immutable` cache is
   bypassed (different URL = different cache key). This is the one-time bust that
   repairs caches in the wild *now*.
2. **Correct the hosting cache policy.** Keep `immutable, 1yr` only for the
   genuinely content-hashed build output (`js|css|woff2`). Serve stable-named
   media (`png|jpg|jpeg|gif|svg|webp|mp3|ogg|wav`) with
   `max-age=3600, must-revalidate` so the strong `ETag` already present drives
   cheap revalidation (304 when unchanged, fresh bytes when changed) — no future
   skew without needing a version bump every time.

Both layers together fix poisoned caches today (via `?v=`) and prevent the class
of bug going forward (via revalidation).

## Non-goals
- No change to sprite slicing, the manifest schema, or the art pipeline.
- Per-asset content hashes (heavier) are deferred; a single global version plus
  ETag revalidation is sufficient and far simpler.

## Verification
- Pure unit tests for the URL helper and the version constant shape.
- A guard test asserting `firebase.json` never sends `immutable` for the
  stable-named media globs (prevents regression).
- `tsc --noEmit` + full `vitest` + `vite build`, then redeploy.
