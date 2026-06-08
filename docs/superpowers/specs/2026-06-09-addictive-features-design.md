# Addictive Features & Mechanics — Design Spec

Date: 2026-06-09
Author: game-designer lens (Wibu Tower Defense)

## Goal

Add a coherent suite of ≥15 systems that deepen the **meta**, **run**, and **moment**
loops to raise retention and "addictiveness" — *without* fracturing the economy or
bolting on parallel currencies. Every feature below passes the Relevance Filter
(Clarity / Motivation / Response / Satisfaction / Fit) and **reuses existing faucets/sinks**
(gold, diamonds, materials) per the Numbers Policy. New materials are added only where an
existing one genuinely can't carry the job.

Design principles applied:
- **Guaranteed spine + variable sprinkle** (reward schedules) — daily/streak give a reliable
  backbone; spins/banners/drops add variance with fair pity.
- **Friction = meaning** — sinks (Awakening, Alchemy, respec) keep currencies aspirational.
- **Each system feeds a Bartle type** — Achievers (milestones, mastery), Explorers (synergy,
  bestiary), Killers (endless, boss rush, combo), Socializer-lite (profile/titles).
- **Moment-loop juice** — combo meter, perfect-wave, loot fanfare make seconds feel good.
- **No silent actions** — every claim/spin/streak/combo emits immediate feedback.

## Architecture

All systems follow the established pattern:
- **Core logic** = pure functions in a focused `src/core/<feature>.ts` module (<500 lines),
  operating on `HeroSave`. Fully unit-tested headless (Vitest).
- **Data/catalog** = `src/data/<feature>.ts` where a feature needs definitions (milestones,
  synergies, banners, challenge modifiers, bestiary thresholds).
- **SaveManager** = thin wrappers that call the core fn and `persist()`.
- **Save schema** = one migration `v9 → v10` adds every new field with defaults; defensive
  backfill in `loadAndMigrate` mirrors each.
- **UI** = battle-integrated features hook `battle.ts`/`BattleScene.ts`; meta features get a
  new **ActivitiesScene** hub + menu wiring, plus light surfacing in existing scenes.

### New save fields (added in one v10 migration)

```
meta: {
  streak: { count, lastClaimDate, cycleClaimedToday },      // F1 login streak
  expedition: { startedAt, towerIds, lastCollectAt },        // F2 idle
  bounties: { weekKey, progress, claimed },                  // F3 weekly
  spin: { lastSpinDate, pityCount },                         // F4 lucky spin
  challenge: { dayKey, modifierId, cleared },                // F5 daily challenge
  mastery: Record<towerId, { xp, level }>,                   // F6 tower mastery
  awakening: Record<towerId, number>,                        // F7 awakening rank
  bestiary: Record<archetype, number>,                       // F9 kill counts
  banner: { sparks, pity, pickedFeaturedId },                // F10 spotlight/spark
  endless: { bestWave: Record<stageId, number> },            // F11 survival best
  bossRush: { weekKey, bestTier },                           // F12 weekly ranked
  milestones: Record<milestoneId, claimedTier>,              // F15 achievements
  profile: { titleId, lifetimeKills, lifetimeClears },       // F16 profile/titles
}
```
Battle-only state (combo, perfect-wave) lives in `BattleState`, not the save.

## Features

### F1 — Login Streak Calendar
**Loop:** Meta. **Bartle:** Achiever. **Feeling:** "don't break the chain."
Consecutive calendar-day logins advance a 7-day cycle (escalating gold→diamonds→scroll→
Bless→diamonds→Soul→**Spotlight pull**), looping; a 30-day counter grants a milestone
(Awakening Crystal). Missing a day resets `count` to 1. Reuses `grantDailyLogin` timing.
Numbers: day-7 ≈ 1 free pull of value; anchored so a perfect week ≈ +1 ten-pull/month.

### F2 — Idle Expedition (offline rewards)
**Loop:** Meta. **Bartle:** Achiever. **Feeling:** "it grew while I was away → come back."
Dispatch up to 3 owned towers on an expedition tied to highest cleared chapter. Accrues
gold + a chance at materials per real-time hour, **capped at 8h** (anti-AFK-tax). Collect on
return. Rate = `f(chapter) · towerPower`. Pure faucet, gated by cap so it can't replace play.

