# Tower Aura Range Indicator — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session)
**Type:** Presentation-only feature (battle VFX / UI)

## Problem

Several towers buff *other* nearby towers through an "aura" (e.g. Mira's ATK aura,
Lyra Tempo's attack-speed aura, Sakura's combined aura). The mechanic is real and
impactful, but it is **completely invisible**: nothing on screen shows how far an
aura reaches or which towers it covers. Players cannot position towers to benefit
from a support aura because they cannot see it.

The user request: *"add an aura indicator (glowing and indicate the true range of
that aura) for all towers with aura passive or aura buff with other towers."*

## Background — how auras actually work

- **Data:** `CharacterDef.behavior.buffAura?: { radius: number; atkPct?: number; attackSpeedPct?: number }`
  (`src/data/schema.ts`). `radius` is in world units and is **independent of the
  tower's own attack range**.
- **Application:** `BattleState.recomputeTowerBuffs()` (`src/core/battleTowers.ts`)
  runs every tick. It applies an aura only when the source tower is
  `alive`, **not disabled** (`disabledTimer <= 0`), **`role === "support"`**, and has
  a `buffAura`. Towers within `dist(s.pos, t.pos) <= aura.radius` receive the buff
  (the source never buffs itself).
- **True (effective) radius:** in-battle upgrades scale the aura. `towerUpgrade.ts`
  grows `buffAura.radius` by +8% per battle level, mutating the runtime `behavior`.
  Therefore **`tower.behavior.buffAura.radius` is already the true, current radius** —
  the indicator must read this value, not the static catalog value, so it stays
  truthful as the tower is upgraded mid-battle.

This means the *source of truth* for "is there an aura and how big is it" is exactly
the same gate the simulation uses. The indicator mirrors that gate so the ring can
never lie about coverage.

## Goals

1. Draw a glowing, always-on ring at the **true** aura radius for every tower that
   currently provides a tower-buff aura.
2. The ring "glows" (gentle pulse) so it reads as an active magical aura, not a
   static UI circle, and is visually distinct from the gold attack/upgrade rings.
3. The ring honestly reflects sim state: a disabled tower's aura is inactive, so its
   ring dims.
4. Zero gameplay change, zero data change, zero new art assets.

## Non-Goals (YAGNI)

- No connector lines / highlights drawn on the buffed towers inside the aura. The
  ring already shows which towers fall inside; connectors add clutter and code.
- No per-aura-type color split (ATK vs attack-speed vs both) — a single supportive
  color. The kind is already legible from the tower itself / its info panel.
- No rings for **enemy** negative auras (Hexer `supportAura`). The request is towers
  with a buff aura; enemy debuff auras are a separate concern.
- No toggle / settings option. Always on (it is subtle by design).
- No change to attack-range rendering (still upgrade-hover only).

## Design

### Two units

**1. Pure helper — `src/core/auraIndicator.ts` (Phaser-free, unit-tested)**

```ts
import type { TowerRuntime } from "./battleTypes.ts";

/** Aura-indicator ring color — aquamarine, distinct from the gold attack/upgrade rings. */
export const AURA_RING_COLOR = 0x66ffcc;

/**
 * The true, current tower-buff aura radius for a tower, or null if it provides none.
 * Mirrors the gate in recomputeTowerBuffs(): support role + a positive-radius buffAura.
 * Reads behavior.buffAura.radius, which already includes in-battle upgrade scaling.
 */
export function auraRadiusOf(t: TowerRuntime): number | null {
  if (t.def.role !== "support") return null;
  const a = t.behavior?.buffAura;
  if (!a || a.radius <= 0) return null;
  return a.radius;
}

/** Gentle 0..1 pulse for the glow, de-synced per tower via uid so rings don't blink in unison. */
export function auraPulse(timeMs: number, uid: number): number {
  return 0.5 + 0.5 * Math.sin(timeMs * 0.004 + uid);
}
```

Rationale for the gate living here: it mirrors `recomputeTowerBuffs` exactly, so the
visual and the simulation can never disagree about *which* towers have an active
aura. `alive` and `disabledTimer` are left to the render layer (they affect *how* the
ring is drawn — skip / dim — not *whether the def has an aura*).

