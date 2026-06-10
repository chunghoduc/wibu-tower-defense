# Mana System Redesign

**Date:** 2026-06-10
**Status:** Approved (delegated autonomy — decisions made to best fit the existing structure)

## Goal

Replace the variable-pool mana economy with a simple, hit-driven charge bar.

> "the mana is always 100 (100%), each hit gains 10 (10%) mana. remove mana regen
> stat, mana stat, may have gain mana on hit but this stat is capped at 15."

## New Model

- **Fixed pool.** Every caster's mana lives in `[0, 100]`. There is no per-unit
  max-mana stat — the ceiling is the global constant `MANA_MAX = 100`.
- **Charge on hit.** Each basic-attack hit grants `MANA_PER_HIT = 10` plus the
  unit's `manaOnHit` bonus, which is **clamped to `[0, MANA_ON_HIT_CAP = 15]`**.
  Effective gain per hit is therefore `10 … 25` → a cast every 4–10 hits.
- **Cast & reset.** When `mana >= 100` the unit casts its active and mana resets
  to `0`. (Unchanged cast trigger; only the threshold source changes.)
- **No passive regen.** `manaRegen` is removed — mana only comes from combat.
- **Kill bonus kept.** `manaOnKill` survives as an optional accelerator (kills
  top up mana). It is a distinct, already-authored build lever; the brief only
  capped *on-hit*, so on-kill stays uncapped (kills are far rarer than hits).

### Who casts (replacing the old `maxMana > 0` gate)

The old data signalled "aura-only support, never casts" with `maxMana: 0`. With
max-mana gone, the caster predicate becomes role-based:

- **Hero** — always casts.
- **Tower** — casts iff `role !== "support"`.

This reproduces current behaviour exactly: `towerBaseline` already gave every
non-support tower `maxMana > 0` and supports `0`, so no tower changes caster
status.

## Stat Changes (`Stats` interface)

| Stat | Action | Reason |
|------|--------|--------|
| `maxMana` | **removed** | Pool is a fixed constant now. |
| `manaRegen` | **removed** | No passive regen. |
| `manaCostReduction` | **removed** | Already dead (no runtime reader); meaningless with a fixed full-bar cast. |
| `manaOnHit` | kept, clamped ≤15 at consumption | The one allowed bonus. |
| `manaOnKill` | kept | Optional kill-fuelled accelerator. |

## Touch Points

- **`src/data/schemaStats.ts`** — drop the three keys from `Stats`,
  `defaultStats()`, `FRACTIONAL_STAT_KEYS`.
- **`src/core/battleTypes.ts`** — add `MANA_MAX`, `MANA_PER_HIT`,
  `MANA_ON_HIT_CAP`, and a `manaGainOnHit(stats)` helper.
- **`src/core/battleDamage.ts`** — `performAttack` charges `MANA_PER_HIT +
  clamp(manaOnHit)` on hit (gated `role !== "support"`), `manaOnKill` on kill.
- **`src/core/battle.ts`** (`updateHero`, `upgradeTower`) and
  **`src/core/battleTowers.ts`** (`updateTowers`) — cast at `mana >= MANA_MAX`,
  drop `manaRegen` accrual, drop the max-mana fraction bookkeeping on upgrade
  (mana is now absolute, carries over directly).
- **`src/data/towerStats.ts`** — `towerBaseline` drops `maxMana`/`manaRegen`;
  `manaOnHit` scales `min(15, 7 + 2·tier)`; `augmentTowerStats` keys `manaOnKill`
  off role instead of `maxMana`.
- **`src/core/stats.ts`** — drop `maxMana` from hero per-level growth.
- **`src/data/items.ts`, `jewels.ts`, `passiveGrid.ts`, `stage.ts`** — convert
  removed-stat references to survivors (`manaOnHit` / `manaOnKill` / `skillPower`)
  so caster/mana gear stays meaningful; retheme now-obsolete flavour text.
- **`src/data/itemDisplay.ts`, `src/scenes/passiveGridFormat.ts`** — drop labels
  for removed stats.
- **`src/scenes/battleInfoPanel.ts` + `battleScene{Input,Render}.ts`** — the
  panel/bars keep a `maxMana` field but are fed `MANA_MAX` for casters and `0`
  for non-casters; tower/hero mana bars fill `mana / MANA_MAX`.

## Out of Scope

- **Boss skill mana** (`battleEnemies.ts`, `BOSS_MANA_REGEN`, `skill.manaCost`)
  is a separate time-based system on the boss skill def, not the `Stats` block —
  left untouched.
- Affix magnitude tables are not retuned beyond swapping removed stat names.

## Verification

Typecheck (catches every code-level `.maxMana`/`.manaRegen`/`.manaCostReduction`
access and `Stats` literal) + full test suite + production build + a headless CDP
smoke test confirming a tower charges and casts over 120 frames. Affix strings
are untyped (`string`), so data references are cleaned by hand.