### F3 — Weekly Bounty Board
**Loop:** Meta. **Bartle:** Achiever. Bigger targets than dailies (kill 300, clear 20,
summon 20, enhance 15), reset Monday (ISO week key). Premium rewards (diamonds, Awakening
Crystal, Spotlight pull). Reuses the quest-tracker increment keys already emitted in battle.

### F4 — Daily Lucky Spin
**Loop:** Meta. **Bartle:** all. **Feeling:** variable-ratio dopamine, fair.
One free spin/day on a weighted wheel (gold / diamonds / materials / rare jackpot). Pity:
guaranteed rare-tier prize every 7 spins. Extra spins purchasable for diamonds (sink).

### F5 — Daily Challenge Modifier
**Loop:** Run. **Bartle:** Killer/Explorer. One stage/day rolls a modifier (e.g. +50% enemy
speed & +2× loot; "glass" enemies +HP −armor; tower-cost discount). First clear/day → bonus
chest + diamonds. Variety + a daily reason to fight. Modifier applied as battle multipliers.

### F6 — Tower Mastery
**Loop:** Meta (earned in Run). **Bartle:** Achiever/Explorer. **Feeling:** "my main grows."
Each tower banks mastery XP from kills *while deployed*. Mastery levels (curve, soft cap 10)
grant small permanent `+% atk/hp` to that tower + a visible star-glow tier. Long-tail per-unit
investment that rewards maining favorites. Anchored: lvl10 ≈ +20% (≈ one star's worth, slow).

### F7 — Awakening (post-5★ top-end chase)
**Loop:** Meta. **Bartle:** Achiever/Killer. Beyond 5★, spend **Awakening Crystals** (new
material — justified: a top-end sink no existing material fills) + dupes to raise an Awakening
rank (0→3). Each rank: bigger stat bump + unlocks the tower's signature passive amplification.
The end-game whale-chase that keeps maxed collections meaningful.

### F8 — Squad Synergy / Set Bonuses
**Loop:** Run (decided in Meta). **Bartle:** Explorer. **Feeling:** build discovery / autonomy.
Squad composition grants team buffs: role bonds (3+ same role), rarity sets (full Legendary),
and homage "faction" tags. Bonuses are stat auras applied at battle start. Makes squad choice a
real decision (kills fake-choice anti-pattern) and rewards collection breadth.

### F9 — Bestiary
**Loop:** Meta (earned in Run). **Bartle:** Killer/Explorer. Tracks kills per enemy archetype;
crossing thresholds (50/250/1000) grants permanent `+% damage vs that archetype` + lore unlock.
Turns grinding into measurable mastery. Counts incremented in the sim on kill.

### F10 — Spotlight Banner + Spark (wishlist pity)
**Loop:** Meta. **Bartle:** Achiever/Killer. **Feeling:** fair chase for a *specific* unit.
A rotating featured character has boosted odds within its rarity. Every pull (any source) grants
1 spark; **200 sparks → pick any featured Unique** (hard guarantee). Fixes "lost-50/50" churn.
Reuses existing gacha; adds spark counter + featured-rate tilt.

### F11 — Endless Survival Mode
**Loop:** Run. **Bartle:** Killer/Achiever. **Feeling:** "one more wave." On any cleared stage,
launch endless: waves scale exponentially, no win — score = waves survived. Personal best per
stage saved; milestone wave rewards (every 5 waves → diamonds/material). Pure replayability +
a number to beat.

### F12 — Boss Rush / Trial of Champions (weekly)
**Loop:** Run. **Bartle:** Killer. A weekly gauntlet of bosses back-to-back; furthest tier
reached → ranked reward tier (reset Monday). Best-tier persisted. High-skill expression sink for
a maxed roster.

### F13 — Kill-Streak Combo Multiplier
**Loop:** Moment. **Bartle:** Killer. **Feeling:** escalating dopamine. Rapid consecutive kills
build a combo meter (decays ~2.5s). Multiplier ramps gold/score (×1 → ×3). Escalating on-screen
combo text + sfx. Pure juice that makes the second-to-second loop feel great. Lives in BattleState.

### F14 — Perfect Wave / No-Leak Bonus
**Loop:** Moment/Run. **Bartle:** Killer/Achiever. Clearing a wave with zero leaks → "PERFECT!"
+ bonus gold; a full no-leak stage → bonus chest. Rewards skilled play, adds a self-set goal.

### F15 — Milestone Achievements (tiered overhaul)
**Loop:** Meta. **Bartle:** Achiever. Replaces the 2-flag system with a broad tiered track
(lifetime kills, clears, summons, enhances, collection %, endless wave, mastery). Each milestone
has tiers (I/II/III) → diamonds/materials/**titles**. The completion engine that gives long-term
goals. Old tower-unlock achievements preserved as special milestones.

### F16 — Player Profile, Power Rating & Titles
**Loop:** Meta. **Bartle:** Socializer-lite/Achiever. **Feeling:** identity + a single number to
grow. Aggregates roster+gear+hero into one **Power Rating**; profile card shows level, power, best
endless wave, collection %, equipped **title** (earned from milestones/endless/boss-rush). Titles
are pure expression; power rating gives Achievers a north-star metric.

### F17 — Loot Rarity Fanfare (feedback escalation)
**Loop:** Moment. **Feeling:** "no silent actions." Drops emit escalating feedback by rarity:
beam color, particle burst, screen flash + sfx pitch for Legendary/Unique. Pure satisfaction
layer on the existing drop events. (BattleScene FX only — no save.)

### F18 — Alchemy / Surplus Exchange
**Loop:** Meta. **Bartle:** Achiever. **Feeling:** "nothing is wasted." Convert surplus low-tier
materials (e.g. 5 Bless → 1 Soul) and **excess dupe copies** of maxed towers → Awakening Crystals
or scrolls, at deliberately lossy rates (friction = meaning). A sink/smoother that respects the
economy and gives overflow a purpose. Anchored lossy (5:1) so it never trivializes drops.

## Numbers Policy notes (control points, not full tables)

- **Streak day-7 value ≈ one summon (160💎-equivalent).** A perfect 28-day month ≈ 4 spotlight
  pulls — meaningful, not game-breaking.
- **Idle cap 8h**, rate anchored so 8h ≈ one Normal stage's gold — a top-up, never a replacement.
- **Mastery lvl10 ≈ +20% tower atk** (≈ one star), reached only via heavy maining (XP curve
  power `a·n^1.6`). One knob: per-kill mastery XP.
- **Awakening rank 3 ≈ +30% + signature amp**, costing ~30 crystals total — a months-long chase.
- **Spark hard pity = 200 pulls** for a featured Unique — generous enough to never feel hopeless.
- **Combo cap ×3** so it boosts but never dominates the gold economy; decay 2.5s keeps it earned.
- **Alchemy 5:1 lossy** everywhere — overflow valve, not a faucet.

Express balance as **ratios**; document intent beside each constant. One knob at a time when tuning.

## Testing & risk

- Every core module ships Vitest unit tests (claim gating, date rollover, pity, caps, idempotency,
  persistence across reload). Target: keep the suite green at every commit.
- Save migration test: a v9 save loads to v10 with all `meta` fields defaulted; backfill covers
  partial saves (the documented dev-save hazard).
- Risk: economy inflation from new faucets. Mitigation: caps (idle 8h, one spin/day, combo ×3,
  weekly cadence) + lossy Alchemy sink + Awakening/Endless sinks. Verify post-build with
  `window.__game` self-playtest that combo/perfect/fanfare actually fire and claims persist.
- Risk: scope. Mitigation: ship as independent modules behind one migration; each commit is a
  self-contained, tested feature so the build stays releasable throughout.

## Build order (waves, green build per commit)

1. Save v10 migration + `meta` scaffolding + defensive backfill (foundation).
2. F1 streak, F4 spin, F3 bounties, F5 challenge (daily/weekly core + tests).
3. F6 mastery, F9 bestiary, F8 synergy (battle-earned progression + tests).
4. F7 awakening, F10 spark/banner, F18 alchemy (gacha/sinks + tests).
5. F2 idle expedition, F11 endless, F12 boss rush (modes + tests).
6. F15 milestones, F16 profile/power/titles (meta engine + tests).
7. Battle juice: F13 combo, F14 perfect-wave, F17 loot fanfare (sim + FX).
8. UI: ActivitiesScene hub + menu wiring + light surfacing in existing scenes.
9. Full verify (typecheck/test/build/self-playtest), commit.
