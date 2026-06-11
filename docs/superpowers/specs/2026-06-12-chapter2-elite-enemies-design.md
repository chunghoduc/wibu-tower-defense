# Design Spec — "The Escalation Five": Chapter 2+ Elite Enemies

**Date:** 2026-06-12
**Lens:** game-designer (core loop → relevance filter → MDA → numbers policy → flow)
**Request:** Design 5 new powerful enemies that only appear from chapter 2 onward.

---

## 1. Design goal (MDA: feeling first)

**Target aesthetic:** *"The war just got serious."* Chapter 1 (Greywood Pass) taught the
player every single answer in isolation — anti-air, single-target vs shields, burst vs
healers, DoT vs regen, magic vs the Golem, physical vs the Monolith. Chapter 2+ should
feel like those lessons being **combined, escalated, and weaponized against you**. The
player who coasted on one auto-attack tower must now *compose* a defense.

**Dynamic wanted:** each new enemy demands a **distinct, legible answer** the player can
already build toward — never a hard lock-and-key (the catalog's stated rule: immunities
are limited to ONE thing and never shut out the hero or True damage). A new enemy is only
worth its slot if I can name its Action → Feedback → Reward *for the player defending
against it* — i.e. "recognize threat → counter-play → satisfying clear."

**Scope rule:** Chapter 1 (stages 1–10, hand-tuned `buildChapter1Waves`) is **untouched**.
The procedural `buildWaves(n)` is only ever called with `n ≥ 11` (stages 11–30, chapters
2–5), so gating the new enemies there guarantees "from chapter 2 onward" structurally —
no per-enemy chapter flag needed.

---

## 2. The Relevance Filter — what gets cut

Before committing, every concept passed the five gates (Clarity, Motivation, Response,
Satisfaction, Fit). Concepts I **rejected**:

- **Damage reflection / thorns** — *fails Satisfaction.* Punishes the player for landing
  big hits (playing well); swingy and reads as unfair. Cut.
- **Mobile heal/armor support (3rd aura enemy)** — *fails Fit.* Herald + Hexer already own
  "fragile backliner you kill first." A third would be redundant cognitive load, not a new
  answer. Cut.
- **Intermittent-stealth burrower** — *fails Clarity/Fit.* Overlaps Phantom; toggling
  targetability mid-lane is hard to telegraph honestly. Cut.
- **A pure stat-block "thicc Brute"** — *fails Motivation.* No new dynamic = decoration,
  not a mechanic. Cut.

The five survivors each introduce a **new answer the roster does not yet demand**, and
together they escalate four specific Chapter-1 lessons plus add one wholly new one.

---

## 3. The Escalation Five

Stats are authored at the **Chapter-1 power tier** (same baseline as `grunt`/`brute`/etc.);
the existing progression curve (`progressionScaling.ts`: ×1.08/stage, ×1.30/chapter on HP)
scales them up automatically as the player descends, exactly like every other enemy. They
are authored a *notch above* their Chapter-1 cousin to feel like a step up, because they
debut to a player who already owns a Chapter-1-cleared roster.

### 3.1 Bloodmad Reaver — `Berserker` (ground) — escalates the **Raider**
> *A frothing tower-smasher that becomes lethal the moment it's wounded.*

- **New mechanic — `frenzy`:** when HP drops below a threshold, it latches into a frenzied
  state (mirrors boss `enrage`: one-way, set once) that multiplies its move + attack speed.
- **The answer it demands:** *burst, not chip.* A wounded Reaver left alive at low HP near
  your line will accelerate and shred towers. The player must concentrate damage to take it
  cleanly through its whole bar, or kite it. Teaches focus-fire / burst priority.
- **Why it's fair:** fully telegraphed (visible frenzy state + speed spike); the counter
  (kill it faster) is something every roster can do.

