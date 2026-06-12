# Cinematic Boss-Skill VFX Overhaul — Design

**Date:** 2026-06-12
**Status:** Approved (full-auto session)

## Problem

Every boss in the game funnels its active skill into one of four cast
set-pieces — `quake` / `rally` / `barrier` / `summon-surge` — rendered by
`BossSkillFx` (`src/scenes/bossSkillSignatures.ts`). Two weaknesses make boss
casts underwhelming:

1. **Repetition.** 20 bosses share 4 looks, each with ONE fixed theme colour.
   All eight `quake` bosses cast an identical red EARTHSHATTER; the player never
   feels the boss's own identity in the effect.
2. **Single-burst staging.** Each signature is essentially one moment — rings +
   a few shards — with no wind-up and little aftermath. It reads as a flat pop
   rather than a cinematic set-piece.

The goal: **make every boss-skill cast look super cool and impressive** — both
more dramatic per cast and visually distinct between bosses.

## Non-Goals (YAGNI)

- **No new boss skill _types_.** The four shapes are enough; variety comes from
  theming + staging, not more branches.
- **No gameplay change.** Damage, tower-disable, heal, and summon logic in
  `castBossSkill` (`battleEnemies.ts`) are untouched. This is purely visual.
- **No art/SDXL regen.** Boss-skill VFX are procedural Phaser shapes — no assets.
- **No hero/tower VFX change.** Only the boss cast path is in scope.

## Design

Two pillars: a **cinematic staging upgrade** (the core "impressive") and a
**per-boss elemental accent** (the "distinct").

### Pillar 1 — Cinematic 3-beat choreography (renderer)

Restructure each of the four signatures, plus the fallback ring, into a
deliberate **telegraph → burst → aftermath** arc instead of one burst:

- **Telegraph (~120–160 ms):** anticipation. A gathering wind-up that reads as
  "something heavy is coming" — converging motes for `summon-surge`, a charging
  ground glow + hairline crackle for `quake`, an inhale-pulse for `rally`, a
  plate-gather shimmer for `barrier`.
- **Burst:** the existing dramatic moment, elevated — layered additive bloom
  (`flare`), a secondary **accent**-coloured layer over the primary shapes, and
  a camera **punch** tuned by the signature's weight (quake heaviest → strong
  shake; barrier lightest → soft flash).
- **Aftermath (~350–450 ms):** settling so the screen never snaps back to empty
  — drifting embers/motes (`emberDrift`), a fading bloom, slow debris.

New shared cinematic primitives added to the renderer:

- `flare(at, r, color, dur)` — additive radial bloom (soft glow disc).
- `chargeCore(at, r, color, dur)` — telegraph: a core that scales _in_ (gather)
  before the burst, the visual "wind-up".
- `emberDrift(at, spread, color, n)` — aftermath: small additive motes that
  rise/drift outward and fade.
- `punch(weight)` — camera shake + flash scaled by a `0..1` weight, so heavy
  skills hit harder than light ones. One tuned call instead of ad-hoc
  `shake`/`flash` per signature.

Everything stays **stateless and self-destructing** (every object destroyed on
tween/timer complete), matching the current module's contract. The sim is never
touched; this is presentation only.

If `bossSkillSignatures.ts` crosses ~400 lines with the new beats, extract the
shared primitives into `src/scenes/bossSkillFxPrimitives.ts` (a small helper the
renderer composes) to honour the <500-line rule.

### Pillar 2 — Per-boss elemental accent (pure, tested)

The signature _shape_ still encodes the skill TYPE (quake = earthshatter), but
the _palette_ now encodes the boss's element, so two quake bosses of different
elements read differently.

New pure resolver in `src/data/bossSkillVfx.ts`:

```ts
export interface BossSkillTheme {
  signature: BossSignature; // which set-piece (unchanged)
  primary: number; // base signature colour (the anchor)
  accent: number; // element-derived secondary colour
  label: string; // flavour label (unchanged)
  weight: number; // 0..1 camera intensity for punch()
}
export function bossSkillTheme(skillType: string, element: DamageType): BossSkillTheme;
```

