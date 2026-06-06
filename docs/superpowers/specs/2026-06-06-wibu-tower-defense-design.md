# Wibu Tower Defense — Design Document

**Date:** 2026-06-06
**Status:** Design approved
**Type:** Collectible / meta-progression tower defense game

---

## 1. Vision

A 2D, lane-based tower defense game with a collectible-character ("gacha") meta layer.
The player commands a **mobile hero** (an RPG character they reposition in real time) that
defends a central **castle**, supported by a squad of **collectible anime-homage characters**
deployed as **static auto-attacking towers**. The game is **web-first** (browser) and built
so it can be **ported to Android and iOS** with minimal rework.

**Core hook:** Static towers handle the lanes; the mobile hero is the universal "soft answer"
that provides target priority, body-blocking, and burst that static towers can't — but the hero
can only be in one place at a time, creating constant positional tension.

### Theme & IP constraint (decided, non-negotiable)
- Characters are **original** — original names and traits — *inspired by* famous anime of all
  eras, but **never copying** real characters' names, likenesses, or signature elements.
- Rationale: using real anime characters in a monetized game is copyright/trademark
  infringement (confirmed by research). Original "archetype-homage" characters are the legally
  safe, industry-standard path and the data/art pipeline is identical.

---

## 2. Platform & Technology

| Concern | Decision | Why |
|---|---|---|
| **Engine** | **Phaser 3** | Tiny web bundle (<1 MB engine), genre-proven for TD, MIT-licensed |
| **Language** | **TypeScript** | Type safety for a data-heavy game; largest community |
| **Mobile port** | **Capacitor** | Official Phaser→iOS/Android path; wraps the web build, one codebase |
| **Save (v1)** | **Local** behind a `SaveProvider` interface | Fast to a fun game; cloud sync drops in later |
| **Backend (later)** | REST/HTTP cloud sync; accounts | Deferred; the save interface keeps it clean |

Researched alternatives rejected: PixiJS (renderer-only), Godot (heavy web bundle + iOS audio
crash bug), Unity (WebGL no official mobile-browser support), Flutter+Flame (trails on entity
counts).

---

## 3. Game Pillars

### 3.1 The Hero (persistent RPG character)
- Persistent, account-wide. Max level **100**. Mobile; auto-attacks ground & air in range.
- **Active skill:** 1 equipped slot. A single **mana bar** fills and the equipped active skill
  **auto-casts when full.** Mana from on-hit, on-kill (killer only), potion drops, + regen.
  Equippable active skills **drop** from enemies/bosses and **level up through use** (use-XP).
- **Passive skills:** branching tree, unlocked on level-up, ranked with skill points (1/level).
- Death = loss (with castle HP = 0).

### 3.2 Hero Items (ARPG itemization)
- Two axes: persistent **equipment** + in-run **consumables**.
- **10 slots:** Weapon, Helmet, Body Armor, Gloves, Boots, Amulet, Ring ×2, **Pet, Wing**.
- **Pet** carries **utilities** (e.g., passive **gold generation** — this replaces dedicated
  economy towers). **Wing** is a movement/utility slot.
- **Equipment changes the hero's appearance** (each item carries an appearance overlay).
- Every item rolls **±10%** off fixed base stats. Each item **type** has a built-in **primary
  affix** (Staff→+magic dmg, Bow→+atk speed/crit, Sword→+phys dmg) and a **per-type affix pool**.
- **Rarity gates affix count AND quality** (Common→Magic→Rare→Legendary→Unique, up to ~4 affixes).
  Legendary/Unique may carry **mechanic-altering** affixes. Higher rarity always wins.

### 3.3 Towers (collectible characters)
- Each tower IS an anime-homage character. **Three power axes:**
  1. **Rarity** — intrinsic to the character.
  2. **Level** — per-tower, capped at the hero's level.
  3. **Stars** — duplicates raise star rank; **stars only boost base stats** (skills don't level
     from stars — skill strength scales with stats, notably Skill Power).
- **Abilities:** **1–3 predefined passive skills** + **1 active skill** that **auto-casts on
  full mana** (towers have their own mana bar; gain mana on-hit + on-kill (killer) + regen).
- **Roles (6):** damage, splash, chain, dot, support/buff, debuff/CC. *(Economy/gold is no
  longer a tower role — gold generation moved to the Pet item slot.)*
- **Roster rule:** every role has **at least one character of each rarity**, and a character's
  rarity & stats **track its source archetype's power level** (a famously weak character is
  Common; a top-tier powerhouse is Unique).
- Combat axes: target (ground/air/both), range & attack speed.
- Towers are **static** but **have HP and are destructible**.
- **Range is the dominant stat** — long-range must be balanced carefully; short-range must hit
  harder or bring utility.

### 3.4 Damage & Resistance System
- **3 damage types:** Physical (cut by armor), Magic (cut by magic-resist), **True** (ignores
  both, but reducible by flat Damage Reduction).
- **Basic attacks are Physical or Magic only.** **True damage comes only from skills**
  (a passive/active skill or a skill-applied DoT) — it is the special payoff of high-rarity kits.