| stat | value | anchor / intent |
|---|---|---|
| maxHp | 170 | ~1.7× Raider (100): a real wall, not a one-shot |
| armor | 10 | light — rewards the burst it's asking for |
| moveSpeed | 60 | base; **frenzy → 60×1.8 = 108** (outruns most towers' uptime) |
| atk | 30 | **frenzy → 48**; punishes leaving it alive |
| attacksTowers range | 95 | same as Raider — it parks and demolishes |
| frenzy | belowHpPct 0.5, speedMult 1.8, atkMult 1.6 | the dynamic lives here |
| bounty / castleDamage | 22 / 3 | high bounty = a worthwhile focus-fire target |

### 3.2 Prism Behemoth — `Juggernaut` (ground) — escalates **Golem + Monolith into one**
> *A slab that is never vulnerable to the same thing twice in a row.*

- **New mechanic — `adaptiveImmunity`:** alternates its immune damage type (Physical ↔
  Magic) on a fixed timer. It is *always* killable — True damage and the currently-off type
  both land — but a **mono-type defense stalls**.
- **The answer it demands:** *bring two damage types, or True, or penetration, and time your
  burst to the open window.* This is the Chapter-1 immunity lesson (you learned single
  immunity vs Golem/Monolith) raised one level: now both, in one body.
- **Why it's fair / not lock-and-key:** True damage and the hero always work; the off-type
  always works; the switch is **telegraphed** (color tint via an FX event on each flip).
  damageReduction 0.4 (not 0.5) keeps it from feeling spongy on the right type.

| stat | value | anchor / intent |
|---|---|---|
| maxHp | 360 | < Golem (420) — it's slipperier, not tankier |
| armor / magicResist | 35 / 35 | symmetric; neither type is the "easy" one |
| damageReduction | 0.4 | below the 0.5 Juggernaut norm — the switch IS the difficulty |
| moveSpeed | 16 | a slow, deliberate wall |
| adaptiveImmunity | types [Physical, Magic], switchIntervalSec 3.5 | starts Physical |
| bounty / castleDamage | 40 / 5 | Juggernaut-tier reward & threat |

### 3.3 Bloomrot Carrier — `Burster` (ground) — **new lesson: spacing**
> *A bloated rot-sack that detonates on death, splashing your towers.*

- **New mechanic — `deathNova`:** on death, deals a one-shot AoE burst of damage to **towers**
  in a radius (mitigated by tower armor/MR like any tower hit).
- **The answer it demands:** *don't pack towers tight against the lane; kill Carriers at
  range or where their corpse won't reach a cluster.* The only enemy in the game that
  punishes over-clustering — a genuinely new spatial dynamic that rewards thoughtful
  placement (Autonomy: positioning becomes a real choice again).
- **Why it's fair:** the nova damages towers but cannot end a run by itself (no castle
  splash); the telegraph is the death itself + a visible expanding ring; spread defenses are
  immune. Damage is tuned to *threaten*, not delete, a healthy tower.

| stat | value | anchor / intent |
|---|---|---|
| maxHp | 130 | soft-ish — it *wants* to die near you |
| moveSpeed | 40 | average; it must reach the cluster to matter |
| atk / attackSpeed | 6 / 0.8 | negligible on its own — the corpse is the weapon |
| deathNova | radius 110, damage 180, type Magic | ~40-45% of a real tower's in-battle HP floor (~400): threat, not delete. (Playtest-tuned up from 45 — see §6.) |
| bounty / castleDamage | 14 / 2 | modest |

### 3.4 Iron Dreadwing — `Dreadnought` (flying) — escalates the **StormFlyer**
> *An armored sky-fortress that bombards your towers from above.*

- **Mechanic — REUSE only:** `flying` + `attacksTowers` + armor + high HP. No engine change.
- **The answer it demands:** *heavy, dedicated anti-air.* Chapter-1 flyers were soft (a few
  arrows). This is a **flying tank that shoots back** — a chip anti-air tower can't keep up.
  Forces the player to actually invest in air defense, not token it.
- **Why include a reuse-only enemy:** balances implementation risk (one of five needs no new
  system) while still delivering a distinct, escalated threat. Good engineering discipline.

| stat | value | anchor / intent |
|---|---|---|
| maxHp | 220 | ~1.6× StormFlyer (140): survives token anti-air |
| armor | 30 | a *flying* armored target — doubly demanding |
| moveSpeed | 40 | beelines castle like all flyers |
| atk / attacksTowers range | 18 / 130 | bombards from range while moving |
| bounty / castleDamage | 22 / 3 | |

### 3.5 Gravewail Cantor — `Disruptor` (ground backline) — **new lesson: redundancy**
> *A keening cantor whose dirge periodically silences the towers around it.*

- **New mechanic — `towerDisablePulse`:** on an interval, disables (silences) towers in a
  radius for a short duration — a *normal-enemy* version of the boss `towerDisable`.
- **The answer it demands:** *priority-kill it (like Summoner/Hexer) before it reaches your
  cluster, or spread your towers so one pulse can't blank your whole defense.* Teaches
  defensive redundancy — don't let one chokepoint be a single point of failure.
- **Why it's fair:** fragile-ish backliner (a clear priority target with telegraphed pulses);
  the pulse is short and on a cooldown, not permanent; spread towers are barely affected.

| stat | value | anchor / intent |
|---|---|---|
| maxHp | 130 | priority-kill fragile, like Hexer (120) |
| magicResist | 30 | survives a little to reach range; not a Mender wall |
| moveSpeed | 30 | slow backliner |
| towerDisablePulse | radius 120, duration 1.6, interval 7 | weaker than boss (3s) — it's trash, not a boss |
| bounty / castleDamage | 24 / 2 | high bounty = "kill me first" incentive |

---

## 4. Coverage check — do the five earn their slots together?

| Enemy | Chapter-1 lesson it escalates | New answer demanded | Bartle / SDT hook |
|---|---|---|---|
| Bloodmad Reaver | Raider (tower-smasher) | focus-fire / burst priority | Killers (mastery), Competence |
| Prism Behemoth | Golem+Monolith (immunity) | dual-type / True / pen + timing | Explorers (build variety), Competence |
| Bloomrot Carrier | — (wholly new) | tower **spacing** | Explorers, Autonomy (placement matters) |
| Iron Dreadwing | StormFlyer (air) | **heavy** anti-air investment | Achievers (must upgrade), Competence |
| Gravewail Cantor | — (wholly new) | defensive **redundancy** / priority-kill | Killers, Explorers |

