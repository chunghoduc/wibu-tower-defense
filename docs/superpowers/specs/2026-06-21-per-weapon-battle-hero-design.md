# Per-Weapon Battle Hero — Design Spec (2026-06-21)

## Problem / Intent

The battle hero is currently a procedural-skeleton paper-doll that pastes mismatched
worn-gear SDXL icons onto bones — it reads as an incoherent collage. The user has
decided to abandon worn-gear visuals on the battle hero entirely and instead use
**pre-drawn, per-weapon-type hero art** that swaps based on the equipped weapon.

> "only keep the worn visual for wings, draw different hero arts (moving, attacking,
> hurting) for different weapon types, and apply those arts when hero wear the exact
> weapon"

## Decision

The battle hero becomes a **single textured sprite** whose texture is chosen by the
equipped weapon's `WeaponType`. Wings (and pet) stay as overlays exactly as today.
All other worn gear (helmet/body/pants/gloves/boots) is dropped from the **battle**
hero. The **home/inventory paper-doll is untouched** (separate code path:
`heroDollDress` / `dressHero` / `heroDressLayout`).

### Art (SDXL, kind `herobattle`)

One distinct full-body hero archetype per `WeaponType` (Sword, Bow, Staff, Gun, Tome,
Fist, Any), each in **two poses**:

- `stance` (combat-ready) — used for idle / moving / hurting
- `attack` (the strike money-shot) — swapped in during the attack/cast window

7 types × 2 = **14 PNGs**, cut to 320×320 single-frame. Stance+attack of one weapon
**share a seed** (the proven tower-pipeline trick) so the two poses are the same
character. Files: `assets/sprites/herobattle/<wt>.png` and `<wt>__attack.png`. Manifest
keys `herobattle__<wt>` / `herobattle__<wt>__attack`.

Why 2 poses not 3: a distinct **hurt drawing** is the least-seen state and the hardest
to keep on-model; a procedural flinch + red flash is the standard, better-looking
solution. Moving and attacking each get a genuinely distinct drawing.

### Animation (procedural transform on the static art — matches towers/enemies)

- **moving** → stance art + stride bob/lean
- **attacking** → swap to `attack` pose for the engaged window + forward lunge/recoil
- **hurting** → stance art + knockback flinch + red tint flash
- **cast** → attack pose + upward rise/glow

SDXL cannot make coherent animation frames, so motion is procedural — exactly how
enemies (`enemyWalkTransform`) and towers (`animateTower`) already work.

## Components

### New pure modules (TDD)
- `src/data/heroWeaponArt.ts` — `weaponArtKeys(weaponType | null): { stanceKey, attackKey }`.
  Maps all 7 `WeaponType`s; `null`/unknown → `Any`. Built via `assetKeys` helpers
  `heroBattleTex` / `heroBattleAttackTex`.
- `src/data/heroWeaponMotion.ts` — `heroWeaponMotion(state, phase, size, facing) →
  { dx, dy, scaleX, scaleY, angle, useAttackPose, tint | null, alpha }`. Pure. States:
  idle / walk / attack / hurt / cast.

### assetKeys additions
- `heroBattleTex(wt: string) => "herobattle__<wt>"`
- `heroBattleAttackTex(wt: string) => "herobattle__<wt>__attack"`

### New sprite class
- `src/scenes/HeroWeaponSprite.ts` — drop-in for `HeroSkeletonSprite` (same public API:
  `addToWorld`, `play`, `scaleToHeight`, `tick`, `playAttack/Cast/Hurt`, `syncEquipment`,
  `getBodySprite`, `setDepth/Position/Visible`, `currentAnimKey`, `petSprite`). Container =
  `wingsSprite` (kept identical) + `bodySprite` (the weapon art) + `petSprite`. Keeps the
  one-shot priority state machine; drops bodyGfx / gearSprites / held-weapon sprite.

### Wiring
- `battleSceneSprites.ts`: a typed `HERO_RENDER: "weapon" | "skeleton" | "layered"`
  switch (default `"weapon"`) instantiates `HeroWeaponSprite`. Skeleton/layered kept
  behind the switch as fallbacks (their tests + modules untouched → no churn).
- `heroEquipVisuals.resolveHeroLayers` reused for `weaponType` / wing / pet (gear field
  ignored by the new sprite).

### Art pipeline
- `prompts.mjs`: new `HERO_BATTLE` archetype dict (one full-body description per weapon).
- `sdgen.mjs`: a `herobattle` job loop (per wt: stance via `POSE.idle`, attack via
  `POSE.attack`, shared `seedOf("herobattle-"+wt)`, 768×1024 → cut 320).
- `spriteManifest.ts`: 14 `herobattle` entries (frames 1, 320×320).
- `assetVersion.ts`: bump `2026-06-21a` → `2026-06-21b` (new PNGs).

## Out of scope / unchanged
- Home throne hero + inventory paper-doll (their own pipeline).
- Wings + pet rendering (kept).
- Skeleton/worn modules + their tests (kept as dead-but-tested fallback).

## Verification
- Vitest (new pure-module tests + full suite green), tsc, eslint (max-lines 500), build.
- CDP repro: equip each weapon family, screenshot idle/walk/attack, confirm the art swaps
  per weapon and the attack pose triggers. Deploy live + bump ASSET_VERSION.
