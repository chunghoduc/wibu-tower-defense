# Character Attack Poses — Design Spec

**Date:** 2026-06-20
**Status:** Approved (full-auto self-approval)
**Branch:** `wip/sprite-art-restyle`

## Problem

A prior WIP art pass committed **56 orphaned, unwired sprite PNGs**:

- **52 tower combat-stance poses** — `public/assets/sprites/tower/<id>__attack.png`, one per
  collectible character (`akagan-ashen__attack.png` … `zoran-thricedraw__attack.png`).
- **4 hero weapon-class poses** — `public/assets/sprites/hero/hero__{bow,fist,gun,staff}.png`.

All are **single-frame 320×320 full-body combat stances** on transparent backgrounds — dramatic
"money-shot" art. None is referenced anywhere in `src/`; they are committed but dead. The
`__attack` naming reveals authorial intent: *show this pose when the character fights.*

The existing in-battle sprites are **192px-tall multi-frame animated spritesheets**
(tower `1536×192` = 8 frames, hero `3648×192` = 19 frames). The new poses are a different scale
and have no animation frames, so they are **not** drop-in animation replacements.

## Goal

Wire all 56 poses into the game so they render, **without regressing** the existing animated
sprite / gear-compositing systems. Pure decision logic is TDD-tested; rendering is a thin,
`textures.exists()`-gated presenter swap that falls back to current behavior when art is absent.

## Design

### 1. Tower combat-stance swap (primary, 52 assets)

Towers attack ≈1×/second, so a per-swing pose *flash* would be visually overwhelming. Instead the
pose is a **combat-stance state**: a tower shows its dramatic `__attack` pose **while engaged**, and
reverts to its breathing idle sprite a beat after the fight lulls.

- **Engaged window.** The attack FX event seam (`battleSceneSprites.playFx`, `ev.type === "attack"`,
  `ev.source !== "hero"`) already fires once per tower swing. It stamps
  `engagedUntil = now + ENGAGED_MS` on the tower sprite. A tower is "engaged" while
  `engagedUntil > now`. `ENGAGED_MS ≈ 1100` (> the ~1s attack cadence) so sustained fighting holds
  the pose steadily; it relaxes to idle ~1.1s after the last enemy dies.
- **State-driven texture swap.** In `manageSprites`, the desired texture key for each tower is:
  `engaged && exists(towerAttackTex(id)) ? towerAttackTex(id) : towerTex(id)`. When the desired key
  differs from the sprite's current key, `setTexture` to it, set the matching origin, and (for the
  animated base only) replay the idle anim. The swap happens **once per state transition**, not per
  frame and not per swing.
- **Scale auto-fit.** Tower display height is recomputed every frame as `50/s.height` in
  `animateTower`. A 320px pose therefore auto-refits to the 50px battlefield slot. Because the pose
  occupies a smaller fraction of its 320 canvas than the idle body fills its 192 canvas, a tuned
  `POSE_FILL_BOOST` (~1.18) multiplies the engaged scale so the posed body visually matches the idle
  body height. The pose origin sits slightly lower (feet near frame bottom) than the idle origin.
- **Procedural recoil rides along.** The existing strike-recoil punch (`animateTower`) still applies
  to the posed sprite, so each swing lunges the dramatic stance forward — free polish.
- **Gating.** Only the 52 towers with `__attack` art ever swap; every other tower (and all
  headless/no-art runs) keeps today's exact behavior.

### 2. Hero weapon-class pose on the home throne (secondary, 4 assets)

The battle hero is a **gear-composited `HeroLayeredSprite`** (real equipped items layered on). The
4 hero poses are baked full-armor stances that ignore equipped gear, so they must **not** replace the
battle hero or the inventory paper-doll — that would regress gear compositing.

The **home throne-room hero** (`MainMenuScene.drawHero`) is, by contrast, a single **bare**
`hero__hero` sprite (gear is shown on wall hangers, not on the hero). That is the right home: swap
the standing throne hero to the **class pose for the equipped weapon's family**.

