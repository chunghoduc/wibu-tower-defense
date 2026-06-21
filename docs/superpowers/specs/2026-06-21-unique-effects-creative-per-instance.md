# Creative + Per-Instance Random Unique Effects

Date: 2026-06-21
Branch: wip/sprite-art-restyle
Status: approved (delegated full-autonomy session — self-approved, recorded for the record)

## Problem

Unique items already gained triggered combat behaviours (commits e85f33a..83ebc76:
on-hit execute, chain, freeze, on-kill detonate/heal, on-hurt reflect/riposte,
on-cast echo/cinder). Two gaps remain:

1. **The catalog is small and conservative.** Deep-research (RoR2 proc
   coefficients, PoE Headhunter, Last Epoch Last Laugh / Humming Bee /
   Exsanguinous, design theory on build-enabling procs) shows the satisfying
   space is much larger: threshold executes with **overkill leech**, on-kill
   **frost-nova / ignite fields**, retaliation that **freezes the attacker**, and
   crit **deep-wound bleeds**. We want more creative, build-flavoured effects.

2. **Every copy of a Unique is identical.** A trigger is derived purely from the
   `ItemDef`, so two Dawnbreakers always proc the exact same thing. The request:
   *"1 unique item may have different random unique effect or affix suitable for
   them."* Each rolled instance should pick its own behaviour (and its own stat
   power for procedural uniques) from a pool **suitable for that item**.

## Research-backed design principles (applied)

- **Build-enabling, not flat stats** — every trigger converts a combat EVENT into
  a steerable payoff (execute, leech, nova, bleed), not a passive number.
- **Proc coefficient** — fast attackers must not trivialise on-hit procs. We add a
  per-attacker coefficient that scales on-hit/on-crit trigger *chance* by attack
  speed (slow hit = full chance, capped-fast tower ≈ ⅓ chance). This is the single
  highest-confidence finding in the research and the game literally has a 5 atk/s
  cap plus fast chain towers.
- **Steerable, not pure-random** — a unique's pool is fixed by the item; the
  player chooses which uniques to equip, so the behaviour set is build-driven even
  though the specific roll is per-copy.
- **Juice** — every new effect emits an existing FX event so the trigger reads.

## Architecture

Two orthogonal halves, both seeded by the rolled instance's stable `id` (zero
save migration — the field already exists on every owned item):

```
Unique item instance
├─ PASSIVE POWER  (the "affix" — stat buckets)   data/uniquePowers.ts
│    signatures: fixed (identity)
│    procedural: rolled per-INSTANCE from an archetype stat pool
└─ TRIGGER        (the behaviour — on-event proc) data/triggeredEffects.ts
     ALL uniques: rolled per-INSTANCE from a def-suitable trigger pool
                  (signatures get a curated pool incl. their thematic proc)
```

### Modules

- **`data/triggeredEffects.ts`** (expand) — add new `TriggerKind`s, all reusing
  existing sim primitives so no new live-buff system is needed:
  - `slow` (onHit) — chance to massively slow ("time dilation"); `applySlow`.
  - `bleed` (onCrit) — crit applies a heavy DoT; `addDot`.
  - `overkill` (onKill) — heal the hero by a fraction of OVERKILL damage. Overkill
    is free: after death `victim.hp` is negative, so overkill = `-victim.hp`.
  - `frostnova` (onKill) — freeze enemies in a radius; `forEnemiesInRadius`+`applyStun`.
  - `pyre` (onKill) — ignite enemies in a radius; `forEnemiesInRadius`+`addDot`.
  - `glaciate` (onHurt) — freeze the attacker that struck the hero; `applyStun`.
  - `painnova` (onHurt) — blast enemies around the hero when struck; `applyBurstInRadius`.
  - `castnova` (onCast) — freeze enemies in the cast radius; `forEnemiesInRadius`+`applyStun`.

  Existing effects (execute, cull, chain, freeze, poison, heal, blast, detonate,
  bloodfeast, gold, contagion, reflect, riposte, echo, cinder) are retained.

