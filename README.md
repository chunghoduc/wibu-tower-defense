# Wibu Tower Defense

A collectible, lane-based tower defense game. Web-first (Phaser 3 + TypeScript),
built to port to Android/iOS later via Capacitor.

> Full design: [`docs/superpowers/specs/2026-06-06-wibu-tower-defense-design.md`](docs/superpowers/specs/2026-06-06-wibu-tower-defense-design.md)

## Concept

A mobile **hero** you reposition in real time defends a central **castle**, backed
by a squad of **collectible character-towers** (static auto-attackers). Enemies
march fixed lanes; flyers beeline the castle. Three damage types (Physical / Magic /
True), an enemy single-immunity rule, in-battle gold economy, waves with a mid-boss
and final boss.

## Quick start

```bash
npm install
npm run dev        # local dev server (open the printed URL)
npm run build      # typecheck + production web bundle -> dist/
npm test           # run the test suite (vitest)
npm run typecheck  # tsc --noEmit
```

### How to play (Phase 1)

- **Tap a tower button** at the bottom (or press `1`–`4`) to select a tower.
- **Tap an empty slot** (circles along the lane) to build it — costs gold.
- **Tap anywhere else** to walk the hero there (it body-blocks and auto-attacks).
- Earn gold from kills. Survive all waves to win; you lose if the castle falls or
  the hero dies.

## Architecture

Logic is split from rendering so the game is testable headlessly:

| Path | Responsibility |
|---|---|
| `src/core/` | Pure game logic — no Phaser. RNG, pathing, damage, targeting, the `BattleState` simulation. |
| `src/data/` | Canonical schemas + validators and the (placeholder) content catalogs. |
| `src/scenes/` | Thin Phaser layer that renders `BattleState` and feeds it input. |
| `tests/` | Vitest unit + integration tests over the core logic. |

Content (characters, items, enemies, stages) is **plain data** validated at load,
so balancing and playtesting happen before any art exists.

## Status — Phases 1 & 2 complete

**Phase 1 — playable core:** project scaffold, the headless battle simulation
(lane + flying pathing, towers, mobile hero, gold economy, waves + boss,
win/lose), the 3-damage-type + single-immunity systems, and a battle scene.

**Phase 2 — content & data systems:**
- **All 7 tower roles** work: damage, splash, chain, dot, debuff (slow/stun),
  support (buff aura), economy (passive gold).
- **Enemy specials:** shields, heal auras, split-on-death, summons, stealth, and
  attacking towers — **towers are now destructible**.
- **Boss mechanics:** enrage, summon, tower-disable.
- **Status effects** (slow, stun, DoT) with tenacity, plus omnivamp sustain.
- **Difficulty tiers** — Normal / Hard / Nightmare scaling.
- **Content:** a 32-character roster (original homage designs across all roles &
  rarities), the 12 enemy archetypes + minions + bosses, and **10 stages** with a
  scaling wave generator (mid-boss from stage 4, a boss every stage).

**55 tests** cover damage, pathing, targeting, status effects, every new
mechanic, and content validation.

**Still simplified / next phases:** active skills remain a generic AoE burst
(per-character skill engine arrives with meta-progression). Next:
**Phase 3** meta-progression (hero leveling/passive tree/items, tower
collection/stars, acquisition, local save) → **Phase 4** 8-bit AI art →
**Phase 5** Capacitor mobile port + cloud backend.
