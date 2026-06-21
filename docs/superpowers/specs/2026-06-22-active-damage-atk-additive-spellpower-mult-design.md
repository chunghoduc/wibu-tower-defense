# Active-skill damage rework — ATK additive, spell power multiplicative & type-gated

Date: 2026-06-22 · Branch: wip/sprite-art-restyle

## Problem

Hero & tower **active-skill** burst is computed identically for every damage type:

```
burst = atk × powerMult × max(1, skillPower)
```

ATK is the multiplicative core and `skillPower` multiplies on top of *everything*,
regardless of whether the skill is Physical, Magic, or True. Damage type only
matters post-mitigation (armor / MR / none). So there is no build identity: a
Physical bruiser and a Magic caster scale exactly the same way, and the
`skillPower` ("spell power") stat buffs Physical skills it has no business buffing.

## Goal (the rework, verbatim intent)

- Damage from **ATK** is **additive**: `damage = base + atkCoef × atk`.
- Damage from **spell power** is **multiplicative**, and **gated**: Physical skill
  damage **cannot** be multiplied by spell power — only **Magic** and **True**
  damage use it.
- **Physical** skills are **more powerful with ATK**.
- **Magic** skills are **more powerful with spell power**.
- True is the **hybrid** (scales with both, neither maxed).

## The formula

One pure function, `activeBurst()`, shared by the sim and every display so they
cannot drift:

```
additive = powerMult × BASE_FLAT  +  powerMult × atkCoef(type) × atk
burst    = additive × spellPowerMult(type, skillPower)  +  defBonus
```

- `powerMult` (= `P`) is the skill's level-scaled intensity (`effectivePower / 50`);
  towers (no levellable skills) use the legacy `P = 2`. Unchanged from today.
- `BASE_FLAT = 18` — a small flat floor per unit of `P` so a 0-ATK cast still does
  *something* (the "base damage"); negligible vs a built hero's ATK term.
- `defBonus` — the tanker `defenseScale` conversion (armor/MR/maxHP → damage),
  added **flat after** the spell multiplier exactly as before (it is a defensive
  payoff, not a spell).

### Type coefficients

| Type     | `atkCoef` (ATK term) | `spellGain` (spell-power slope) |
| -------- | -------------------- | ------------------------------- |
| Physical | **1.0** (lives on ATK) | **0** → `spellPowerMult ≡ 1` (locked out) |
| True     | 0.8 (hybrid)         | 0.75 (hybrid)                   |
| Magic    | 0.6 (leans on SP)    | **1.5** (lives on spell power)  |

```
spellPowerMult(type, sp) = 1 + (max(1, sp) − 1) × spellGain(type)
```

So `skillPower` is always ≥1, and a cast can never be *reduced* by it. Physical is
always ×1. An un-invested hero (skillPower = 1) gets ×1 on every type.

## Balance anchors (TTK preserved-ish)

Fresh hero, `atk = 300`, `P = 1.7` (basePower 85, lvl 0):

| Case                         | Old (`atk·P·sp`) | New                                   |
| ---------------------------- | ---------------- | ------------------------------------- |
| Physical, sp 1               | 510              | `1.7×(18+1.0·300)×1` = **541** (+6%)  |
| Magic, sp 1 (un-invested)    | 510              | `1.7×(18+0.6·300)×1` = **337** (−34%) |
| Magic, sp 1.5 (light gear)   | 765              | `1.7×198×(1+0.5·1.5)` = **589**       |
| Magic, sp 2.0                | 1020             | `1.7×198×2.0` = **673**, sp 3 → **1010** |
| True, sp 1                   | 510              | `1.7×(18+0.8·300)` = **438** (−14%)   |
| True, sp 1.5                 | 765              | `1.7×258×1.375` = **603**             |

Intent: Physical is ~unchanged and ATK-dominant. Magic is intentionally *weaker
until you build spell power* — that is the new build dynamic (Autonomy /
Competence: investing in the right stat is the power lever), not a flat nerf.
True sits between. `skillPower` is a common Magic-archetype affix, so a magic build
reaches parity quickly and then outscales via the multiplier.

## Surfaces touched

- **NEW** `src/core/activeDamage.ts` — pure: `ACTIVE_ATK_COEF`, `ACTIVE_SPELL_GAIN`,
  `ACTIVE_BASE_FLAT`, `spellPowerMult`, `activeBurst`. Imports only the
  `DamageType` type (no cycles).
- `src/core/battleDamage.ts` `castActive` — sim uses `activeBurst` (hero + tower).
- `src/core/skillDamage.ts` `heroSkillDamage` / `SkillDamageInfo` — display uses
  `activeBurst`; exposes `atkCoef` + `spellMult`.
- `src/data/skillDescribe.ts` — tower & hero burst lines reworded (atk term + spell
  multiplier, with "spell power N/A" on Physical).
- `src/scenes/SkillsScene.ts` — burst via `activeBurst`; label shows effective ATK
  coefficient + a `×SP` note only for Magic/True.
- `src/data/itemDisplay.ts` — `skillPower` affix line notes it amplifies Magic/True.
- Tests: NEW `tests/activeDamage.test.ts`; update `skillDamage`, `skill-describe`.

No save migration, no art, **no ASSET_VERSION bump** (pure data/sim/text).
