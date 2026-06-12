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
- [x] **T17** Click tower → passive/active skill descriptions; hover skill → tooltip.
- [x] **T6** Per-character weapon-based attack visuals (arrows / fireball / iceball / lightning / slash …).
- [x] **T7** Active-skill visuals designed from each skill's description.
- [x] **T8** Enemy status visuals (burning / freezing / slowing / poison …).
- [x] **T9** Stealth reveal rule (towers hit revealed stealth) + hidden/spotted visuals. (9f44a7e)
- [ ] **T4** Squad UI redesign: 7 active slots + collected-character inventory with drag/drop + filter/sort.
- [x] **T13** (core; UI pending) Item enhance system (MU-style): bless jewel +1..+6 (100%), soul jewel +7+ (−10%/lvl, fail drops 1–5 levels); each level boosts primary stat + primary affix.
- [x] **T14** Hero loadout inventory filter (items / materials / boxes).
- [x] **T15** (core; open-box UI pending) Boss chests guaranteed per clear, 5 tiers, balanced loot. (5947718)
- [x] **T16** Boss mana + active skills (quake/rally/barrier/summon-surge). (98796e7)

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

## Remaining work (post-compaction continuation notes)

- **Inventory UI pass (HeroScene)** — wires up already-built systems: T13 enhance
  (click item → enhance panel: shows +level, success %, jewel counts, Enhance btn
  via saveManager.enhanceItem), T14 filter tabs (All/Weapon/Armor/Accessory +
  Materials + Boxes), T15 open-box (click a box → saveManager.openBox → reward
  popup). Show materials/box counts. Item tiles should show their +enhanceLevel.
- **T17** tower skill tooltips — BattleScene tower panel: list passives (PASSIVE
  defs?) + active (ACTIVE_SKILLS_MAP) descriptions + upgradeSummary(role); hover
  → tooltip. (Passive skill defs: check where tower `passives` ids resolve.)
- **T6** per-character attack visuals — add attackFx style (derive by role/dmgType/
  name OR per-tower field), emit `style` on the attack FxEvent, render distinct
  projectile/melee per style in fx.ts (arrow/fireball/iceball/lightning/slash/cannon/poison/holy).
- **T7** active-skill visuals — improve skillBurst to vary by skillId/description.
- **T18** skill-icon SVG system (use svg-asset-gen) → icons for every passive/active.
- **T1** passive tree nodes render those icons.
- **T4** Squad UI redesign — 7 slots + collected-characters inventory drag/drop + filter/sort.

Helpers already available: towerUpgrade.upgradeSummary(role); enhance.\*; boxes.openBox;
materials MATERIALS_MAP/BOX_TIERS; crispText/makeCrisp; fx.starUp.

## Progress log

- 2026-06-07: Roadmap v2 created. Starting from 258 tests, build green. Head 0d550a6.
- 2026-06-07: T3 (hero/UI click), T2 (crisp text), T12 (per-role upgrades) done. 267 tests.
- 2026-06-07: T5/T10/T11 (tower badge/stars/upgrade FX), T9 (stealth), T8 (status visuals),
  T13 core (enhance), T16 (boss skills), T15 core (boss boxes). 284 tests. Head 5947718.
  Done: T2,T3,T5,T8,T9,T10,T11,T12,T13(core),T15(core),T16. Left: T1,T4,T6,T7,T14,T17,T18 + T13/T15 UI.

## Post-session additions (2026-06-07 continued)

- **T18** Skill-icon system: procedural 24×24 glyphs in skillIcons.ts (T1 + tower panel badge). (c7aea1f)
- **T1** Passive tree icons: region-themed glyphs on every node. (c7aea1f)
- **Item art gap** (new task): 130 → 125 → all items being generated via SDXL (gen-items-full.mjs); manifest rebuilt after generation.
