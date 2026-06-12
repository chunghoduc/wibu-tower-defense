# Design: Bosses Halt to Siege Towers (and a Tank Tower Can Hold Them)

Date: 2026-06-12
Status: Approved (full-auto session — design decisions made by the agent on the owner's behalf)

## Problem

Two coupled issues with how bosses interact with the player's towers:

1. **Bosses steamroll past towers.** `enemyTowerAttack()` (src/core/enemyCombat.ts)
   returns `whileMoving: true` for every boss, so a boss swipes a tower _in passing_
   and never halts. The marquee threat blows through the player's wall as if it
   weren't there — there is no "the boss is stuck on my front line" moment, and
   tank towers (whose entire job is to body-block) have nothing to block.

2. **Once a boss DOES stop on a tower, it would delete it instantly.** A boss's
   full per-hit damage is tuned for the hero/castle. If a boss parks on a tank
   tower and applies that full damage, even the tankiest tower pops in ~2–3 hits,
   so "stop and siege" would feel pointless — the tower is gone before the player
   can react.

The two are inseparable: making bosses _stop_ on towers is only good play if a
purpose-built tank tower can **hold the boss for a while** (buying the player time
to focus fire), rather than evaporating.

## Goal

- Ground bosses **halt and siege** the nearest tower in range instead of walking
  through it — the same "stop and demolish" stance dedicated sappers already use.
- A **tank-role tower can survive a boss for a meaningful window** (target: a
  rarity-appropriate `tanker` with a typical mid-game hero withstands a
  representative campaign boss for **≈8+ seconds / ≈8+ boss hits**, versus the
  ~2–3 hits full boss damage would allow), while still **eventually** breaking so
  the boss is delayed, not walled forever.
- Do not touch boss threat to the **hero or castle** (the just-shipped boss
  HP/ATK balance stays intact), trash/elite tower behavior, or the monotonic
  difficulty law.

## Approach (chosen)

Two small, surgical levers:

### A. Ground bosses stop to siege (one branch in `enemyTowerAttack`)

In the boss branch of `enemyTowerAttack()`, return `whileMoving: def.flying === true`
instead of the hard-coded `true`. Ground bosses (every boss in the roster today)
become **blocking** — they halt on the nearest in-range tower and demolish it,
exactly like a dedicated tower-killer. Flying bosses (none today, but the rule is
future-proofed) keep striking in passing, mirroring the existing flyer
tower-killer rule. The sim already routes `whileMoving:false` to "stop and
attack" via `chooseEnemyAction` → `blocking: !atk.whileMoving` → `if (!action.blocking) advance`,
so **no sim/loop change is needed** — only the profile flips.

### B. A boss→tower damage scalar (one constant, one multiply)

Add `BOSS_TOWER_DAMAGE_MULT` to battleTypes.ts and multiply it into the damage in
`dealDamageToTower()` **only when the attacker is a boss** (`attacker.def.boss`).
This scales down a boss's per-hit damage _against towers only_ — its hits on the
hero and castle (`dealDamageToHero`, castle damage) are untouched, so boss threat
to the things that end the run is unchanged. Sappers/raiders and ordinary melee
keep full tower damage; this is a boss-specific concession that makes the new
"stop and siege" behavior tactically meaningful.

**Value:** `BOSS_TOWER_DAMAGE_MULT = 0.4` (a boss does 40% of its hit to towers).
Chosen so a rarity-appropriate tank tower (high base HP + the `tanker` 1.6×
armor/MR/DR layer + the hero's 60% shared stats) holds a representative boss for
the ~8+ hit target, while still dying eventually. The exact figure is **locked by
a simulation test** (below) measured against a controlled boss/tank fixture, and
nudged if the probe shows the window is too short or effectively infinite.

### Alternatives considered

1. **Lower `bossAtkMult` in `DIFFICULTY_SCALING`.** Rejected: it also weakens the
   boss against the hero and castle — bosses _should_ still threaten what ends the
   run. We only want to soften boss-vs-tower.
2. **Give the `tanker` role flat boss damage reduction.** Rejected: a new
   role-conditional code path in the damage pipeline, and it would make _only_
   tank towers viable speed-bumps; a global boss→tower scalar lets any front-line
   tower buy a little time (a tank just buys the most), which reads better.
3. **Boss→tower scalar + ground bosses block (chosen).** Two constants/branches,
   no new damage-pipeline path, leaves hero/castle threat and the difficulty law
   untouched, and the survival window is test-locked.

## Components touched

- `src/core/enemyCombat.ts` — boss branch returns `whileMoving: def.flying === true`;
  doc-comment updated (bosses now siege).
- `src/core/battleTypes.ts` — new `BOSS_TOWER_DAMAGE_MULT` constant.
- `src/core/battleEnemies.ts` — `dealDamageToTower()` multiplies by the scalar
  when `attacker.def.boss`.

No data edits, no new files. The boss-HP balance and `DIFFICULTY_SCALING` are
untouched.

## Testing

Pure/sim tests, Phaser-free (run under the existing fixtures):

1. **Profile (unit, `enemyCombat.test.ts`):** a ground boss's profile is now
   `whileMoving:false` (it halts); a flying boss stays `whileMoving:true`. The
   range derivation (weapon → reach) is unchanged.
2. **Boss-vs-tower scalar (unit, `battleTypes`/new test):** `BOSS_TOWER_DAMAGE_MULT`
   is in `(0,1)` — a boss hits towers for _less_ than full, but more than nothing.
3. **Behavior — boss halts on a tower (sim, new `bossSiege.test.ts`):** a boss
   marching a lane with a tower in reach **stops** (its distance-along the route
   plateaus while the tower lives) and chips the tower, rather than walking past.
4. **Behavior — a tank tower holds a while, then falls (sim):** against a
   controlled boss fixture, a `tanker`-style tower survives **≥ a target number of
   boss hits** (the "a while" guarantee) AND is eventually destroyed (not an
   infinite wall). This is the test that pins `BOSS_TOWER_DAMAGE_MULT`.
5. **Boss still deletes the hero/castle at full rate (regression):** existing
   hero/castle damage tests stay green — the scalar must not touch them.

Plus the full suite (`npm test`), `tsc --noEmit`, and `npm run build` stay green.

## Out of scope

- Boss HP/ATK values, `DIFFICULTY_SCALING`, trash/elite tower behavior, the
  wave/progression curves, sapper/raider tuning, and any per-boss authoring.
- Visual/animation work for the "boss stops to siege" pose (the sim drives
  position; art is unchanged).