- **Enemy immunity rule:** immune to **at most ONE** of {Physical, Magic, CC, AoE/Splash} —
  enforces "no lock-and-key": an immune enemy always has other valid answers.
- Armor is **partial** mitigation, never full negation.

### 3.5 Collection & Acquisition
- **Gacha/summon** (soft + premium currency; dupes → stars), **campaign drops + shop**
  (guaranteed progression), and **achievement/quest unlock** characters (prestige goals).
- v1: local save → summon economy is offline/free; monetization deferred.

### 3.6 Battle Loop
- **Squad size: 7** towers per campaign.
- **In-battle gold** from kills to place & upgrade towers during the match.
- Fixed **lane(s)** to the castle; **flying units beeline the castle** (not immune to all ground
  towers; hero has anti-air reach; dedicated anti-air is *better* vs air, not *exclusive*).
- **Fixed waves** per stage, with a **mid-boss** and a **final boss** (mid-boss teaches one
  mechanic, final boss combines two).
- **Win** by surviving all waves; **lose** if castle HP = 0 OR the hero dies.

### 3.7 Enemies (12 archetypes + bosses)
Rusher, Brute, Bulwark, Mender, Regenerator, Splitter, Gargoyle, Storm-Flyer, Sapper, Phantom,
Summoner, Raider (+ optional Courier). Boss mechanics: Tower-Disabler, Summoner/add-spawn,
Seeking AoE vs towers, Timed Enrage, Armor Phases. **No lock-and-key / no stat-check-only /
no strictly-dominant solutions.**

### 3.8 Campaign Structure
- **Chapters → stages** on a **world map.** Chapter = a themed region; stages are distinct
  layouts in that region. **Replayable & farmable**, **difficulty tiers** (Normal/Hard/Nightmare).
- **v1: 1 chapter, 10 stages.**

### 3.9 Art Direction
- **8-bit / pixel-art**, **AI-generated**, authored **last** from finished data catalogs.
- Canonical sprite dimensions, disciplined palette, animation frames (idle/attack/hit/death),
  reusable AI-gen prompt template. Strong, distinct silhouettes per role/rarity.

---

## 4. Canonical Stat System (24 numeric stats)

- **Offense:** ATK, Attack Speed, Crit Rate, Crit Damage, Range, Armor Pen, Magic Pen, Skill Power
- **Defense:** Max HP, HP Regen, Armor, Magic Resist, Damage Reduction (cuts all incl. True),
  Tenacity (cuts CC duration)
- **Resource (hero + towers):** Max Mana, Mana Regen, Mana-on-Hit, Mana-on-Kill, Mana-Cost-Reduction
- **Sustain:** Omnivamp (heal % of all damage dealt)
- **Utility:** Move Speed, Gold Find
- **Categorical:** Damage Type (Phys/Magic/True), Target (Ground/Air/Both), Enemy Immunity
  (one of Phys/Magic/CC/AoE)

Deferred to a later phase: Dodge/Evasion + Accuracy.

---

## 5. Architecture Principles

- **Data-driven content.** Characters, items, enemies are plain data the game reads at runtime.
  Balance & playtest with placeholder shapes before any art exists.
- **Isolated, testable units:**
  - **Combat core** (`src/core`) — pure TypeScript, no Phaser: pathing, targeting, damage,
    mana, economy, wave runner, the headless `BattleState` simulation.
  - **Content catalogs & schemas** (`src/data`) — typed defs + validators + placeholder catalogs.
  - **UI/scenes** (`src/scenes`) — thin Phaser layer that renders `BattleState` and feeds input.
- **Error handling:** validate catalogs against schemas at load (fail loud in dev); guard
  save/load with versioned migrations; never crash the battle loop on one bad entity.
- **Testing:** unit-test pure logic headlessly (damage, mana, economy, pathing, targeting,
  waves, full battle sim) without Phaser rendering.

---

## 6. Build Roadmap (each phase: spec → plan → implementation)

1. **Phase 1 — Playable core (THIS PHASE).** Phaser+TS skeleton; one stage; lane + flying
   pathing; placeholder towers; mobile hero; in-battle gold; waves + a boss; castle HP & win/lose.
   *Squares for art.* Goal: prove the loop is fun.
2. **Phase 2 — Content & data systems.** Full schemas + catalogs (30–40-character roster), the
   3-damage-type system, 12 enemies, 10 stages, difficulty tiers.
3. **Phase 3 — Meta-progression.** Hero leveling/passive tree/active skills/items; tower
   collection/stars/leveling; acquisition (gacha/drops/unlocks); local save layer.
4. **Phase 4 — Art & polish.** 8-bit pixel design system + AI art pipeline; audio & UX.
5. **Phase 5 — Mobile port & backend.** Capacitor wrap (iOS/Android); cloud-sync backend; accounts.

---

## 7. Open Questions / Deferred Decisions

- **Numeric tuning** (DPS curves, HP/armor scaling, gold-per-kill, mana costs) — needs playtesting.
- **Tower target priority** — player toggles vs hero-driven re-allocation. Decide in Phase 1 playtest.
- **Consumables design** — relationship to persistent gear.
- **Currency naming & monetization** — deferred to meta/online phases.
- **Exact 30–40 roster** — authored in Phase 2.
