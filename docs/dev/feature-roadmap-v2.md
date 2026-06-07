# Feature Roadmap v2 — 18-task delegated build (2026-06-07)

Full autonomy. Per task: brainstorm → plan → TDD where logic exists → playtest-verify
→ careful commit. This doc is the source of truth and survives context compaction.
Update the checkbox + log when a task lands.

## Conventions
- One focused commit per task (conventional commits).
- Keep `npm run typecheck`, `npm test`, `npm run build` green at every commit.
- Logic (sim/economy) gets vitest TDD; pure-visual gets CDP playtest screenshots.
- Skill/tower/terrain icons authored via the `svg-asset-gen` skill family (SVG).

## Tasks
- [x] **T3** Fix hero moving to corner when clicking UI — guard scene pointerdown when over a UI object. (cf3ffc2)
- [x] **T2** In-battle UI text: crisp high-DPI (crispText: resolution + LINEAR + stroke). (26b97f4)
- [x] **T12** Per-tower upgrade design (towerUpgrade.ts; role emphasis + behavior scaling). (3d543ba)
- [x] **T11** Star pips on placed towers. (c269367)
- [x] **T10** Upgraded towers: gold aura + sprite grow + star-up burst FX. (c269367)
- [x] **T5** Tower type badge (melee/ranged + role) on map + build bar. (c269367)
- [ ] **T18** Skill-icon system: an SVG icon for every hero/tower passive & active skill.
- [ ] **T1** Passive tree nodes show skill icons (uses T18 icon system).
- [ ] **T17** Click tower → passive/active skill descriptions; hover skill → tooltip.
- [ ] **T6** Per-character weapon-based attack visuals (arrows / fireball / iceball / lightning / slash …).
- [ ] **T7** Active-skill visuals designed from each skill's description.
- [ ] **T8** Enemy status visuals (burning / freezing / slowing / poison …).
- [x] **T9** Stealth reveal rule (towers hit revealed stealth) + hidden/spotted visuals. (9f44a7e)
- [ ] **T4** Squad UI redesign: 7 active slots + collected-character inventory with drag/drop + filter/sort.
- [ ] **T13** Item enhance system (MU-style): bless jewel +1..+6 (100%), soul jewel +7+ (−10%/lvl, fail drops 1–5 levels); each level boosts primary stat + primary affix.
- [ ] **T14** Hero loadout inventory filter (items / materials / boxes).
- [ ] **T15** Boss-drop boxes: each boss guarantees a box scaled to its strength; balanced loot tables.
- [ ] **T16** Bosses gain mana + active skills (cast on mana threshold).

## Brainstorm decisions (per task) — filled as work proceeds

### T12 — per-role in-battle upgrade plan (src/core/towerUpgrade.ts)
Each purchased star stacks (1) a general bump every tower gets and (2) a
role emphasis (extra stat growth + scaled role behavior). Behavior is recomputed
onto the tower runtime (never mutating the shared def).
- **General (all roles)**: +6% atk, +5% maxHp per star.
- **damage** (e.g. yamo, zoran, prince-vael): +4% atk, +5% range per star. Pure single-target DPS.
- **splash** (pip-powderkeg, iron-bo, kanae): +3% atk, +2% range; splash radius +10%/star.
- **chain** (tobi, zeni, hyo): +5% range; +1 bounce at ★2 and ★4; chainFalloff +0.04/star (keeps damage on bounces).
- **dot** (bram, kona, shion): +3% range; dot dps +12%/star, dot duration +0.15s/star.
- **debuff** (doro, shika, glace): +6% range (big — catch more lane); slow +5%/star (cap 85%), slow duration +0.1s, stun chance +3%/star & +0.05s.
- **support** (mochi, lyra, orin): +5% maxHp, +3% range; buff aura radius +8%/star, +3% atk aura, +2% atkspd aura per star.

## Progress log
- 2026-06-07: Roadmap v2 created. Starting from 258 tests, build green. Head 0d550a6.
- 2026-06-07: T3 (hero/UI click), T2 (crisp text), T12 (per-role upgrades) done. 267 tests.
