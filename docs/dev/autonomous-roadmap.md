# Autonomous Improvement Roadmap (2026-06-07)

Delegated long autonomous session. Full rights granted. Each task: design → implement →
tests/build green → playtest-verify → **careful git commit**. After the list, keep looping
to make the game great. This doc is the source of truth — update checkboxes + the log as work
progresses (survives context compaction).

## Conventions
- One focused commit per task (conventional commits, descriptive body).
- Keep `npm run typecheck`, `npm test`, `npm run build` green at every commit.
- Self-verify gameplay with the CDP playtest harness (`scripts/playtest/`).
- Regenerate art via `npx vite-node scripts/svgart/gen.mjs` when sprites change.

## Task checklist
- [x] **F0** Foundation: dev-only `window.__game`, reusable playtest harness, effects/anim helpers.
- [x] **T9** Starter crystals for ≥50 rolls (quick).
- [x] **T1** Combat feedback: projectiles for ranged towers; melee attack animation + impact effects; tower-skill effects.
- [x] **T11** Enemy feedback: hit flash, attack tell, death effect.
- [x] **T2** Tower interaction: click tower → upgrade / sell panel.
- [x] **T5** Loot drops: gold + item drop animations from killed enemies.
- [x] **T15** Boss animations (rig the bosses / animated boss sheets).
- [x] **T7** More bosses as famous anime homages; expand boss roster.
- [x] **T16** Stage select: enemy info "?" popup (full enemy list + specialties).
- [x] **T12** Battle tower bar = character avatars; drag & drop onto field.
- [x] **T13** Map terrain elements (stone, sand, water, jungle, mountain, ...). Brainstorm more.
- [x] **T14** Free placement anywhere except obstacle tiles.
- [x] **T6** Larger map via zoom-out / bigger play area + camera.
- [x] **T3** Fancy hero/active-skill animations & effects.
- [x] **T8** Squad management + hero active-skill selection screen.
- [x] **T4** Inventory UI like a real game; drag & drop items to equip.
- [x] **T10** +130 items with varied primary affixes.
- [x] **T17** Hero keyboard movement (WASD/arrows).
- [~] **LOOP** Brainstorm + add more; playtest; polish until great. (ongoing)

## LOOP polish — done
- Battle speed controls (Pause / 1× / 2× / 3×).
- Tower range preview on the placement ghost.
- Procedural Web-Audio SFX (attacks/hits/deaths/casts/loot/place/win/lose) + mute.
- **SVG terrain art** (replaces the circle-blob map features). New reusable
  `svg-asset-gen` skill (`.claude/skills/svg-asset-gen/`) authors deterministic
  top-down terrain SVGs; 18 assets (water/jungle/stone/mountain/grass/sand × 3)
  loaded via Phaser `load.svg()` and drawn in `BattleScene.drawStatic`.

## LOOP polish — ideas (next iterations)
- Extend `svg-asset-gen` to towers/props; parallax background from the same kit.
- Wave-incoming announcement + a "start next wave early" bonus.
- Castle + tower-placement-count HUD niceties; minimap for the larger world.
- More chapters/stages; difficulty-tier rewards; boss intro cards.
- Achievements screen; daily-reward calendar.
- Tower targeting-priority toggle (first/strongest/closest).
- Nicer terrain art (tiles instead of blobs); parallax background.
- Balance pass with the larger map + free placement (tune ranges/gold/wave HP).
- Hero appearance reflecting equipped weapon (variants exist in sdart pipeline).

## Progress log
- 2026-06-07: Roadmap created. Baseline playable, 224 tests. Commit `43195e2`.
- 2026-06-07: All 17 requested tasks (T1–T17) implemented with the full workflow
  (design → TDD where logic exists → playtest-verify → code review → commit).
  Highlights: FX/combat feedback, projectiles+skill effects, tower upgrade/sell,
  enemy attack tells, loot/gold animations, 10 anime-homage bosses (animated),
  enemy compendium, +130 items, squad/skill screen, drag-drop inventory, larger
  zoom-out world with dual cameras, terrain + free placement + drag-to-deploy
  avatars, WASD hero movement. Two subagent code reviews → fixes committed. Then
  LOOP polish (speed/range/audio). ~255 tests passing throughout. Heads ~6362306.
