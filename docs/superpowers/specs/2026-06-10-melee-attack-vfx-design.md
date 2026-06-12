# Melee Attack VFX — Design Spec

**Date:** 2026-06-10
**Goal:** Give melee towers attack visuals that _read as melee_ — slashing crescents, weapon swings, fist jabs, and weighty ground-shaking smashes — instead of the current single generic arc. Make them beautiful ("anime slash" glow) and juicy, while staying safe for a many-units-at-once tower-defense sim.

## Background (current state)

- All battle FX are procedural Phaser graphics in `src/scenes/fx.ts` (no sprites). The sim (`src/core/battle.ts`) emits an `attack` FxEvent carrying `{ style, from, to, ranged, crit, damageType, role }`; `FxLayer.attackFx()` dispatches on `style`.
- `style` is computed by `attackStyleFor(def)` in `src/data/attackStyle.ts` from the weapon-description keywords + role + range.
- Today **every** melee tower collapses to one of: `slash` (a thin 16px arc at a _random_ angle, ignoring attack direction), `hex` (purple slash), or — for the hero only — `punch`. Fist/ki brawlers and heavy "smash the ground" tankers all render as the same little sword crescent. Nothing conveys weapon weight, direction, or impact.

## Research basis (verified, see deep-research report this session)

- Readable melee = **anticipation → action/swing → recovery** phases, not one smooth blob. Recovery must ease back, not snap.
- Weight is communicated mostly through **timing**: light swing ~0.2–0.4 s, heavy ~0.4–0.8 s with longer windup + follow-through; per-weapon cycle ≈ sword 400 ms / spear 550 ms / hammer 800 ms.
- **Juice on impact** (highest-value first): hit-stop (1–4 frame freeze, scaled to power), short camera shake, brief white flash, exploding particle hit-spark. Shake/flash tuned _per attack_ and reserved for heavy hits.
- Phaser specifics: `Graphics.arc()+strokePath` for thin trails (Arc fills by default), particle `explode()` for one-shot hit-sparks, `blendMode:'ADD'` for the bright additive anime-slash glow, `cameras.main.shake(dur,intensity)` / `.flash(dur,r,g,b)`.

## Hard constraint: do NOT freeze the sim

The battle is a fixed-tick simulation with many towers firing every tick. A global hit-stop (freezing the scene/timers) would desync projectiles and the sim and rattle the screen constantly. Therefore:

- **Hit-stop is faked locally** — the impact crescent/flash _holds_ at full extension for ~40–60 ms before fading (a "held frame"), only on heavy archetypes. The sim never pauses.
- **Camera shake is rare and throttled** — only the `smash` archetype and melee crits may shake, at tiny amplitude (~0.003, ~100 ms), and a single FxLayer-level throttle (~90 ms cooldown) prevents simultaneous heavy hits from stacking into a constant rattle.

## Archetype taxonomy (mapped to real units)

Five melee styles. Each maps from weapon keywords / role, refining only the branches of `attackStyleFor` that currently return `slash`/`hex`/`punch` (ranged styles are untouched):

| Style    | Feels like                                          | Mapped units (examples)                                                         | Keyword / rule                                                                               |
| -------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `slash`  | single anime sword crescent                         | kazu (spirit sword)                                                             | katana/sword/blade/rapier at melee range, single blade                                       |
| `flurry` | 2–3 rapid blade slashes                             | zoran (three katana)                                                            | multi-blade words: "three", "twin", "dual", "both", "pair" + blade                           |
| `punch`  | fast fist jab–cross                                 | yamo, prince-vael (ki), light fist tankers                                      | fist/ki/knuckle/palm/chakra, Physical, not heavy                                             |
| `smash`  | weighty overhead blunt + ground shockwave (+ shake) | joro, garron, reinhart, garrek, riku (heavy tankers), sota (the finisher punch) | club/maul/hammer/smash/slam/charge/crush/crack/pillar OR tanker role with heavy/slow profile |
| `hex`    | purple debuff swipe (kept)                          | doro, shika, garan (non-ice debuff)                                             | unchanged (debuff, non-ice)                                                                  |

Magic-fist and elemental units keep their existing ranged/elemental styles (akagan→fireball, kilo→lightning, karu→arcane, morren→poison, etc.). `thrust`/`cleave` are intentionally **not** added — no current melee unit needs them (YAGNI).

## Rendering design (all in a new `src/scenes/meleeFx.ts`)

Each renderer receives `from`, `to`, `color`, `crit`. Direction `ang = atan2(to−from)`; the swing is oriented along it (fixes the current random-angle bug).

- **`slash`** — an additive **crescent** (filled between two arcs, white-hot inner edge → damage-tint outer) swept across the target perpendicular to `ang`, scaling in over ~70 ms then fading + drifting ~120 ms; trailing after-image line; radial hit-spark. Crit → wider/brighter + extra spark.
- **`flurry`** — 3 small crescents at staggered delays (0 / ~70 / ~140 ms), alternating angle offsets, each with a tiny spark. Reads as a fast multi-strike.
- **`punch`** — knuckle streak drives in (~70 ms, `Quint.easeIn`), impact **ring** + radial spark; a quick second jab pop (~90 ms later) for a jab–cross cadence.
- **`smash`** — short windup (marker pulls back ~110 ms), downward chop crescent, **ground shockwave ring** + white flash circle + larger spark at impact, ~50 ms held frame, then a tiny throttled camera shake. The only screen-shaking melee.

Shared helpers (`spark`, `ring`) are reused from `FxLayer` by passing them in (or duplicated minimally). All trails use `blendMode: ADD`.

## Wiring

1. `attackStyleFor` gains the refined melee classification (pure function — unit-tested).
2. `AttackStyle` union gains `"flurry"`, `"smash"`.
3. `FxLayer.attackFx` routes `flurry`/`smash` and the upgraded `slash`/`punch`/`hex` into the new `MeleeFx` helper, passing `from` (currently only `to` is passed — the source of the random-angle bug).
4. New module keeps `fx.ts` under the 500-line limit (it's at 353; the melee renderers live in `meleeFx.ts`).

## Testing

- **Unit (TDD):** `tests/attackStyle.test.ts` — assert the archetype mapping for representative units: zoran→`flurry`, joro/garron/reinhart/garrek/riku→`smash`, sota→`smash`, yamo/prince-vael→`punch`, kazu→`slash`, doro/shika/garan→`hex` (unchanged), and **regressions**: ranged/elemental units unchanged (akagan→`fireball`, kilo→`lightning`, megu→`fireball`/cannon, sasu→`lightning`, kanae→`arcane`).
- **Visual:** `npm run build` + CDP self-playtest (`window.__game`) screenshot a wave to confirm each archetype reads distinctly and no constant screen-shake.
- Full suite + typecheck must stay green.

## Out of scope

Ranged projectile uniqueness (the earlier A/B/C discussion), sprite-based VFX, sound. This is procedural melee VFX only.