**2. Render method — `drawAuraRing(g, t)` in `src/scenes/battleSceneRender.ts`**

```ts
drawAuraRing(g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
  if (!t.alive) return;
  const radius = auraRadiusOf(t);
  if (radius == null) return;
  const disabled = t.disabledTimer > 0;          // aura inactive while disabled
  const pulse = auraPulse(this.time.now, t.uid);
  const fillA = (disabled ? 0.015 : 0.04) + pulse * (disabled ? 0.01 : 0.03);
  const ringA = (disabled ? 0.1 : 0.28) + pulse * (disabled ? 0.05 : 0.2);
  g.fillStyle(AURA_RING_COLOR, fillA).fillCircle(t.pos.x, t.pos.y, radius);
  g.lineStyle(1.5, AURA_RING_COLOR, ringA).strokeCircle(t.pos.x, t.pos.y, radius);
  // faint inner ring adds a soft "glow" edge band
  g.lineStyle(1, AURA_RING_COLOR, ringA * 0.5).strokeCircle(t.pos.x, t.pos.y, radius - 4);
}
```

### Draw order

In `draw()` (`battleSceneRender.ts`), add a **pre-pass** that draws every tower's
aura ring *before* the existing per-tower body loop, so rings sit under towers and
enemies and never occlude them:

```ts
for (const t of bs.towers) this.drawAuraRing(g, t);   // under everything
for (const t of bs.towers) this.drawTower(g, t);      // existing
```

(Using the same `dynGfx` graphics object already used by `drawTower`.)

## Data flow

```
recomputeTowerBuffs() mutates tower.behavior.buffAura.radius (upgrade scaling)
        │  (same runtime object)
        ▼
draw() pre-pass ── drawAuraRing(g, t) ── auraRadiusOf(t) → radius (true)
                                       └─ auraPulse(now, uid) → glow alpha
        ▼
   aquamarine pulsing ring + fill at the true radius, dimmed if disabled
```

## Error / edge handling

- Tower with no `buffAura`, or non-support role, or `radius <= 0` → no ring
  (`auraRadiusOf` returns null).
- Dead tower → skipped (`!t.alive`).
- Disabled tower (`disabledTimer > 0`) → ring drawn but heavily dimmed (aura inactive).
- Upgraded mid-battle → radius grows automatically because we read the live
  `behavior.buffAura.radius`.
- Many support towers on screen → rings are low-alpha and additive; overlap reads as
  a brighter band, which is acceptable and even informative.

## Testing strategy (TDD)

Pure helper is fully unit-testable (no Phaser). `tests/auraIndicator.test.ts`:

1. `auraRadiusOf` returns the radius for a support tower with a positive-radius `buffAura`.
2. `auraRadiusOf` returns `null` for: non-support role (even with a buffAura), missing
   `buffAura`, and `radius <= 0`.
3. `auraRadiusOf` returns the **upgraded** radius when `behavior.buffAura.radius` has
   been scaled (i.e. it reads the live runtime value, not a catalog constant).
4. `auraPulse` stays within `[0, 1]` across a sweep of times, and two different uids
   yield different values at the same time (de-sync).
5. Data-integrity guard: every `CharacterDef` in `TOWERS` that defines a `buffAura`
   has `role === "support"` (otherwise its aura would silently never apply *and* never
   show a ring — this catches authoring mistakes).

The render method is thin glue over the tested helper and Phaser draw calls; per
project convention (compile-time-checked Phaser layer) it needs no runtime test.

## Files

- **New:** `src/core/auraIndicator.ts` (~25 lines)
- **New:** `tests/auraIndicator.test.ts`
- **Modified:** `src/scenes/battleSceneRender.ts` — import helpers, add `drawAuraRing`,
  add the pre-pass loop in `draw()` (stays well under 500 lines).

## Risks

- **Visual clutter** if many auras overlap. Mitigated by low alpha + the pulse; can be
  tuned by adjusting the alpha constants without structural change.
- **Color collision** with gold rings. Mitigated by choosing aquamarine, far from gold.
- **Truthfulness drift** if the sim gate changes. Mitigated by the data-integrity test
  and by `auraRadiusOf` mirroring the exact sim gate (support + buffAura).
