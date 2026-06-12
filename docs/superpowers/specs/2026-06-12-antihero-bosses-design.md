# Design Spec — "The Antihero Gallery": 10 New Bosses (Chapters 2–5)

**Date:** 2026-06-12
**Designer lens:** game-designer (Core Loop, MDA, Relevance Filter, Numbers Policy)
**Status:** Approved (full-auto; designer holds standing approval)

## 1. The Request

Pull anti-heroes from anime, movies, and stories and turn them into **10 new
powerful bosses**, added to the game. Anti-heroes are the morally-grey, violent
protagonists audiences love precisely because they're dangerous — a perfect
fantasy for a _boss_: the foe you grudgingly respect.

## 2. The Problem It Actually Solves (Relevance Filter)

This is not "content for content's sake." Chapters 2–5 (stages 11–30, twenty boss
slots) currently **recycle the same ~8 bosses** from `BOSS_EXPANSION`:

```
ryomen, kura, akai, mukade, overlord, zabro, mukade, overlord, madarok, meruon,
ryomen, akai, mukade, madarok, meruon, ryomen, mukade, overlord, madarok, meruon
```

`mukade` appears 4×, `meruon`/`madarok`/`overlord` 3–4× each. The marquee moment of
every stage — the wave-10 boss — is a **rerun** four chapters deep. That's the
"fake variety" smell: the meta loop's biggest reward (a climactic, distinct boss
fight) is blunted by repetition, which erodes **Autonomy/Exploration** (no new
threat to read) and **Relatedness** (no new icon to recognize).

Ten fresh anti-hero bosses cut the worst repetition and give each chapter genuinely
new climaxes — feeding **Achievers** (new walls to clear), **Killers** (new mechanic
combos to master), and **Relatedness** (instantly-readable homages to beloved
anti-heroes).

Filter gates: **Clarity** ✓ (each boss = one legible threat + a reachable answer),
**Motivation** ✓ (serves the power/completion goals players already hold),
**Response** ✓ (reuses telegraphed, juiced boss mechanics), **Satisfaction** ✓ (a
distinct climax per stage), **Fit** ✓ (no new system — pure composition of the
existing boss/special kit; see §4).

## 3. MDA — Target Feeling First

**Aesthetic goal:** _"I'm fighting a legend who'd be the hero of their own story."_
Each boss should be recognizable in a glance (silhouette + mechanic), feel
**powerful** (a true spike), and be beatable with a **counter the player owns** —
never lock-and-key.

**Dynamic wanted:** the player reads the boss's gimmick, adapts positioning/target
priority/damage-type, and earns the clear. No boss is immune to the hero or to True
damage; every boss carries `immunity: null` (bosses must always be answerable).

## 4. Fit — Reuse Before Add (NO New Engine Code)

Every mechanic these bosses need **already exists** and is already tested. They are
built by _composing_ the kit, exactly like the existing homage bosses:

- `boss.enrage { belowHpPct, atkMult, speedMult }` — wounded power spike (latched).
- `boss.summon { enemyId, count, interval }` — periodic adds.
- `boss.towerDisable { radius, duration, interval }` — silence the line.
- `boss.skill` of type `quake | rally | barrier | summon-surge` — the mana-cast.
- `special.frenzy` — a second, sharper sub-HP spike that **stacks with enrage**.
- `special.attacksTowers { range }` — stop-and-smash / ranged bombardment of towers.
- `special.splitInto { enemyId, count }` — spawn on death.
- `special.towerDisablePulse` — a normal-cadence silence on top of the boss cast.

Bosses already read both `boss` and `special` in the sim (verified: `frenzy`,
`deathNova`, etc. fire on any enemy). **Zero schema or engine changes.** This keeps
the feature low-risk and fully unit-testable as data + wiring.

## 5. The Roster (homage in `// homage:` comments ONLY — never shipped raw)

Per the project's homage rule, the real anti-hero lives only in a source comment;
the shipped `name` is original. Ascending base HP sets the difficulty rank (the
progression curve scales each by stage depth at runtime).

