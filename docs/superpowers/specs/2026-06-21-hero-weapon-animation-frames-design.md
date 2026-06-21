# Per-weapon battle-hero animation frames

## Problem

The in-battle hero (`HeroWeaponSprite`, `HERO_RENDER='weapon'`) currently has only
**two** pre-drawn poses per weapon archetype — a combat stance and an attack
money-shot (`herobattle__<wt>` / `herobattle__<wt>__attack`). All movement is
procedural (`heroWeaponMotion`): bob, lunge, flinch, rise. The user wants **real
art frames** for every animation state so the hero genuinely animates rather than
sliding two static images around.

Requested per weapon archetype:

- **idle** — ≥1 frame
- **walk** — ≥4 frames
- **attack** — ≥4 frames
- **hurt** — ≥2 frames
- **cast** — ≥4 frames

## Constraint that shapes the design

The local Z-Image-Turbo API is **text-to-image only** — no img2img, no ControlNet,
no inpainting. Perfect frame-to-frame registration is therefore impossible. The
best achievable coherence is: **share one seed across all frames of an archetype**
(the *same* seed its existing key-visual already uses, `seedOf("herobattle-<wt>")`)
and vary **only a pose phrase** in the prompt, keeping the character descriptor
identical. This yields a hand-keyed "limited animation / anime keyframe" look —
distinct, characterful poses rather than morphing in-betweens. That is the accepted
visual target.

## Frame plan (per archetype)

| State  | Frames | Source |
|--------|--------|--------|
| idle   | 1      | **reuse** existing `herobattle__<wt>` stance (no regen) |
| walk   | 4      | new `heroanim__<wt>__walk_0..3` |
| attack | 4      | new `heroanim__<wt>__attack_0..3` |
| hurt   | 2      | new `heroanim__<wt>__hurt_0..1` |
| cast   | 4      | new `heroanim__<wt>__cast_0..3` |

7 archetypes (sword, bow, staff, gun, tome, fist, any) × 14 new frames = **98 new
PNGs**. Each 320 px, generated 768×1024 full-body, cut to a transparent square —
identical pipeline to the existing `herobattle` kind. New SDXL `kind: "heroanim"`.

Pose phrases describe limb configuration ONLY (wind-up / apex / follow-through for
strikes; a 4-beat run cycle for walk; recoil/stagger for hurt; gather/channel/
release/recoil for cast). The character/outfit/weapon come unchanged from the
existing `HERO_BATTLE[wt]` descriptor, so the animated set stays on-model with the
key visual.

## Components

- **`assetKeys.ts`** — `heroAnimTex(wt, state, i)` → `heroanim__<wt>__<state>_<i>`
  (single source for the key; `heroanim` is outside the discipline-guard list, like
  `herowing`).
- **`heroWeaponFrames.ts`** (NEW, pure, TDD) — `FRAME_COUNTS` per state +
  `heroWeaponFrame(state, phase, counts?)` → frame index. Looping states (idle,
  walk) wrap `floor(phase·n) % n`; one-shots (attack, hurt, cast) clamp
  `min(n-1, floor(phase·n))`. Phaser-free.
- **`HeroWeaponSprite.ts`** — gains an **anim mode**: when the equipped archetype's
  frames are loaded, `tick()` drives the body texture from
  `heroAnimTex(wt, state, heroWeaponFrame(...))` each frame (idle → the legacy
  stance key; others → the new frames), only calling `setTexture` on change. The
  existing `heroWeaponMotion` juice (dx/dy/angle/squash/tint) stays ON TOP for
  weight. Archetypes without frames fall back to the legacy stance/attack swap.
- **`prompts.mjs` / `sdgen.mjs`** — `HERO_ANIM_POSES` pose table + a generator loop
  emitting the 98 jobs (kind `heroanim`, shared per-archetype seed, `HERO_BATTLE`
  descriptors, `heroBattleStyle`, `HERO_BATTLE_NEGATIVE`).
- **`spriteManifest.ts`** — 98 `heroanim` entries (320×320, frames 1).
- **`assetVersion.ts`** — bump `2026-06-21d` → `2026-06-21e`.

## Testing / verification

- Unit: `heroWeaponFrames.test.ts` — index per state across phase∈[0,1), loop vs
  clamp, boundaries (phase 0, 0.99, 1).
- tsc clean · full vitest suite · eslint clean on changed files · all files <500
  lines · `vite build`.
- CDP `repro_hero_anim.mjs`: per archetype, drive each state through several phases,
  screenshot, montage to eyeball that frames differ and stay on-model.

## Out of scope

Home/inventory paper-doll (`HeroLayeredSprite`/`HeroSkeletonSprite`) — untouched.
Wings/pet overlays — untouched. No save migration (art-only).
