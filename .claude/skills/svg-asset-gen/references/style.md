# Visual conventions for the terrain kit

Read this before adding a new asset type so it matches the existing pieces. The
goal is a small set that reads as one coherent, hand-made game kit — not a pile
of unrelated clip-art.

## Canvas & sizing

- 128×128 viewBox, body centred at **(64, 64)**.
- Keep the silhouette within mean radius **R ≈ 50**, and never let anything go
  past **r ≈ 56** of centre — the consumer scales the image to a map feature's
  radius, and overhang/shadow needs a little padding so it isn't clipped.
- Contact shadows sit slightly **below** centre (`cy ≈ 64 + R*0.55`) to fake a
  top-down-ish ground plane.

## Light & layering

One consistent light, coming from the **top-left**. Every solid object is built
in the same order, which is what unifies the set:

1. **Contact shadow** — a low-opacity dark ellipse under blocking objects
   (`contactShadow`). Skip it for flat decor (grass/sand) so they read as ground.
2. **Base silhouette** — an organic `blobPath` filled with the type's `base`
   colour and stroked with the shared `OUTLINE` (`#16131f`). The dark outline is
   the single most important unifying element; don't drop it on solid objects.
3. **Highlight** — a smaller blob offset up-left, filled with the `lite` tone at
   ~0.5 opacity. This is the top-down light catching the crown of the form.
4. **Detail** — type-specific: ripples (water), facets + cracks (stone), leaf
   dots (jungle), snow cap (mountain), blade tufts (grass), dune arcs (sand).
   Enough to feel made-by-hand; stop before it gets noisy at small sizes.

## Palette

Each type has `{ base, deep, lite, ... }` in `terrain.mjs`. Tones echo the game's
in-engine terrain colours so the art drops in on-brand. Derive shades with
`shade(hex, f)` rather than hand-picking, so a palette tweak propagates.

## Organic shapes

Use `blobPath(cx, cy, r, lobes, jitter, rng)` for silhouettes — polygons read as
"geometric/UI", blobs read as "nature". Typical: `lobes` 7–11, `jitter` 0.2–0.34
(rocks tighter/harder, foliage looser/softer). For clusters (rocks, foliage),
scatter several sub-blobs and draw them back-to-front by `y` so nearer pieces
overlap farther ones.

## Determinism

Seed every `Rng` from the type name + variant index (see `terrainSVG`). When a
generator needs several independent random streams, fork with
`new Rng(rng.int(1, 1e6))` rather than reusing one stream across unrelated
features — that keeps each sub-shape's variation stable and legible.
