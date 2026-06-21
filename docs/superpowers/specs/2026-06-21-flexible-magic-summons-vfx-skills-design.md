# Flexible Magic Weapons, Spectacular New Skills, and Summons — Design

Date: 2026-06-21
Branch: wip/sprite-art-restyle
Status: approved (delegated full-autonomy session — spec recorded, proceeding to TDD)

## Goal

Three related player-facing upgrades to the active-skill system:

1. **Flexible magic spell weapons** — a magic spell must no longer require *exactly*
   a Staff. Any magic-capable weapon should cast it: staff, tome/book, **or an
   enchanted "magic sword"**. Apply this to the existing magic skills too.
2. **More spectacular skills** — add a batch of high-impact magic actives with
   amazing VFX: meteor storm, glacial nova, infernal flame-wave, prismatic beam,
   storm-call. Reuse the existing additive VFX architecture (signatures + element
   kits + rarity power scaling).
3. **Summon skills** — a genuinely new mechanic: actives that conjure temporary
   friendly **minions** (elemental spirits) that fight alongside the hero/towers
   for a few seconds, then fade.

This is purely mechanics + procedural VFX. **No SDXL art, no ASSET_VERSION bump.**

## Background (from code research)

- `ActiveSkillDef` (`src/data/schema.ts`) carries `requiresWeapon?: WeaponType` —
  an **exact** single-value gate enforced by `skillWeaponMet` (`src/core/loadout.ts:48`).
  Existing magic skills hard-require `"Staff"` (`mana-burst`, `arcane-nova`) or
  `"Tome"` (`shadow-curse` — and Tome isn't even obtainable loot, so it's dead).
- The hero resolves a `damageType` from the equipped weapon; an **enchanted weapon
  becomes Magic** (`weaponFamily.ts deriveDamageType`). So "is this weapon magic-capable"
  is answerable from `weaponType ∈ {Staff,Tome}` OR resolved `damageType === "Magic"`.
- VFX is fully **additive**: a hero active needs a `SkillSignature` + `SigFn`
  (`skillSignatures.ts`) + a `SKILL_VFX` catalog entry (`skillVfxMeta.ts`). Rich
  primitives already exist (skyfall/beam/nova, fire/ice/lightning/arcane element
  kits, `grand()` flourish, rarity → `VfxPower` scaling). Meteor/nova/beam are
  largely **composition** of existing primitives.
- New skills auto-enter the loot pool: `drops.ts` rolls from `ACTIVE_SKILLS` minus
  owned, so defining a skill makes it obtainable. No acquisition wiring needed.
- The battle sim has hero + towers + enemies but **no friendly summoned unit**.
  Fixed timestep `SIM_STEP=0.05`; `tick()` order is waves → auras → enemies →
  towers → hero → flushPending → cleanup. Sprites pooled by `uid` in
  `battleSceneSprites.ts`. Recommended summon model: a new `MinionRuntime`
  (sibling of tower/hero) in `battle.minions`, stationary tower-like targeting,
  `lifespan` countdown, spawned from `castActive`.

## Part 1 — Flexible magic weapon gating

### Data
Add an optional, mutually-exclusive-with-`requiresWeapon` field to `ActiveSkillDef`:

```ts
weaponClass?: "magic" | "melee" | "ranged";
```

A skill may use **either** `requiresWeapon` (exact, legacy) **or** `weaponClass`
(class-based, flexible) or neither (any weapon). Validation in `validateActiveSkill`
rejects setting both.

### Pure logic (`src/core/weaponClass.ts`, new, tested)
```ts
export type WeaponClass = "magic" | "melee" | "ranged";
// Coarse hero WeaponType → class, with damageType override for enchanted swords.
export function weaponClassOf(wt: WeaponType | undefined, dmg: DamageType | undefined): WeaponClass | null;
//   magic  := wt ∈ {Staff, Tome} OR dmg === "Magic"   (covers magic/enchanted swords)
//   ranged := wt ∈ {Bow, Gun}
//   melee  := wt ∈ {Sword, Fist}
//   else null (Any/none)
export function weaponClassMet(req: WeaponClass | undefined, wt, dmg): boolean;
//   req undefined → true; else weaponClassOf(...) === req
```

### Gate (`loadout.ts`)
`skillWeaponMet` resolves the equipped weapon's `weaponType` **and** its resolved
`damageType` (new helper `equippedWeaponDamageType(save)` — reads the item def's
damageType / derives via weaponFamily), then:
- if `skill.weaponClass` → `weaponClassMet(...)`
- else if `skill.requiresWeapon` → exact match (unchanged)
- else `true`

### Migration of existing magic skills
`mana-burst`, `arcane-nova`, `shadow-curse` switch from `requiresWeapon: Staff/Tome`
to `weaponClass: "magic"`. Now castable with staff, tome, or magic sword. `spirit-bolt`
stays unrestricted. Physical weapon-flavored skills (iron-cleave/Sword, tri-shot/Bow,
rapid-fire/Gun, etc.) keep their exact `requiresWeapon` — out of scope.

## Part 2 — Spectacular new magic skills

All `weaponClass: "magic"` (so Part 1 makes them broadly castable). Each gets a
bespoke `SkillSignature` composed from existing primitives; numbers are starting
points (flag a `game-designer` pass).

| id | name | rarity | element | delivery | basePower | signature |
|----|------|--------|---------|----------|-----------|-----------|
| `meteor-storm` | Meteor Storm | Legendary | fire | skyfall | 300 | rain of N meteors (fallStreak loop) + scorch field + ember shower |
| `glacial-nova` | Glacial Nova | Rare | ice | ground | 230 | expanding double frost ring + radiating crystal shards + freeze flash |
| `infernal-wave` | Infernal Wave | Rare | fire | ground | 240 | rolling flame wall + rising plumes + lingering scorch |
| `prism-beam` | Prismatic Beam | Legendary | arcane | beam | 300 | thick multi-band sustained beam + sonic rings + spark filaments |
| `storm-call` | Storm Call | Legendary | lightning | ground | 280 | sky-strike volley + ground arcs + screen flash |

