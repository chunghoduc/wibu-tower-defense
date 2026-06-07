---
name: svg-asset-gen
description: >
  Generate clean, deterministic SVG game assets — especially top-down MAP/TERRAIN
  elements like water ponds, trees/jungle/foliage, rocks & boulders, mountains,
  grass patches, sand, and other obstacles/decor. Authors layered, seeded SVG
  (reproducible variants) and can rasterize to PNG. Use this whenever someone
  asks to create, design, or regenerate terrain art, map tiles, environment
  decorations, obstacles, or any vector/SVG game asset — even if they just say
  "make some trees/water/rocks for the map" without saying "SVG" or "skill".
---

# SVG Asset Generator

Author game art as **code-driven SVG** rather than one-off hand-tweaked path
strings. The win is consistency and reproducibility: a small kit of primitives
(seeded RNG, organic blob paths, shared outline, top-left highlight) makes a set
of assets read as one coherent style, and seeding means regenerating never
churns the repo and every variant is reproducible.

## When to use this

Reach for this skill for terrain/map elements (water, trees, rocks, mountains,
grass, sand, obstacles), environment decor, and other flat vector game art. It is
tuned for **top-down** map pieces but the primitives in `scripts/svgkit.mjs`
generalize to icons, UI marks, and props.

## How the pieces fit together

```
scripts/
  svgkit.mjs       primitives: Rng, blobPath, smoothClosed, shade, circle/ellipse/
                   line/path, contactShadow, svgDoc. Build new art on these.
  terrain.mjs      per-type generators (water/grass/sand/stone/jungle/mountain)
                   + terrainSVG(type, {seed,size}). Register new types here.
  gen-terrain.mjs  CLI: write <type>-<v>.svg variants to a dir (+ optional PNG,
                   + optional JSON manifest).
  rasterize.mjs    optional SVG->PNG via headless Chrome.
references/
  style.md         the visual conventions (palette, light direction, layering,
                   sizing) — read this before adding a new asset type.
```

## Generate terrain assets (the common case)

Run the CLI with Node (no extra deps). Point `--out` at where the consumer
expects the files:

```bash
node .claude/skills/svg-asset-gen/scripts/gen-terrain.mjs \
  --out public/assets/terrain --variants 3 --size 128
```

- Files are named `<type>-<variant>.svg` (e.g. `water-1.svg`, `jungle-2.svg`).
- Add `--types water,jungle,stone` to restrict output.
- Add `--png` only if the consumer can't render SVG itself. **Phaser's
  `load.svg()` rasterizes SVG in-browser, so a Phaser game does not need PNGs.**
- Add `--manifest <file.json>` to also emit an index of the produced files.

Prefer shipping the `.svg`: it scales crisply to any feature size and stays
tiny + diffable. Only bake PNGs when a pipeline genuinely requires raster input.

## Add a new asset type

1. Read `references/style.md` so the new piece matches the kit.
2. Write a `genX(rng)` function in `scripts/terrain.mjs` that returns a body of
   SVG markup, composed from `svgkit` helpers. Keep the silhouette inside
   `r≈56` of centre `(64,64)` in the 128 box so nothing clips and consumers can
   scale predictably.
3. Register it in the `TERRAIN` map. It's now available to `terrainSVG()` and
   the CLI automatically.
4. Regenerate and eyeball the output.

## Composing a single asset programmatically

```js
import { terrainSVG } from "./scripts/terrain.mjs";
const svg = terrainSVG("water", { seed: 2, size: 128 }); // -> "<svg ...>...</svg>"
```

Everything is deterministic: same `(type, seed)` ⇒ identical bytes.

## Quality bar

Good output reads instantly at a glance and small sizes: a clear silhouette, the
shared dark outline tying shapes together, one consistent light direction, and
just enough interior detail (ripples, facets, leaf dots) to feel hand-made
without becoming noisy. If a piece looks like a flat clip-art circle, it's
missing the layered highlight/shadow — see `references/style.md`.
