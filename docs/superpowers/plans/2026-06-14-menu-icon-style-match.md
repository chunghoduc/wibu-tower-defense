# Implementation Plan — Menu Icon Style Match

Spec: `docs/superpowers/specs/2026-06-14-menu-icon-style-match-design.md`

Regenerate `forge.png`, `quests.png`, `activities.png` in the painterly gold-trim
object/medallion style of the other 9 home-screen icons. Art-only change + one
`ASSET_VERSION` bump. No code/layout/rendering edits.

## Tooling

- **Generator:** local Z-Image-Turbo HTTP API at `http://127.0.0.1:8765/generate`
  (POST JSON → PNG bytes; `steps:9`, `width/height:1024`, pass a `seed` for repro). The
  repo's sole art generator.
- **Cutout:** `scripts/sdart/cutout.py IN.png OUT.png --size 128` — rembg salient
  segmentation → trim to bbox → resize. This is what produced the existing menu icons, so
  reusing it keeps the same alpha/cut treatment.
- **Verify montage:** small Python/PIL script paste-grid of all 12 PNGs.

## Shared prompt recipe

Style preamble (same for all three, so they share the family look):

> `painterly mobile game UI icon, glossy hand-painted fantasy gacha art, ornate gold
> metal filigree accents, deep jewel-tone palette, soft rim light and inner shadow,
> single centered object, plain dark neutral background, highly detailed, sharp focus`

Per-icon subject appended:

- **forge:** `a sturdy dark steel anvil with a crossed gold-handled blacksmith hammer,
  a few small warm orange ember sparks rising, steel-blue and gold body` — ember is the
  ONLY warm accent (avoid the all-orange-tile failure mode).
- **quests:** `a partly unrolled aged golden parchment quest scroll with ornate gold
  end-caps, a red wax seal, and a small green check mark`
- **activities:** `a circular gold rope-framed medallion badge, deep teal enamel center
  with a bright glowing gold star, a small banner ribbon across the lower frame`

Because this is a CFG-0 distilled model the negative prompt is a near no-op, so exclusions
are baked positively ("single centered object, plain dark neutral background"). The dark
neutral field is what `cutout.py` strips to transparent.

## Steps

1. **Generate candidates.** For each icon, POST the combined prompt at 1024×1024 with 2–3
   different seeds → raw PNGs in repo root (`forge_raw_*.png`, etc.).
2. **Cut out + downscale.** Run `cutout.py raw.png cut.png --size 128` on each candidate.
3. **Pick + montage-check.** Build a montage of each cut candidate beside the 9 reference
   icons; choose the candidate that best harmonizes (transparent corners, no squircle plate,
   matching palette/gold). Iterate prompt/seed if none match.
4. **Install.** Copy the three chosen 128×128 PNGs over
   `public/assets/ui/menu/{forge,quests,activities}.png`. Confirm `identify` reports 128×128.
5. **Bump cache token.** `ASSET_VERSION` in `src/data/assetVersion.ts` → new token
   (`2026-06-14b`).
6. **Clean up** all scratch `*_raw*.png` / `*_cut*.png` from repo root so the working tree
   only contains the three updated assets + version bump.
7. **Verify.** Final 4×3 montage of all 12 installed icons (acceptance test — three must
   match the nine); `npm run build` succeeds; `npx vitest run` green; lint clean.
8. **Commit.** `feat(ui): restyle forge/quest/activity menu icons to match dock family`.

## Acceptance

- The three regenerated icons are painterly objects/medallion on transparent background,
  no flat colored squircle, matching the other nine in palette and gold ornamentation
  (judged from the final montage).
- All three PNGs exactly 128×128.
- Build + tests + lint green; `ASSET_VERSION` bumped; working tree clean apart from the
  3 PNGs, `assetVersion.ts`, spec, and this plan.

## Risks / mitigations

- *Model still emits a square tile.* → prompt says "single centered object… plain dark
  neutral background"; if a render still has a backing plate, cutout's rembg keeps only the
  salient object, dropping the plate; re-seed if needed.
- *Activities medallion vs object mismatch.* → activities deliberately uses the medallion
  sub-style (like summon/battle) since a bare calendar object reads weakly; star+ring badge
  matches the dock better.
