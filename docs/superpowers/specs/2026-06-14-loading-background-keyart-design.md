# Loading-Screen Key-Art Background (towers + bosses, SDXL anime)

**Date:** 2026-06-14
**Status:** Approved (full-auto self-review)

## Problem

The loading screen currently shows the DOM splash (`#loading-splash` in
`index.html`) — an opaque `#0d0f14` panel with a gold title + progress bar — on
top of the Phaser canvas for the entire load. (The procedural Phaser
`loadingBackdropFx` is drawn underneath the canvas and is therefore visually
hidden by the opaque DOM splash during loading; see
`project_loading_backdrop`.) So the player's first impression is a flat dark
rectangle.

The owner wants a "super cool" loading background **generated from the towers'
and bosses' looks**, in **anime style**, via the **SDXL flow** — a piece of
cinematic key art that sells the game's roster the moment it opens.

## Goals

1. Generate ONE cinematic, anime, full-frame loading background (`loading.png`)
   whose composition is **derived from the existing tower + boss visual
   metadata** (`scripts/sdart/prompts.mjs` `TOWER_VISUAL` / `BOSS_VISUAL`) — a
   heroic ensemble of champions rallying against a looming boss.
2. Show it **instantly** as the loading-screen backdrop (before Phaser boots),
   with the existing title + progress bar staying legible on top.
3. Keep everything reproducible, cache-safe, and within the repo's conventions
   (SDXL-only art, `versioned()` cache-busting, `<500`-line files, TDD on the
   pure pieces).

## Non-goals

- No change to the procedural `loadingBackdropFx` (left as the harmless
  beneath-canvas fallback — not deleted, not "improved" to load textures).
- No new in-game (battle/menu) backgrounds. This is the loading splash only.
- No animation of the key art (a static painted poster is the deliverable).

## Approach

### A. Art generation (SDXL, scene composition from metadata)

A new generator `scripts/sdart/genLoadingBackground.mjs`, modeled on the
existing `genBackgrounds.mjs` (full-scene, no white cutout, render 1024×576 →
downscale to the 960×540 canvas, multiples-of-32 rule, seed sweep into
candidates). It builds its prompt from the **actual** `TOWER_VISUAL` /
`BOSS_VISUAL` descriptor strings so the background literally reflects the
roster's looks.

The prompt assembly is a **pure function** in `scripts/sdart/loadingPrompt.mjs`:

- `essence(descriptor)` — condense one character descriptor to its silhouette
  essence (first ~2 comma clauses) so a multi-character scene prompt doesn't
  overload the model and blur into a blob.
- `buildLoadingPrompt({ heroes, boss })` — weave a curated, visually-diverse
  **trio of foreground tower champions** + **one colossal looming boss** into a
  battlefield key-art composition with an anime/painterly wrapper, returning
  `{ prompt, negative }`. The negative bans the isolated-on-white character
  framing (this is a SCENE, not a sprite) plus the usual UI/text/watermark set.

Curated cast (chosen for silhouette + colour + role spread, so the poster reads
clearly; selected by id from the metadata maps, essences pulled from them):
- `karu-sunfist` — bright orange-gi martial artist, golden ki (melee, warm).
- `megu-explosion-sage` — crimson explosion mage, staff raised (caster, red).
- `aya-dawnshot` — red-haired archer drawing a bow (ranged, motion).
- Boss: `ashghost` — the stage-30 apex, twin flaming chained blades (epic,
  fiery silhouette towering behind the trio).

Composition intent: low dramatic hero angle, three champions shoulder-to-
shoulder in the lower foreground facing the viewer, the giant fiery boss
silhouette rising in the smoky background, dusk battlefield, volumetric
god-rays, embers, rim light — epic anime game splash / key art, painterly.

Output: `public/assets/bg/loading.png` (best candidate copied over, like
`menu-hall.png`). The generator writes seed candidates
`loading-cand-<seed>.png` for review; the winner is copied to `loading.png`.

### B. Wiring (instant display on the DOM splash)

The DOM splash is the genuinely-visible loading surface, so the art goes there.

- `src/core/loadingSplash.ts` (pure, Phaser-free, tested):
  `loadingSplashBackground(url)` returns the CSS `background` shorthand string
  that layers a **dark readability gradient over the image** (so the gold title
  + bar never wash out), e.g.
  `linear-gradient(rgba(5,7,12,.55), rgba(5,7,12,.78)), url("<url>") center/cover no-repeat`.
- `src/main.ts` sets `#loading-splash`'s `style.background` to
  `loadingSplashBackground(versioned("assets/bg/loading.png"))` at the very top
  of boot (before `new Phaser.Game`), so the painted backdrop appears the
  instant the module runs — versioned for cache-busting, single source of truth
  with the rest of the asset pipeline.

Cache-bust: bump `ASSET_VERSION` (new art). The `versioned()` query stamps the
splash URL so a returning player refetches.

## Data flow

```
prompts.mjs TOWER_VISUAL/BOSS_VISUAL
      │  (ids: karu-sunfist, megu-explosion-sage, aya-dawnshot, ashghost)
      ▼
loadingPrompt.buildLoadingPrompt({heroes,boss})  ── pure, unit-tested
      ▼  { prompt, negative }
genLoadingBackground.mjs → Z-Image API (127.0.0.1:8765) → 1024×576 PNG
      ▼  PIL downscale → public/assets/bg/loading.png
loadingSplashBackground(versioned("assets/bg/loading.png"))  ── pure, unit-tested
      ▼
main.ts → #loading-splash style.background  → visible before Phaser boots
```

## Testing

- `tests/loadingPrompt.test.ts` — `essence()` trims to the first clauses;
  `buildLoadingPrompt()` weaves in each hero essence + the boss + scene-framing
  keywords (battlefield/anime/key art) and a negative that bans
  "isolated/white background". Pure, no API call.
- `tests/loadingSplash.test.ts` — `loadingSplashBackground(url)` embeds the url,
  a `url(...)` layer, `center/cover`, and a leading dark gradient; passes the
  versioned url through verbatim.
- Full suite + tsc + eslint + `npm run build` stay green.
- Art is eyeballed from the seed candidates; best copied to `loading.png`.

## Risks / mitigations

- **Multi-character SDXL blur** → condense each descriptor to its essence, cap
  the cast at a trio + one boss, lean on a clear foreground/background depth
  split in the framing. Seed sweep + manual pick covers variance.
- **DOM splash covers the Phaser backdrop** → that is already true today; we are
  putting the art where it is actually seen rather than fighting it. Procedural
  backdrop stays as the under-canvas fallback.
- **Stale cached splash on regen** → `versioned()` + `ASSET_VERSION` bump.

## Files

- NEW `scripts/sdart/loadingPrompt.mjs` (pure prompt assembly)
- NEW `scripts/sdart/genLoadingBackground.mjs` (API generator)
- NEW `src/core/loadingSplash.ts` (pure CSS background helper)
- NEW `tests/loadingPrompt.test.ts`, `tests/loadingSplash.test.ts`
- NEW `public/assets/bg/loading.png` (generated art)
- EDIT `src/main.ts` (apply splash background at boot)
- EDIT `src/data/assetVersion.ts` (bump)
```
