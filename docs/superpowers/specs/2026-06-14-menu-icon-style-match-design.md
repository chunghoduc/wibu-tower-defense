# Menu Icon Style Match — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto self-approval)

## Problem

The home-screen navigation dock (`MainMenuScene`) shows 11 SDXL-painted icons. Nine of
them — **battle, summon, collection, inventory, squad, passive, shop, skills** — share one
coherent art language: a **painterly, glossy "gacha" object or gold-framed circular
medallion floating on a transparent background**, jewel-tone palette (blues/teals/golds),
ornate gold filigree accents, soft inner shadow. No flat backing plate.

Three icons — **forge, quests, activities** — were regenerated on 2026-06-14 (commit
`bf0b6f5`) in a *different* style: **flat, saturated rounded-square "app-tile" squircles**
with solid colored backgrounds (orange / tan / turquoise). On the dock they read as
mobile OS app icons dropped into a fantasy game, visually clashing with the other nine.
The user reports: "forge, activities, quest icons do not match with other icon in the
home screen."

This is purely an **art-asset** problem. The rendering path is identical for all icons
(`MainMenuScene.iconButton` → `this.add.image(menuTex(id))`, scaled to 44px). No code,
layout, or rendering logic is wrong — only the three PNGs are off-style.

## Goal

Regenerate `forge.png`, `quests.png`, `activities.png` so they belong to the same visual
family as the other nine icons: painterly object/medallion on a **transparent** field, no
flat colored squircle plate, matching palette and gold ornamentation.

## Reference style (the 9 that already match)

- **Object icons** (free-floating, no frame): shop = blue+gold coin pouch spilling coins;
  inventory = banded wooden treasure chest; collection = ornate open book with gold corners.
- **Medallion icons** (circular gold-ringed badge): battle = blue shield + crossed swords
  in a gold rope frame; summon = gold ring around a swirling blue magic vortex; squad =
  blue heraldic shield with gold trim; passive = gold-edged node constellation.

Common DNA: glossy hand-painted rendering, warm gold metal accents, cool jewel-tone core,
soft rim light, **alpha-transparent background**, centered, fills ~80% of the 128×128 frame.

## Design decisions

Each new icon adopts the matching sub-style and keeps its existing subject so players still
recognize the destination:

| Icon | Sub-style | Subject |
|------|-----------|---------|
| **forge** | object (like chest/pouch) | a sturdy dark-steel anvil with a crossed gold-handled smith's hammer and a few warm orange ember sparks; gold trim. Steel-blue + gold body, ember as the only warm accent — NOT an all-orange tile. |
| **quests** | object (like the book) | a partly-unrolled aged-gold parchment scroll with gold end-caps, a red wax seal, and a small green check mark; floating, no backing plate. |
| **activities** | medallion (like summon/battle) | a circular gold-rope-framed badge whose center is a deep teal field with a bright gold star; small banner ribbon across the lower frame. |

These three keep their **same texture keys** (`menu__forge`, `menu__quests`,
`menu__activities`) and same files in `public/assets/ui/menu/`, so nothing downstream
changes.

## Pipeline (SDXL / Z-Image-Turbo only — repo's sole art generator)

1. Prompt the local Z-Image-Turbo HTTP API with a shared **style preamble** (painterly
   game UI icon, glossy, ornate gold accents, jewel tones, centered, plain background) plus
   the per-icon subject, and a **negative** that explicitly forbids the failure mode:
   `flat app icon, rounded square tile, solid color background square, squircle, sticker,
   UI button, frame border box, photo, text`.
2. Generate several candidates per icon, pick the best match to the reference family.
3. Post-process: flood-fill / chroma the plain background to **transparent**, trim, resize
   to exactly **128×128** (the established menu-icon size — same as the current files).
4. Drop into `public/assets/ui/menu/{forge,quests,activities}.png`.
5. **Bump `ASSET_VERSION`** in `src/data/assetVersion.ts` (art regen + redeploy → returning
   players must refetch the cached `immutable` PNGs).

## Verification (the "test")

Visual regression is the acceptance test:

1. Build a 4×3 montage of all 12 menu PNGs at native size. The three regenerated icons
   must visually harmonize with the nine references — no flat squircle backing, transparent
   corners, matching palette/ornamentation. Save to `/tmp` and eyeball it.
2. `npm run build` succeeds (asset path unchanged; sanity only).
3. No code changes beyond `ASSET_VERSION`, so no new unit tests are warranted; the existing
   suite must still pass (`npx vitest run` green) and lint clean.

## Out of scope

- Achievements (no PNG; uses procedural glyph fallback) and Settings (glyph by choice) are
  unrelated and untouched.
- No rendering, layout, or `iconButton` changes.
- No new texture keys, no manifest edits.
