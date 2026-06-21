# Unique Triggered Powers — design

**Date:** 2026-06-21
**Status:** approved (delegated-autonomy; recorded and proceeding)
**Relates to:** `project_unique_powers`, `project_item_archetypes`, `project_tower_stat_rebalance`

## Problem

Every Unique item already carries a named **Unique Power** (`data/uniquePowers.ts`), but
all 11 powers are *passive stat buckets* (`flat` / `increased` / `more`) folded into the
hero stat pipeline. A Unique therefore still just "adds numbers" — it never *does* anything.
We want signature **behaviours**: on-hit chance to instantly kill, reflect damage when struck,
blast an AoE on kill, chain-lightning, freeze, corpse-detonate, counter-attack, etc. — assigned
to thematically suitable items, not another stat line.

## What the sim already gives us (hooks)

| Hook | File | Fires when | Trigger event |
|---|---|---|---|
| `performAttack` | `core/battleDamage.ts` | every hero **and** tower basic attack (knows crit + whether the hit killed) | `onHit`, `onCrit`, `onKill` |
| `killEnemy` | `core/battleDamage.ts` | centralized enemy death (already does `deathNova` AoE — template for corpse blast) | `onKill` |
| `dealDamageToHero` | `core/battleEnemies.ts` | an enemy's hit lands on the hero | `onHurt` |
| hero/tower cast site | `core/battleHero.ts` / `battleTowers.ts` → `castActive` | active skill fires | `onCast` |

`onKill` is detectable in two places: `performAttack` already computes `wasAlive && !target.alive`,
and `killEnemy` is the single death funnel (catches DoT/splash kills too). We fire **kill triggers
from `killEnemy`** so every cause of death procs them once, guarded against recursion.

## Design

### 1. Data — `data/triggeredEffects.ts` (new, pure)

```ts
export type TriggerEvent = "onHit" | "onCrit" | "onKill" | "onHurt" | "onCast";

export type TriggerKind =
  | "execute"     // instakill a non-boss (chance) | guaranteed below hpFrac (cull)
  | "blast"       // splash AoE: amount = atkFrac×atk  (or hpFrac×victim.maxHp on kill)
  | "chain"       // lightning to N nearest foes, falloff
  | "freeze"      // stun for `seconds`
  | "poison"      // DoT scaling with the attacker's atk
  | "heal"        // hero heals hpFrac of own maxHp (kill) or dmgFrac of damage dealt (hit)
  | "gold"        // burst bonus gold on kill
  | "contagion"   // copy the victim's DoTs onto nearby foes
  | "reflect"     // onHurt: deal frac×incoming back to the attacker
  | "riposte"     // onHurt: hero counter-attacks the attacker for atk
  | "echo"        // onCast: cast a second time
  | "cinder";     // onCast: leave a burning field (DoT pulses in radius)

export interface TriggeredEffect {
  event: TriggerEvent;
  chance: number;        // 0..1 ; 1 = guaranteed (skips the RNG roll, like applyStun)
  kind: TriggerKind;
  hpFrac?: number;       // execute threshold / heal fraction / blast-from-maxHp fraction
  atkFrac?: number;      // damage as a fraction of source atk
  dmgFrac?: number;      // fraction of damage dealt / taken
  radius?: number;       // blast / cinder / contagion radius
  targets?: number;      // chain bounce count
  falloff?: number;      // chain falloff
  seconds?: number;      // freeze / poison / cinder duration
  bossImmune?: boolean;  // execute never affects bosses (default true)
  describe(): string;    // player-facing line, magnitudes embedded
}
```

`UniquePowerDef` (in `data/uniquePowers.ts`) gains an optional field:

```ts
export interface UniquePowerDef {
  id: string;
  name: string;
  describe(ctx): string;
  contribution(ctx): UniquePowerContribution;   // may be empty {} for pure-trigger powers
  trigger?: TriggeredEffect;                     // NEW — the behaviour
}
```

A power may carry a stat **and/or** a trigger. Signature items get both; procedural uniques draw
one power (stat or trigger) from their archetype pool.

### 2. Resolution — `core/battleTriggers.ts` (new, pure-ish)

`resolveBattleTriggers(save): BattleTriggers` walks every equipped Unique, reads
`uniquePowerFor(def)?.trigger`, and buckets them by event:

```ts
interface BattleTriggers {
  onHit: TriggeredEffect[]; onCrit: TriggeredEffect[]; onKill: TriggeredEffect[];
  onHurt: TriggeredEffect[]; onCast: TriggeredEffect[];
}
```

Built **once** in the `BattleState` constructor (stored as `this.triggers`). Hot loops just check
`this.triggers.<event>.length` before iterating — near-zero cost when no uniques are equipped.

### 3. Sim handlers — `core/battleTriggerFx.ts` (new, merged onto BattleState prototype)

One handler per event, each iterating its array, rolling `this.rng.chance(e.chance)` (skipped when
`chance >= 1`), and dispatching by `kind` onto existing primitives:

- `fireOnHit(unit, fromPos, target, dealt, didCrit, internal)` — called at the end of `performAttack`.
- `fireOnKill(victim, killerStats)` — called inside `killEnemy`.
- `fireOnHurt(attacker, incoming)` — called inside `dealDamageToHero`.
- `fireOnCast(stats, center, from, source, uid)` — called at the cast site.