| id            | Shipped name                | Homage (comment only)   | dmg   | Base HP | Signature combo (feeling)                                                                                     |
| ------------- | --------------------------- | ----------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `gravemourn`  | Gravemourn the Black Reaver | Guts (Berserk)          | Phys  | 1150    | enrage **+** frenzy **+** attacksTowers — relentless wounded fury; bursts lethal under 50%                    |
| `vindicator`  | The Vindicator              | The Punisher            | Phys  | 1350    | attacksTowers(range 170) + huge atk, no enrage — a cold gunman who deletes your line from range; race to kill |
| `sundermark`  | Sundermark the Vagrant      | Scar (FMA)              | Magic | 1500    | towerDisable + attacksTowers — walks down towers and unmakes them; the hero is the answer                     |
| `crownfall`   | Crownfall the Proud         | Vegeta (DBZ)            | Magic | 1650    | enrage(hard) + barrier(pride shield) + summon — a prideful rival who powers up when cornered                  |
| `unkilling`   | The Unkilling               | Wolverine (X-Men)       | Phys  | 1950    | huge hpRegen + frenzy + high tenacity + rally(heal) — won't stay down; demands a sustained burst window       |
| `mawborn`     | The Hungering Other         | Venom (symbiote)        | Phys  | 2250    | splitInto(on death) + summon + enrage — smothers you in spawn                                                 |
| `devourer`    | The Devouring Heir          | Eren / titans (AoT)     | Phys  | 2400    | summon(brutes) + enrage + summon-surge skill — a wall that breeds walls                                       |
| `crimsonlord` | The Crimson Sovereign       | Alucard (Hellsing)      | Magic | 2600    | hpRegen + summon(familiars) + rally(drain heal) + enrage — a vampire lord who heals off the fight             |
| `fallenward`  | The Fallen Warden           | Darth Vader (Star Wars) | Magic | 3100    | towerDisable(long, "force choke") + barrier + enrage — dread presence that chokes your towers silent          |
| `ashghost`    | The Ashen Ghost             | Kratos (God of War)     | Phys  | 4200    | enrage(massive) + summon + towerDisable + quake — apex rage incarnate; the new **final boss of the game**     |

**Mechanic spread** (no two feel alike): pure berserker melee (1), ranged
tower-killer (2), anti-tower disabler (3), enrage-tank-summoner (4), regen-bruiser
(5), split-swarmer (6), summon-wall (7), vampire (8), dread-disabler (9), apex
everything (10).

## 6. Numbers Policy & Placement

**Anchor:** existing expansion bosses span base HP 700 (champion) → 3800 (meruon).
The ten new bosses interleave that range and **extend the apex** — `ashghost` at
4200 (≈1.1× meruon) becomes the game's hardest fight, fitting "10 powerful bosses."

**Full ascending base-HP rank** (the canonical `BOSS_HP_RANK`, extended to 20):

```
champion 700 < zabro 1000 < gravemourn 1150 < ryomen 1200 < vindicator 1350
< kura 1450 < sundermark 1500 < crownfall 1650 < warden 1700 < unkilling 1950
< akai 2000 < mukade 2200 ≈ overlord 2200 < mawborn 2250 < devourer 2400
< crimsonlord 2600 < madarok 2700 < fallenward 3100 < meruon 3800 < ashghost 4200
```

**Monotonic difficulty law (must hold):** within every chapter the five stage
bosses ascend by base HP, so the wave-10 spike climbs stage-by-stage and the
chapter climaxes on its hardest boss. Cross-chapter escalation is carried by the
existing per-stage/per-chapter progression curve. New `BOSS_EXPANSION` (stages
11–30):

| Ch            | Stages | Boss per stage (ascending)                                                                          |
| ------------- | ------ | --------------------------------------------------------------------------------------------------- |
| 2 (Sunscar)   | 11–15  | `gravemourn`(1150) · `vindicator`(1350) · `sundermark`(1500) · `crownfall`(1650) · `overlord`(2200) |
| 3 (Emberfall) | 16–20  | `unkilling`(1950) · `mukade`(2200) · `mawborn`(2250) · `devourer`(2400) · `madarok`(2700)           |
| 4 (Mire)      | 21–25  | `akai`(2000) · `crimsonlord`(2600) · `madarok`(2700) · `fallenward`(3100) · `meruon`(3800)          |
| 5 (Blight)    | 26–30  | `crimsonlord`(2600) · `madarok`(2700) · `fallenward`(3100) · `meruon`(3800) · `ashghost`(4200)      |

Every new boss appears at least once; all ten debut as a **stage finale**.
Classic-boss reruns drop from 3–4× to 1–2×. `ashghost` is the stage-30 final boss.

**`midBossFor` correctness:** wave-5 mid-boss = previous stage's boss when its rank
≤ this stage's finale, else the boss one rank below the finale (chapter-opener
guard). Extending `BOSS_HP_RANK` to the full 20-entry list keeps this invariant:
wave 5 never out-ranks wave 10. (Covered by an invariant test for all 30 stages.)