- `primary` = the existing `bossSkillSignature(skillType).color` (preserved — the
  signature keeps its recognisable base hue).
- `accent` = `ELEMENT_ACCENT[element]`: `Physical` → steel-white `0xdfe7f2`,
  `Magic` → violet `0xc77dde`, `True` → gold `0xfff3a0` (mirrors the existing
  `DMG_COLOR` family in `fx.ts` so it feels native).
- `weight` = per-signature constant: `quake` 1.0, `summon-surge` 0.7,
  `rally` 0.6, `barrier` 0.4, fallback ring 0.5.

`bossSkillSignature` stays as-is (still used; `bossSkillTheme` builds on it), so
all existing `bossSkillVfx` tests keep passing.

### Plumbing the element

The cast event must carry the boss's element so the renderer can theme it:

1. `battleTypes.ts` — add `element: DamageType` to the `bossCast` event variant.
2. `battleEnemies.ts` `castBossSkill` — `emit({ ..., element: e.def.damageType })`.
   `EnemyDef.damageType` already exists (`schema.ts:157`).
3. `fx.ts` — `case "bossCast"` passes `e.element` into `bossCast(...)` →
   `bossFx.cast(at, skill, radius, name, element)`.
4. `BossSkillFx.cast(at, skillType, radius, name, element)` — resolves
   `bossSkillTheme(skillType, element)` and threads `primary`/`accent`/`weight`
   into the chosen signature.

Default: if an element is somehow absent, `ELEMENT_ACCENT` falls back to the
`Physical` steel accent (no throw).

## Components & Boundaries

| Unit             | File                                                   | Responsibility                                | Tested       |
| ---------------- | ------------------------------------------------------ | --------------------------------------------- | ------------ |
| `bossSkillTheme` | `src/data/bossSkillVfx.ts`                             | pure: (skillType, element) → palette + weight | unit         |
| `bossCast` event | `src/core/battleTypes.ts`                              | carries `element`                             | type         |
| emit             | `src/core/battleEnemies.ts`                            | populates `element` from boss def             | sim test     |
| `BossSkillFx`    | `src/scenes/bossSkillSignatures.ts`                    | 3-beat themed set-pieces                      | n/a (Phaser) |
| primitives       | `src/scenes/bossSkillFxPrimitives.ts` _(if extracted)_ | flare/charge/ember/punch                      | n/a (Phaser) |

The pure `bossSkillTheme` and the event field are the testable seams; the
Phaser renderer is exercised by playtest (CDP `window.__game`), as the rest of
the FX layer is.

## Testing

Pure / sim (Vitest):

1. `bossSkillTheme("quake","Magic").accent !== bossSkillTheme("quake","Physical").accent`
   — same signature, different element ⇒ different accent (the distinctness win).
2. `bossSkillTheme("quake", e).primary === bossSkillSignature("quake").color` for
   every element — base hue preserved as the anchor.
3. `bossSkillTheme` returns a defined `weight` for each known signature AND for
   the fallback ring; quake weight > barrier weight (heaviest vs lightest).
4. Every Antihero boss's `(skill.type, damageType)` resolves to a non-ring
   signature with a valid accent (extends the existing roster sweep).
5. Sim: a boss cast emits a `bossCast` event whose `element` equals the boss
   def's `damageType`.
6. All existing `bossSkillVfx.test.ts` cases stay green (`bossSkillSignature`
   unchanged).

Manual: CDP self-playtest — fast-forward to a boss, confirm each of the four
signatures shows a clear wind-up, a punchy burst, and a settling aftermath, and
that two same-type bosses of different elements look distinct. Capture a montage.

## Risks

- **Camera over-shake.** `punch(weight)` is tuned so even weight 1.0 stays within
  the current `quake` shake budget (0.011) — not more violent, just better
  staged. Verified in playtest.
- **Perf / object churn.** Aftermath adds a handful of additive motes per cast;
  boss casts are infrequent (mana-gated) so this is negligible. All objects
  self-destruct.
- **File size.** Extraction to `bossSkillFxPrimitives.ts` keeps both files under
  500 lines.
