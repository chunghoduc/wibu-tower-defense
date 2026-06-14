# Skill VFX render beneath enemies/bosses

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

When a hero or tower casts an active skill — and especially when a **boss** casts a
signature set-piece — the cinematic VFX (nova / beam / barrier / quake telegraph,
element bursts, skill emblem) render **on top of** the enemy and boss sprites and
**obscure them**. The player literally cannot see the boss while a skill is going
off, so they can't read what is happening (boss telegraphs, who is taking the hit,
positioning).

User report: *"the skills visual effect need to be under the boss/enemies, now they
cover the enemy and we can't see what's happening."*

## Root cause

The battle render layer uses **scattered, hard-coded `setDepth(N)` literals** with no
registry. The relevant world-space ordering today (back → front):

| depth | object |
|------:|--------|
| −12 / −11 | tilemap ground / road |
| 1 | enemy shadow, terrain obstacles |
| **2** | **enemy / boss sprites** |
| 3 | hero sprite |
| 4 | castle |
| 5 | `dynGfx` (HP/mana bars, aura rings) |
| **6 (+offsets → up to ~12)** | **`FxLayer` — ALL VFX incl. skill casts** |

`FxLayer` is constructed once with base depth `6` and hands that **same** depth to
*every* effect subsystem. So skill-cast VFX sit at depth 6–12, well above the enemy
sprite at depth 2 → they cover it.

## Design

### Scope: only skill-cast VFX move

`FxLayer` owns several subsystems. Two of them are the "skill visual effects" the
user means:

- `SkillVfx` — hero **and** tower active-skill casts (dispatches `skillSignatures`,
  `skillElementFx`, `towerSkillFx`, `skillDelivery`; threads its `depth` into all of
  them).
- `BossSkillFx` — bespoke boss cast set-pieces.

These two render **beneath** the enemy/boss/hero sprites.

The remaining subsystems stay at the existing FX band (on top of units), because
they are small, brief, and are *combat feedback the player needs to read*:
`ProjectileFx`, `MeleeFx`, `ImpactFx` (on-hit element flashes), `LootFlyFx`,
floating **damage numbers**, coin/XP/box pops, death bursts, star-up. The user did
not complain about these and sinking them under enemies would hide damage numbers
and loot. **Non-goal:** moving these.

### New depth band

Introduce `src/scenes/battleDepths.ts` — a single source of truth for battle
world-layer depths, replacing the magic-number `setDepth` literals in the files we
touch. Key new value:

```
SKILL_FX_UNDER = -6      // base depth for SkillVfx + BossSkillFx
SKILL_FX_MAX_OFFSET = 6  // largest depth+K any skill subsystem adds
```

A skill cast therefore occupies roughly depth **−6 … 0**:

- **above** `ROAD (−11)` / `GROUND (−12)` → casts still paint on the battlefield and
  are visible on the ground.
- **strictly below** `ENEMY (2)` and `HERO (3)` → the enemy/boss always renders on
  top of its own skill effect.

Boss ground telegraphs reading *under* the boss who stands on them is the natural,
correct look.

### Ordering invariant (the thing we test)

`battleDepths.ts` must satisfy — and a unit test locks — these pure invariants:

1. `GROUND < ROAD < SKILL_FX_UNDER` (skill VFX visible above the map).
2. `SKILL_FX_UNDER + SKILL_FX_MAX_OFFSET < ENEMY` (the **entire** skill-VFX band is
   below the enemy sprite — the core guarantee against this regression).
3. `ENEMY < HERO` and `ENEMY ≤ FX` (normal combat feedback / damage numbers stay at
   or above the units, i.e. readable).

### Wiring

- `FxLayer` gains a second constructor param `skillDepth` (default
  `DEPTH.SKILL_FX_UNDER`); it passes `skillDepth` to `new SkillVfx(...)` and
  `new BossSkillFx(...)` instead of `this.depth`. Every other subsystem keeps
  `this.depth`.
- `BattleScene` constructs `new FxLayer(this, DEPTH.FX, this.world, DEPTH.SKILL_FX_UNDER)`.
- Replace the world-layer magic numbers we are already editing (ground, road, enemy,
  hero, castle, fx base) with the `DEPTH` constants so the ordering is legible in one
  place.

## Non-goals

- No change to gameplay, sim, odds, saves, or any generated art → **no
  `ASSET_VERSION` bump**.
- Not renumbering UI/panel depths (40–70) or the `dynGfx`/HUD overlay layers — they
  are unrelated to this bug.
- Not moving projectiles / melee / impacts / loot / damage numbers.

## Testing

- **Unit (TDD):** `tests/battleDepths.test.ts` asserts the three ordering invariants
  above (RED before `battleDepths.ts` exists).
- **Full suite + tsc + build + lint:cycles** green.
- **CDP playtest:** start a battle, force a tower/hero cast and a boss cast on an
  enemy, and assert the skill-VFX game objects' `.depth` values are all `< 2` (below
  the enemy sprite) while damage-number / projectile objects remain `≥ 2`.

## Risks

- *A skill subsystem uses a larger `depth + K` than assumed (could poke above the
  enemy).* Mitigation: `SKILL_FX_MAX_OFFSET = 6` is set to the largest observed
  offset across `SkillVfx`/`SkillElementFx`/signatures/`BossSkillFx`; the invariant
  test fails loudly if the band ever crosses `ENEMY`.
- *Casts looking dim under the translucent enemy shadow (depth 1).* Acceptable — the
  shadow is faint and the cast is still clearly visible; sprites must win the overlap
  by design.
