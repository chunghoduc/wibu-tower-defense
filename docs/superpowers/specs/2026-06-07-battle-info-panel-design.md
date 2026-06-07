# In-battle UI redesign — right-side info panel (2026-06-07)

## Problem
In-battle informational text is unreadable. Root cause: the tower upgrade/sell
panel lives in the **world layer**, which is drawn by the zoomed-out battlefield
camera (~0.5×), so its text is rendered tiny. The HUD that IS in the UI layer is
fine, but cramped and spread thin.

## Goal
A persistent right-side info panel, full screen height, in the **UI layer**
(1:1 `uiCam`) so text is full-size and crisp. It shows:
- **Default (hero view):** hero portrait, level, HP/mana, full stat list, equipped
  items (with the new item icons + enhance level), equipped active skill.
- **Tower view (on tower click):** tower avatar, stars, HP/mana, full stat list,
  active skill + passives (names + descriptions), and Upgrade / Sell buttons with
  their gold cost / refund.
- Clicking empty battlefield (not the panel, not a tower) reverts to the hero view.

On the **map**, a clicked tower shows only **two compact quick-action icons**
(⬆ upgrade, ✕ sell) with their gold amounts, rendered in the UI layer at the
tower's screen position so they stay crisp. (Replaces the old world-space panel.)

## Layout (game canvas is 960×540)
- `PANEL_W = 286`; battlefield region width `BATTLE_W = 960 - 286 = 674`.
- **Main camera** viewport shrinks to `(0, 0, BATTLE_W, 540)`; world zoom-to-fit
  into that region. `uiCam` stays full-screen and ignores the world.
- **Right panel:** opaque rounded background at `x = BATTLE_W … 960`, `y = 0 … 540`.
- **Top HUD** (stage/gold/castle/hero/wave): top-left, wrapped to `BATTLE_W`.
- **Build bar:** bottom-left (7 tiles × 74 = 518 < 674 — fits).
- **Speed / mute buttons:** move into the panel's header row (top of panel).
- **Banner / end-game button / reward overlay:** centre on the battlefield region
  (`BATTLE_W/2`), not the full screen.

## Components
- **`BattleInfoPanel`** (new, `src/scenes/battleInfoPanel.ts`): presentational.
  - `showHero(vm)` / `showTower(vm)` — rebuild panel content for the view model.
  - `tick(live)` — update only dynamic bits (HP/mana bars, gold-affordability of
    the upgrade button) each frame; no per-frame object churn.
  - Owns Phaser objects parented to the UI layer; never reads battle state directly
    — the scene builds the view model and passes callbacks (onUpgrade/onSell).
  - View models:
    - `HeroPanelVM { name, level, hp, maxHp, mana, maxMana, stats[{label,value}],
      items[{slot,iconKey,name,plus}], skill{name,desc}|null }`
    - `TowerPanelVM { name, iconKey, stars, hp, maxHp, mana, maxMana,
      stats[{label,value}], skills[{label,desc,color}], upgradeCost, sellValue,
      maxed }`
- **BattleScene changes:**
  - Camera viewport + zoom use `BATTLE_W`.
  - Replace `openTowerPanel`/`closeTowerPanel`/`refreshTowerPanel`/`towerPanel*`
    world-space panel with: `selectTower(uid)` (build TowerPanelVM → panel.showTower
    + spawn 2 quick-action UI icons), `deselectTower()` (panel.showHero + remove
    icons). A `selectedTowerUid` field tracks selection.
  - `bindInput` pointerdown: tap a tower → selectTower; tap empty ground →
    deselectTower (+ existing hero move). Taps over UI widgets already bail
    (currentlyOver guard).
  - Quick-action icons: small UI-layer buttons at the tower's screen position
    (`worldToScreen` via main camera worldView + zoom). Upgrade (green ⬆ + cost),
    Sell (red ✕ + refund). Both call the same upgrade/sell as the panel buttons.
  - In `update()`, after sim tick, refresh the panel's live values and the
    quick-action affordability.

## Data sources
- Hero: `this.battle.hero` (stats, hp/mana) + `save.inventory.equipped` +
  `ITEM_CATALOG_MAP` (names) + `scaleStatsByEnhance` already applied in sim;
  panel shows item name + `+enhanceLevel`. Equipped skill via `save.hero.equippedSkillId`
  → `ACTIVE_SKILLS_MAP`.
- Tower: `TowerRuntime` (stats, battleLevel as stars, hp/mana, def) +
  `towerActiveInfo`/`passiveInfo` for skill rows + `upgradeCost`/`sellValue`.

## Out of scope / non-goals
- No change to the battle simulation. Pure presentation + camera viewport.
- No new tests (UI-only); verify via CDP screenshots (hero panel + tower panel +
  quick icons). Keep `npm run typecheck/test/build` green.

## Verification
- Screenshot the hero panel (default) and a selected-tower panel; confirm text is
  large and readable, battlefield not covered, build bar fits, quick icons appear
  on the tower. Confirm clicking empty ground reverts to the hero view.
