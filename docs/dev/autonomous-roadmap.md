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
- [ ] **T2** Tower interaction: click tower → upgrade / sell panel.
- [x] **T5** Loot drops: gold + item drop animations from killed enemies.
- [x] **T15** Boss animations (rig the bosses / animated boss sheets).
- [x] **T7** More bosses as famous anime homages; expand boss roster.
- [x] **T16** Stage select: enemy info "?" popup (full enemy list + specialties).
- [ ] **T12** Battle tower bar = character avatars; drag & drop onto field.
- [ ] **T13** Map terrain elements (stone, sand, water, jungle, mountain, ...). Brainstorm more.
- [ ] **T14** Free placement anywhere except obstacle tiles.
- [ ] **T6** Larger map via zoom-out / bigger play area + camera.
- [x] **T3** Fancy hero/active-skill animations & effects.
- [x] **T8** Squad management + hero active-skill selection screen.
- [x] **T4** Inventory UI like a real game; drag & drop items to equip.
- [x] **T10** +130 items with varied primary affixes.
- [x] **T17** Hero keyboard movement (WASD/arrows).
- [ ] **LOOP** Brainstorm + add more; playtest; polish until great.

## Progress log
- 2026-06-07: Roadmap created. Baseline: game playable (menu→stage→battle), animated pixel-art
  hero/enemy/tower sprites wired, starter squad granted, 224 tests pass. Commit `43195e2`.