Dispatch table (kind → primitive):

| kind | implementation |
|---|---|
| execute | non-boss → `killEnemy(target)` directly (or `applyDamage` True = `maxHp`) |
| blast | `applySplash(stats, type, amount, center, primary, radius)` |
| chain | self-contained nearest-N loop reusing `applyDamage` (parameterized on stats+type) |
| freeze | `applyStun(target, seconds, 1)` |
| poison | `addDot(target, type, dps=atk×frac, seconds, stats)` |
| heal | `hero.hp = min(maxHp, hp + …)` |
| gold | `this.gold += round(reward×frac)`; emit a `loot` fx |
| contagion | copy `victim.dots` onto enemies within radius |
| reflect | `applyDamage(attacker, "True"|phys, frac×incoming, …)` |
| riposte | `performAttack(hero, …, attacker, …)` once |
| echo | re-invoke `castActive` with an `internal` guard |
| cinder | spawn a short-lived ground DoT field (reuse splash visual + per-tick `addDot`) |

**Recursion guard:** triggered damage passes `internal = true` so blasts/chains/reflects/echoes
**do not** re-proc `onHit`/`onKill`/`onCast`. Only the original basic attack / kill / cast procs.

### 4. Scope & balance decisions

- **Attack triggers fire from every player attack — towers *and* hero.** The uniques are equipped on
  the hero, but the gear empowers the whole army (mirrors the existing 60% hero→tower stat share). In a
  TD the towers are most of the DPS; hero-only triggers would feel dead. `performAttack` is the shared
  funnel, so this is the natural seam.
- **`onHurt` fires on the hero only** in v1 (the durable unit you reposition; keeps proc rate sane).
  Tower thorns is a noted future extension.
- **Chances are conservative.** With many fast towers a 3% proc still fires often; thresholds
  (`cull` below 8% HP) self-limit. A game-designer tuning pass follows implementation.
- **Bosses:** `execute` is `bossImmune` by default; blasts/freezes/poison still apply.

### 5. The catalog

**On hit** — Executioner (3% instakill non-boss), Cull (guaranteed execute < 8% HP),
Stormcaller (15% chain to 3), Permafrost (12% freeze 0.6s), Venomstrike (25% poison),
Soulrend (15% heal off damage dealt).
**On crit** — Shatterblow (crit → splash blast).
**On kill** — Detonate (corpse AoE off victim maxHp), Bloodfeast (heal % maxHp),
Goldfinger (chance bonus gold), Contagion (spread victim's DoTs).
**On hurt** — Thornmail (reflect % to attacker), Riposte (chance counter-attack).
**On cast** — Echo (chance recast), Cinderbloom (burning field).

### 6. Assignment

- **Signatures (layer a trigger onto the existing stat power):**
  - `dawnbreaker` (Sword) → Executioner (+ keeps Sunflare stat)
  - `aegis-of-dawn` (BodyArmor) → Thornmail (+ keeps Bulwark stat)
  - `midas-paw` (Pet) → Goldfinger (+ keeps Midas stat)
- **Procedural archetype pools** (extend `ARCHETYPE_POWERS`; `uniquePowerFor` already picks by FNV
  id-hash so coverage is automatic):
  - physical → execute / chain / venom / detonate
  - magic → cinder / echo / freeze / chain
  - defense → thorns / riposte / bloodfeast
  - utility → gold / cull / contagion
  - hybrid → shatter / detonate

### 7. Display

Extend `data/itemDisplay.ts` `uniquePowerLine` and `scenes/itemTooltip.ts` to render the trigger as a
second gold/cyan row, e.g. `⚡ On hit (15%): chains lightning to 3 nearby foes`, using
`trigger.describe()`. Shared by Inventory + Shop (compare dialog already delegates).

## Non-goals / out of scope

- No formula/balance overhaul of base stats; trigger numbers are starting points.
- No new art, **no ASSET_VERSION bump** (pure mechanics + procedural UI text).
- **Zero save migration** — powers/triggers are derived from the item def, so every owned copy
  gains its trigger automatically (same property the current Unique Powers rely on).
- Conditional passives (e.g. "+more damage under 30% HP", momentum stacks) are a *separate* concept
  from event triggers and are deferred — they need mid-battle conditional evaluation, not a proc.
- `onHurt` from towers, and per-tower trigger scoping, deferred.

## Testing (TDD)

- `tests/triggeredEffects.test.ts` — catalog integrity: every kind has a `describe()`; signature
  + archetype assignment is deterministic; `uniquePowerFor` returns the expected trigger.
- `tests/battleTriggers.test.ts` — `resolveBattleTriggers` buckets equipped uniques correctly;
  empty when none equipped.
- `tests/battleTriggerFx.test.ts` — in a seeded world: a guaranteed-execute unique kills a low-HP
  non-boss but never a boss; Thornmail reflects damage to the attacker when the hero is hit; Detonate
  damages a bystander on kill; recursion guard — a blast kill does not re-detonate infinitely.

## Verification

`npx tsc --noEmit` · `npx vitest run` (full suite) · eslint touched files (all < 500 lines) ·
`npm run build` · CDP playtest (equip a trigger unique, observe a proc in battle) ·
commit + push + deploy. No ASSET_VERSION bump.