**Bounty / castleDamage:** scale with rank, consistent with existing bosses —
bounty 90→300, castleDamage 8→20 across the rank. Boss leak still costs the flat
`BOSS_CASTLE_DAMAGE` (10) regardless (see `castleLeakDamage`).

## 7. Architecture

- **`src/data/enemiesAntiheroes.ts`** (new) — exports `ANTIHERO_BOSSES: EnemyDef[]`
  (the 10 defs), mirroring `enemiesBosses.ts`. Spread into `ENEMIES` in
  `enemies.ts` alongside `...HOMAGE_BOSSES` (keeps `enemies.ts` < 500 lines).
- **`src/data/stagesExpansion.ts`** — rewrite `BOSS_EXPANSION` per §6 table.
- **`src/data/stage.ts`** — extend `BOSS_HP_RANK` to the full ascending 20-id list
  so `midBossFor` ranks the new bosses correctly. `BOSS_BY_STAGE` already
  concatenates `BOSS_EXPANSION`; no other change.
- **Art:** add 10 vivid, name-free visual descriptors to `BOSS_VISUAL` in
  `scripts/sdart/prompts.mjs`; generate boss sprite sheets via
  `npm run gen:sprites:anim -- --only=boss` (z-image-turbo, the sole art pipeline);
  add `boss__<id>` entries to `spriteManifest.ts` and commit the PNGs. Matches the
  existing 256×256 multi-frame boss contract. (If a boss has no art key,
  `ensureSprite` returns null and it renders invisibly but still functions — so art
  is required for visibility and is part of Done.)
- **Codex:** all ten are `archetype: "Boss"`, so `ARCHETYPE_INFO["Boss"]` and
  `enemyTags` already describe them in the compendium — no `enemyInfo.ts` change
  needed (tags like Enrages/Summons/Disables-towers surface automatically).

## 8. Testing (TDD)

No new engine logic → the tests are **data-validation + invariant** tests (RED
before the defs/wiring exist, GREEN after):

- `tests/antiheroBosses.test.ts`:
  - each of the 10 passes `validateEnemy`, is `archetype: "Boss"`, `immunity: null`,
    and carries its designed mechanics (e.g. `gravemourn` has both `boss.enrage`
    and `special.frenzy`; `vindicator` has `special.attacksTowers` and no enrage;
    `ashghost` has enrage + summon + towerDisable + a quake skill).
  - each has a `boss__<id>` key in the sprite manifest.
  - `castleLeakDamage` returns `BOSS_CASTLE_DAMAGE` for each.
  - a smoke sim: spawn each boss via `world()`/`runFor`, assert it ticks without
    throwing and its mechanics fire (e.g. summoner produces adds; disabler sets a
    tower `disabledTimer`).
- `tests/bossPlacement.test.ts` (or extend existing wave tests):
  - `BOSS_BY_STAGE.length === 30`; all 10 new ids present.
  - **monotonic law:** within each chapter (stages 11–15, 16–20, 21–25, 26–30) the
    five finals ascend by base HP.
  - `midBossFor(n)` rank ≤ final-boss rank for every stage 1–30.
- Existing `tests/bosses.test.ts`, `tests/boss-skill.test.ts`,
  `tests/waveStructure.test.ts` must stay green (regression guard).

## 9. Risks & Cheapest Falsification

- **Risk: a boss combo is oppressive (un-fun lock-out).** The two tower-disablers
  (`sundermark`, `fallenward`) could chain-silence a build. _Mitigation:_ neither
  doubles disable+pulse; the hero (immune to disable) is always the answer.
  _Falsify:_ CDP self-playtest a ch4/ch5 stage and confirm towers recover between
  disables and the fight is winnable with a normal roster.
- **Risk: difficulty non-monotonic** (a heavier mid-boss than finale). _Falsify:_
  the §8 invariant test over all 30 stages — automated, runs every suite.
- **Risk: art mismatch / invisible boss.** _Falsify:_ assert every new boss has a
  `boss__<id>` manifest key (test) + a CDP playtest screenshot showing it on-field.
- **Risk: balance — `ashghost` too brutal at stage 30.** _Falsify:_ CDP playtest
  stage 30; confirm a maxed intended roster can clear within the wave timer (TTK
  sanity: state assumed hero+squad DPS vs scaled EHP).

Smallest experiment that would falsify the whole feature: launch ch5-s30 in CDP,
confirm `ashghost` spawns, renders, fires all four mechanics, and the stage is
beatable — with **zero console errors**.
