# Hero skill damage display — design

**Date:** 2026-06-21

## Problem

The Skills screen shows each skill as `Power 250`, an opaque internal number. Players
can't tell what a skill actually hits for, and there's no guarantee the shown number
equals the in-battle damage. The request: **the hero skill should show its damage
multiplication information, and it should do the exact damage in-battle.**

## Background — the existing damage path

The in-battle cast (`battleDamage.ts` `castActive`) deals, to every enemy in splash:

```
burst = effAtk × powerMult × max(1, skillPower)
      = atk × (effectivePower / 50) × max(1, skillPower)
```

- `atk` = `resolveHeroBattleStats(save, defaultHeroStats()).stats.atk` (the value the
  sim passes as `h.stats.atk`, **before** in-battle aura buffs).
- `powerMult` = `heroActiveBurst(save).mult` = `skillEffectivePower(basePower, level) / 50`.
- `skillPower` = resolved hero `skillPower` (default 1.5), clamped `max(1, …)`.

So the multiplier the skill applies to the hero's ATK is `effectivePower / 50`, and the
concrete hit is `atk × that × max(1, skillPower)`.

## Design

### 1. Pure helper — `src/core/skillDamage.ts`

One small, tested module that reproduces the sim formula exactly, so display ≡ battle
by construction:

- `skillAtkMult(basePower, skillLevel): number` → `effectivePower / ANCHOR` — the skill's
  intrinsic, level-aware ATK multiplier.
- `heroSkillDamage(save, skillId, base?): { mult, atk, skillPower, burst, damageType }` →
  resolves the hero's live stats and returns the **exact pre-mitigation burst** the cast
  would deal right now: `atk × mult × max(1, skillPower)`.

It reuses `resolveHeroBattleStats`, `skillEffectivePower`, `ACTIVE_POWER_ANCHOR` and
`ACTIVE_SKILLS_MAP` — the exact primitives the sim uses. No new tuning constants.

### 2. UI — `SkillsScene` owned-card footer

Replace the `Power N` line with a damage line that states the multiplication **and** the
exact hit:

```
×{mult} ATK  ·  ≈{burst} {damageType}
```

- `mult = skillAtkMult(def.basePower, entry.level)` shown to 1 decimal (readable summary).
- `burst = round(atk × mult × max(1, skillPower))` — the concrete number, computed from
  the **unrounded** mult so it equals the in-battle burst.
- `atk` / `skillPower` are resolved once per `redraw()` (one pipeline call) and passed
  into `drawCard`, so the per-card cost stays a single cheap multiply.

The damage type already appears in the header; repeating it on the damage line makes the
"X of your ATK as <type>" reading explicit.

### 3. Exactness guarantee

A unit test asserts `heroSkillDamage(save, equippedId).burst` equals
`stats.atk × heroActiveBurst(save).mult × max(1, stats.skillPower)` — i.e. the helper
reproduces the documented `castActive` formula. Because the sim and the UI both go
through these same functions, the screen cannot drift from the battle.

## Scope / non-goals

- No change to the damage formula, balance, save shape, or art (no `ASSET_VERSION` bump).
- In-battle aura/atk-buffs (`buffAtkPct`) are deliberately excluded — the cast itself
  uses unbuffed `h.stats.atk`, so the shown burst matches the cast's own input. The
  number is labelled `≈` because enemy armor/resist still mitigates on impact.