Each entry: `SkillSignature` added to the union in `skillVfxMeta.ts`, a `SigFn` in
`skillSignatures.ts`, and a `SKILL_VFX[id]` record (palette + delivery + motif:none
+ appearance text). All counts scale by `scaleCount(base, power)` for rarity.

New shared primitive (if needed): a `meteorRain(at, n, ...)` helper in `vfxDraw.ts`
(loops `fallStreak` at jittered offsets) and a `lance(at, angle, len, bands, ...)`
thick-beam helper — only if existing `fallStreak`/`gleam` can't compose it cleanly.

## Part 3 — Summon skills + minion system

### Summon archetypes (`src/data/summons.ts`, new, tested)
```ts
export interface SummonDef {
  id: string; name: string;
  element: "fire" | "ice" | "lightning" | "arcane" | "physical";
  atkFrac: number;        // minion atk = summoner effAtk * atkFrac
  hpFrac: number;         // minion maxHp = summoner maxHp * hpFrac (or flat fallback)
  attackSpeed: number;    // atk/sec
  range: number;
  damageType: DamageType;
  count: number;          // default minions spawned
  lifespan: number;       // seconds before fading
}
```
Three summons: `flame-sprite` (fire, 3×, fast, fragile), `frost-golem` (ice, 1×,
tanky, slow, slowing hits), `storm-hawk` (lightning, 2×, fast, ranged).

### Minion runtime (`src/core/battleTypes.ts`)
```ts
export interface MinionRuntime {
  uid: number; def: SummonDef; stats: Stats;
  pos: Vec2; hp: number; attackCd: number; alive: boolean;
  lifespan: number; maxLifespan: number;
}
```
`BattleState.minions: MinionRuntime[]`.

### Sim (`src/core/battleMinions.ts`, new, merged onto prototype — god-class split pattern)
- `summonMinion(def, pos, summonerAtk, summonerHp)` — builds stats from fractions,
  pushes a `MinionRuntime` (uid from the shared uid counter).
- `updateMinions(dt)` — for each live minion: decrement `lifespan` (despawn at ≤0);
  cooldown; pick **nearest enemy in range** (stationary, no pathing); on ready,
  deal `stats.atk` of `def.damageType` to that one enemy via the existing damage
  path (no crit, no procs → deterministic), emit a lightweight attack FX event;
  frost-golem applies a short slow.
- `cleanupMinions()` — drop dead/expired minions (and the scene frees sprites).
- `tick()` gains `updateMinions(dt)` after `updateTowers`, and `cleanupMinions()`
  near `cleanupDead()`.

### Skill → summon
`ActiveSkillDef` gains `summon?: { defId: string; count?: number; lifespan?: number }`.
In `castActive`, after damage resolution, if the skill carries `summon`, spawn
`count` minions in a ring around the cast center (using the caster's effAtk/maxHp).
Summon actives have low `basePower` (the value is the minions, not the burst).

Three summon skills (all `weaponClass: "magic"`): `conjure-flame-sprites`,
`summon-frost-golem`, `call-storm-hawks`. Each gets a "conjuring circle" signature
(element-colored summoning ring + glyphs + rising motes) so the cast reads clearly.

### Rendering (`src/scenes/minionSprite.ts`, new presenter)
Minions render **procedurally** (zero art): an element-colored glowing core +
counter-rotating ring + drifting motes, drawn/updated each frame in a new
`manageMinions()` pass in `battleSceneSprites.ts`, pooled by `uid`, position
lerped like towers, a thin lifespan arc, and a fade-out in the final second.
Freed when the minion despawns.

## Determinism & safety
- Minion basic attacks are single-target, no crit/proc → they don't perturb the
  shared RNG/loot/crit stream (mirrors the `chance>=1` determinism rule).
- Minions are friendly: never targeted by `selectTarget`, never on enemy routes,
  immune to enemy debuffs (they're tools, not combatants).
- Lifespan + a hard cap on concurrent minions (e.g. 12) bound the entity count.
- No save-shape change: minions are battle-runtime only; new skills/summons are
  pure catalog data; `weaponClass` is an optional def field (no migration).

## Testing (TDD)
- `weaponClass.test.ts` — class resolution incl. magic-sword (Sword+Magic→magic).
- `loadout` / `skill-weapon-gate` — magic skill now met by staff, tome, AND magic
  sword; unmet by plain physical sword; legacy exact gates unchanged.
- `skillVfx.test.ts` — new signatures resolve and render without throwing.
- `summons.test.ts` — summon defs valid; stat derivation from summoner.
- `battleMinions.test.ts` — summon spawns N minions; they damage a nearby enemy;
  they despawn at lifespan; cap respected; friendly (not hit by enemies).
- `skills` catalog — new skills validate; summon skills carry a real summon def.

## File-size discipline
`battleMinions.ts`, `summons.ts`, `weaponClass.ts`, `minionSprite.ts` are new
focused modules. New signatures append to `skillSignatures.ts` — if it nears 500
lines, split the new set-pieces into `skillSignaturesB.ts`.

## Out of scope (flag for later)
- Melee/ranged skill flexibility (only magic requested).
- Minion upgrade/scaling beyond summoner-fraction stats.
- New SDXL minion art (procedural is intentional this pass).
- game-designer balance tuning of the new numbers.