- `heroPoseFamily(weaponType)` maps the equipped weapon's `WeaponType` →
  `"bow" | "fist" | "gun" | "staff" | null`. Only those four families have art; `Sword`, `Tome`,
  `Any`, and "no weapon equipped" → `null`.
- In `drawHero`: resolve the equipped weapon type from the save, compute the family, and if a pose
  family resolves **and** `exists(heroPoseTex(family))`, render that static pose as the throne hero;
  otherwise render today's animated `hero__hero` idle. A grand static stance reads *better* than a
  tiny idle loop for a decorative diorama centerpiece.

## Components

| Unit | Kind | Responsibility | Tested |
|------|------|----------------|--------|
| `assetKeys.ts` (+2 fns) | pure | `towerAttackTex(id) → tower__${id}__attack`, `heroPoseTex(family) → hero__${family}` — the sole key builders | via existing discipline test |
| `attackPose.ts` | pure | `ENGAGED_MS`, `POSE_FILL_BOOST`, `POSE_ORIGIN_Y`, `IDLE_ORIGIN_Y`; `isEngaged(engagedUntil, now)`; `towerDisplayScale(frameH, level, posed)` | **new unit test (TDD)** |
| `heroPose.ts` | pure | `heroPoseFamily(weaponType)` → family or null | **new unit test (TDD)** |
| `spriteManifest.ts` | data | +4 hero + 52 tower single-frame (`frames:1`) entries so PreloadScene loads them | manifest shape test |
| `battleSceneSprites.ts` | presenter | stamp `engagedUntil` in `playFx`; state-driven texture swap + posed scale in `manageSprites`/`animateTower` | n/a (thin, gated) |
| `MainMenuScene.ts` | presenter | `drawHero` weapon-class pose swap | n/a (thin, gated) |

No new texture keys are built outside `assetKeys.ts` (preserves the asset-key discipline test). The
56 manifest entries are appended with a one-shot generator script (single-frame, no `.json` sidecar).

## Data flow

```
attack FX event ─▶ playFx() stamps engagedUntil on tower sprite
                            │
manageSprites() each frame ─┤ desiredKey = isEngaged() && exists(attackKey) ? attackKey : baseKey
                            │ if changed → setTexture + origin + (idle replay for base)
animateTower() ────────────┘ scale = towerDisplayScale(s.height, level, posed)  (POSE_FILL_BOOST when posed)

home enter ─▶ drawHero() ─▶ family = heroPoseFamily(equippedWeaponType)
                            key = family && exists(heroPoseTex(family)) ? heroPoseTex(family) : "hero__hero"
```

## Error handling / edge cases

- **No art** (any non-restyled tower, Sword/Tome hero, headless run): `textures.exists()` gate →
  current behavior, never a `__MISSING` box.
- **State thrash**: texture swap is guarded by `s.texture.key !== desiredKey`, so no per-frame churn.
- **Sprite culling**: engaged state lives in sprite data; culled+recreated sprites simply start idle
  and re-engage on the next attack event — no leak.
- **Scene re-entry** (Phaser instance reuse): `drawHero` reads fresh save state each `create()`.

## Out of scope (YAGNI)

- No in-battle hero pose swap (gear compositing must stay).
- No attack-pose animation (poses are intentionally single-frame).
- No new art generation — all 56 PNGs already exist on disk.
- No change to sim, balance, or save schema.

## Verification & deploy

- `npx tsc --noEmit`, full `vitest` suite, `npm run lint`, `npm run build`.
- CDP self-playtest: confirm a tower visibly shifts to its pose during a fight and relaxes after;
  confirm the home hero shows a weapon-class pose when a bow/fist/gun/staff weapon is equipped.
- **Bump `ASSET_VERSION`** before deploy: the restyled achievement medallions were changed in place
  and committed but never deployed with a bump, and new sprites ship now too. Then
  `npm run build` + `npx firebase-tools deploy --only hosting`, push the branch.
