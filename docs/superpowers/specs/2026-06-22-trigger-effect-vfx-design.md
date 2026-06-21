# Signature VFX for triggered Unique-item effects

**Date:** 2026-06-22
**Status:** approved (self-approved under delegated full-autonomy session)

## Problem

A Unique item's BEHAVIOUR half — its triggered effect (on-hit/on-crit/on-kill/on-hurt/on-cast
proc, see `triggeredEffects.ts` + `battleTriggerFx.ts`) — mutates the sim but emits almost no
dedicated visual. Only `chain` (a bolt) and `gold` (a loot pop) reuse generic events. So when a
player's Unique procs frostguard, aegisthorns, painnova, an execute, or the once-per-battle
`undying` cheat-death, nothing on screen says "YOUR item just fired." The procs are invisible —
the player can't tell a Unique is working, and the marquee defensive saves land with no payoff.

## Goal

Give every meaningful triggered proc a **distinct, readable, impressive** in-battle flourish,
branded by a small family vocabulary so 20 procs feel designed rather than 20 random one-offs.
The cheat-death (`undying`) and last-stand (`secondwind`) should feel like *events*.

## Non-goals

- No new SDXL art (procedural vector VFX only, like `damageBadge`/`auraIndicator`). No
  `ASSET_VERSION` bump.
- No sim/mechanic change — purely additive presentation. Zero save migration.
- `chain` and `gold` already render; do NOT double up.

## Architecture (mirrors `cast`→`SkillVfx` and `bossCast`→`BossSkillFx`)

### 1. Pure plan — `src/data/triggerFxPlan.ts` (Phaser-free, tested)

`triggerFxPlan(kind: TriggerKind): TriggerFxPlan | null`

```ts
type TriggerFxFamily =
  | "recoil"     // spike recoil from the hero back at the attacker
  | "nova"       // concussive shockwave ring at a center
  | "frost"      // ice ring + crystal shards (control)
  | "dotSeed"    // themed motes settling on a target (burn/poison/bleed)
  | "lifeflare"  // life motes + heal cross converging on the hero
  | "execute"    // decisive X-slash + skull spark
  | "spread"     // tendrils from a corpse to neighbours
  | "resurrect"; // golden phoenix flare + screen flash (the big one)

interface TriggerFxPlan {
  family: TriggerFxFamily;
  color: number;        // family signature colour
  secondary?: number;   // accent
  label?: string;       // floating banner ("EXECUTE", "SECOND WIND", "UNDYING!")
  big?: boolean;        // extra punch + (for resurrect) screen flash
}
```

Mapping (returns `null` for `chain` & `gold` — already rendered):

| kind | family | colour | label | big |
|---|---|---|---|---|
| reflect | recoil | steel `0xcfd6e2` | | |
| aegisthorns | recoil | crimson `0xff5a5a` | | |
| riposte | recoil | gold `0xffe07a` | | |
| painnova | nova | steel `0xe9eef7` | | |
| blast | nova | element (Magic default) | | |
| echo | nova | arcane `0xc77dde` | | |
| frostguard | frost | cyan `0x9fe6ff` | | |
| frostnova | frost | cyan | | |
| glaciate | frost | cyan | | |
| freeze | frost | cyan | | |
| slow | frost | pale `0x8fd0ff` | | |
| castnova | frost | cyan | | |
| pyre | dotSeed | ember `0xff7a2a` | | |
| cinder | dotSeed | ember | | |
| poison | dotSeed | venom `0x8bc34a` | | |
| bleed | dotSeed | blood `0xc0202a` | | |
| heal | lifeflare | life `0x7cfc8a` | | |
| overkill | lifeflare | life | | |
| secondwind | lifeflare | radiant `0xffe07a` | SECOND WIND | ✓ |
| execute | execute | crimson `0xff3a3a` | EXECUTE | |
| contagion | spread | sick-green `0x9bd34a` | | |
| undying | resurrect | gold `0xffd34d` | UNDYING! | ✓ |

Element tint: for `nova`/`dotSeed`, the presenter overrides `plan.color` with the
event's `element` colour when present (so a Physical blast reads white, a Magic blast violet).

### 2. Presenter — `src/scenes/triggerFx.ts`

`TriggerFx.play(kind, at, to?, radius?, element?)` — resolves the plan, dispatches by family,
draws themed primitives (reuse `FxPool`). One shared `banner(at, text, color, big)` floating-text
helper for the labelled families. `resurrect`/`big` add a brief full-screen white flash via a
camera-space rectangle. Lives under `DEPTH.FX` (feedback on top, like damage numbers).

### 3. Event + emit

- `battleTypes.ts`: add `| { type:"trigger"; kind: TriggerKind; at: Vec2; to?: Vec2;
  radius?: number; element?: DamageType }` to `FxEvent`.
- `fx.ts` `FxLayer`: construct a `TriggerFx`; `case "trigger": this.trigger.play(...)`.
- `battleTriggerFx.ts`: emit one `trigger` event at each proc site (with the position context
  already in scope — `hero.pos`, `target.pos`, `victim.pos`, `attacker.pos`), and from
  `tryHeroUndying` for the cheat-death. Pure data emit; no Phaser in the sim.

## Testing

- `tests/triggerFxPlan.test.ts` — every `TriggerKind` except `chain`/`gold` has a plan; the
  three banners + two `big` flags are present; family/colour spot-checks.
- `tests/fx-events.test.ts` (extend) or a focused sim test — a configured proc emits a `trigger`
  event of the matching kind (e.g. a hero with `painnova`/`undying` struck emits it).

## Verification

tsc + eslint clean · full suite green · `npm run build` · CDP playtest showing a proc flourish ·
push + deploy live. No `ASSET_VERSION` bump (pure procedural VFX/data).