No two share an answer. Two reuse existing mechanics conceptually (Reaver≈enrage,
Cantor≈towerDisable) so the engine work is *mirroring* proven systems, not inventing.
One (Dreadwing) is pure reuse. Two add genuinely new spatial dynamics (Carrier spacing,
Prism timing). The set spans ground/air, fast/slow, tank/fragile, and both damage types.

---

## 5. Difficulty pacing & the monotonic law (flow §7)

The project's standing rule: difficulty rises wave < stage < chapter, monotonically. New
systems must enter **one at a time, with space to learn** (§7). So the five are **staggered**
by a global-stage gate inside `buildWaves(n)` — every gate is within Chapter 2 (stages
11–15), so all five still debut "from chapter 2 onward," but not all at once:

| Enemy | first appears | wave slot it joins |
|---|---|---|
| Iron Dreadwing | stage 11 (`n≥11`) | W8 flyer storm |
| Bloodmad Reaver | stage 11 (`n≥11`) | W7 raiders |
| Bloomrot Carrier | stage 12 (`n≥12`) | W6 / W9 |
| Gravewail Cantor | stage 13 (`n≥13`) | W8 supports |
| Prism Behemoth | stage 14 (`n≥14`) | W6 wall / W9 gauntlet (the capstone) |

By Chapter 3 (stage 16+) all five are in rotation and scale via the existing curve. This is
additive density on top of the existing pool — it never *removes* a Chapter-1 threat, so the
monotonic ordering (waveScaling intra-stage, progressionScaling per-stage/chapter) is
preserved. Bosses remain on W5/W10 only.

---

## 6. Numbers policy — sanity (TTK) note

These are authored at the Chapter-1 baseline so the existing curve carries them; I did **not**
hand-scale per chapter (that's the curve's job — one knob). The one number that needs a live
check is **Bloomrot Carrier `deathNova` damage (45 Magic)** vs real tower HP: it must
*threaten* a tower (~half its HP after mitigation) but not *delete* a healthy one in a single
nova. This is the cheapest thing to falsify and is called out as the key playtest in §8.

---

## 7. New data contracts (for the plan to implement)

Added to `EnemySpecial` (all optional, additive — existing enemies untouched):

```ts
frenzy?: { belowHpPct: number; speedMult: number; atkMult: number };
adaptiveImmunity?: { types: DamageType[]; switchIntervalSec: number };
deathNova?: { radius: number; damage: number; type: DamageType };
towerDisablePulse?: { radius: number; duration: number; interval: number };
```

New `EnemyArchetype` keys: `Berserker`, `Burster`, `Dreadnought`, `Disruptor` (Prism reuses
`Juggernaut`). Each needs an `ARCHETYPE_INFO` entry (name + "how to beat it" blurb) so the
bestiary stays self-documenting (Clarity gate).

New `EnemyRuntime` fields (mirroring `enraged`/`summonTimer`/`bossDisableTimer`):
`frenzied: boolean`, `adaptPhaseTimer: number`, `adaptPhaseIndex: number`,
`disablePulseTimer: number`. (deathNova needs no runtime state — it fires in `killEnemy`.)

All four mechanics hook proven seams (verified): `frenzy` folds into `enemySpeed`/`enemyAtk`
+ a latch in `tickEnemyStatus`; `adaptiveImmunity` extends `isImmune` + a timer in
`tickEnemyStatus`; `deathNova` fires in `killEnemy` after the `splitInto` block; the disable
pulse mirrors `updateBoss`'s `towerDisable` loop, called from `updateEnemies`.

---

## 8. Risks & the cheapest experiment that falsifies each

1. **Prism feels unkillable to a mono-type player → frustration, not puzzle.** *Falsify:* CDP
   endless/ch2 playtest with a single-damage-type loadout — confirm it eventually dies (off
   window + hero) and isn't a soft-lock. If it stalls, shorten `switchIntervalSec` or lower DR.
2. **Bloomrot nova deletes towers → feels unfair / un-fun.** *Falsify:* place a fresh tower,
   kill a Carrier on top of it, read tower HP — must survive one nova at ~50% HP. Tune `damage`.
3. **Gravewail pulse + cluster = total lockout → anti-fun.** *Falsify:* playtest a tight
   cluster vs a Cantor — disabled uptime must be a *window*, not permanent. Tune interval/duration.
4. **Reaver frenzy is invisible → reads as a bug.** *Falsify:* confirm the frenzy state emits
   an FX/visible speed change the player can see and react to.
5. **Difficulty spike too sharp at stage 11–14 → churn.** *Falsify:* the staggered gates +
   authoring-at-baseline (curve does the scaling) are the mitigation; confirm via a stage-11
   and stage-14 CDP run that an intended roster can still clear.

**Decision recorded (full-auto):** proceed with all five; implement via TDD mirroring the
verified seams; the four new mechanics are pure-core and unit-testable before any Phaser
wiring; commit per milestone.