- **`data/uniqueTriggers.ts`** (new, pure) — the suitability pools + roller:
  - `TRIGGER_POOLS: Record<ItemArchetype, TriggerKey[]>` — which triggers suit
    each build (physical → execute/bleed/overkill/slow…, magic → chain/pyre/
    castnova…, defense → glaciate/painnova/reflect/riposte…, utility → gold/
    frostnova/poison…, hybrid → a wide mix).
  - `SIGNATURE_TRIGGER_POOLS: Record<itemId, TriggerKey[]>` — curated per signature
    so e.g. Dawnbreaker still leans execute/bleed and Aegis still leans
    reflect/glaciate, but each copy varies within the theme.
  - `rollTrigger(def, instanceId): TriggeredEffect | null` — FNV-hash the
    `instanceId` to pick within the def's pool. `null` for non-Unique.

- **`data/uniquePowers.ts`** (modify) — remove the `trigger?` field from
  `UniquePowerDef` (triggers now live in their own roll). Powers are pure stat
  "affixes" again. `uniquePowerFor(def, instanceId?)` rolls the procedural power
  per-instance (hash `instanceId` when present, else `def.id` for a stable
  default); signatures stay fixed. Restore/round out the archetype stat pools so
  every archetype has ≥2 stat powers.

- **`data/procCoefficient.ts`** (new, pure) — `procCoefficient(attackSpeed)`
  returns a 0.34..1 multiplier (REF 1.5 atk/s → 1.0; 5 atk/s cap → ~0.30 clamped
  to 0.34 floor). Only on-hit/on-crit chance is scaled by it.

- **`core/uniquePowerStats.ts`** (modify) — add `equippedUniqueInstances(save)`
  returning `{ def, instanceId }[]`; `buildUniquePowerStats` passes `instanceId`
  into `uniquePowerFor` so per-instance procedural powers resolve.

- **`core/battleTriggers.ts`** (modify) — `resolveBattleTriggers` iterates equipped
  unique INSTANCES and calls `rollTrigger(def, instanceId)`, bucketing by event.

- **`core/battleTriggerFx.ts`** (modify, split if >500 lines) — new `case`s for
  the new kinds; `fireOnHit` scales chance by `procCoefficient(unit.stats.attackSpeed)`.
  If the file would exceed 500 lines, extract the kind handlers into
  `battleTriggerKinds.ts`.

- **Display** — `uniqueTriggerLine(def, instanceId)`; `itemTooltip.ts` passes
  `inst.id` so the tooltip shows that copy's actual rolled behaviour.

## Determinism / migration

- Per-instance rolls hash the existing stable `instance.id`. No new save field, no
  version bump, **zero migration** — every owned copy deterministically gains a
  (possibly new) behaviour + power.
- `chance >= 1` still skips the RNG (deterministic effects don't perturb the loot
  stream); the proc coefficient only scales `chance < 1` effects.
- Recursion is still bounded by the single `_triggerDepth` guard.
- No art change → **no ASSET_VERSION bump** (pure mechanics + UI text).

## Testing (TDD)

- `triggeredEffects.test.ts` — catalog integrity for the new kinds.
- `uniqueTriggers.test.ts` — pools non-empty & reference real effects; `rollTrigger`
  deterministic per instanceId; two different instanceIds of the same def CAN roll
  different triggers; every roll is suitable (in the def's pool).
- `procCoefficient.test.ts` — monotone decreasing, bounded [0.34,1], REF=1.0.
- `battleTriggers.test.ts` — resolver buckets per-instance rolls.
- `battleTriggerFx.test.ts` — overkill heals on a killing blow; frostnova freezes
  bystanders; glaciate freezes the attacker; proc coefficient reduces fast-attacker
  proc rate; no infinite recursion.
- `uniquePowers.test.ts` — powers are pure positive stat buckets again; procedural
  power varies by instanceId.

## Out of scope (deferred)

- Live stacking self-buffs (Headhunter mod-steal / Humming-Bee Ward / momentum):
  needs a mid-battle stat-mutation system — a separate, larger feature.
- On-block / true periodic-tick hooks: no sim hook exists yet.
- Rerolling a unique's trigger at the Forge (the roll is id-seeded; a reroll
  station could change the seed later).
