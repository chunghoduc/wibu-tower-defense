# Phase 4a — Scene Architecture + Save Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `SaveManager` into the Phaser game flow and add three new scenes (`MainMenuScene`, `GachaScene`, `CollectionScene`) so the Phase 3 meta-progression systems are playable in-browser.

**Architecture:** A `SaveManager` singleton is created in `main.ts` and stored in Phaser's `game.registry` so every scene can retrieve it with `this.registry.get("saveManager")`. `BattleScene` reads the save to filter the available squad and calls `afterBattle()` on win. `GachaScene` calls `afterSummon()`. `CollectionScene` and `MainMenuScene` are read-only consumers of the save. All scenes use placeholder text/shapes — no pixel art yet.

**Tech Stack:** TypeScript, Phaser 3, Vitest. `npm test` / `npm run typecheck` / `npm run build`.

---

## File Map

| Action | Path                            | Responsibility                                                                                                  |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Modify | `src/main.ts`                   | SaveManager singleton; register all 4 scenes; first scene = MainMenuScene                                       |
| Create | `src/scenes/MainMenuScene.ts`   | Title, crystal balance, nav buttons, daily login                                                                |
| Create | `src/scenes/GachaScene.ts`      | Crystal balance, pity bar, pull buttons, result cards                                                           |
| Create | `src/scenes/CollectionScene.ts` | Full tower roster grid — owned highlighted, unowned grayed                                                      |
| Modify | `src/scenes/BattleScene.ts`     | Read SaveManager from registry; squad from owned collection; `afterBattle()` on win; "← Menu" button on outcome |

---

## Task 1 — main.ts Bootstrap

**Files:** `src/main.ts`

- [ ] **Modify `src/main.ts`** to create the SaveManager singleton and register all scenes:

```ts
import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene.ts";
import { MainMenuScene } from "./scenes/MainMenuScene.ts";
import { GachaScene } from "./scenes/GachaScene.ts";
import { CollectionScene } from "./scenes/CollectionScene.ts";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/stage.ts";
import { SaveManager } from "./core/saveManager.ts";
import { LocalSaveProvider } from "./core/save.ts";

const provider = new LocalSaveProvider();
const saveManager = new SaveManager(provider);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1b2230",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainMenuScene, BattleScene, GachaScene, CollectionScene],
});

game.registry.set("saveManager", saveManager);
```

- [ ] **Typecheck:** `npm run typecheck 2>&1 | tail -10` — expect errors only for the missing new scene files (not yet created).

- [ ] **Commit:** `git add src/main.ts && git commit -m "feat(scene): register SaveManager in Phaser registry, add all 4 scenes"`

---

## Task 2 — MainMenuScene

**Files:** `src/scenes/MainMenuScene.ts`

- [ ] **Create `src/scenes/MainMenuScene.ts`**:

```ts
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");

    // Grant daily login crystals (idempotent — returns 0 if already claimed today)
    const today = new Date().toISOString().slice(0, 10);
    const crystalsGranted = mgr.grantDailyLogin(today);

    const save = mgr.getSave();
    const W = this.scale.width;

    this.add
      .text(W / 2, 90, "WIBU TOWER DEFENSE", {
        fontSize: "38px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 155, `💎 ${save.currency.crystals} Crystals`, {
        fontSize: "20px",
        color: "#90caf9",
      })
      .setOrigin(0.5);

    if (crystalsGranted > 0) {
      this.add
        .text(W / 2, 190, `+${crystalsGranted} daily login bonus!`, {
          fontSize: "14px",
          color: "#a5d6a7",
        })
        .setOrigin(0.5);
    }

    const buttons: { label: string; scene: string }[] = [
      { label: "▶  Play Battle", scene: "BattleScene" },
      { label: "✦  Summon Hall", scene: "GachaScene" },
      { label: "◈  Collection", scene: "CollectionScene" },
    ];

    buttons.forEach(({ label, scene }, i) => {
      const y = 270 + i * 80;
      const btn = this.add
        .text(W / 2, y, label, {
          fontSize: "22px",
          color: "#ffffff",
          backgroundColor: "#223355",
        })
        .setOrigin(0.5)
        .setPadding(24, 12, 24, 12)
        .setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setBackgroundColor("#335588"));
      btn.on("pointerout", () => btn.setBackgroundColor("#223355"));
      btn.on("pointerdown", () => this.scene.start(scene));
    });
  }
}
```

- [ ] **Typecheck:** `npm run typecheck 2>&1 | tail -10`

- [ ] **Commit:** `git add src/scenes/MainMenuScene.ts && git commit -m "feat(scene): MainMenuScene — title, nav, crystal display, daily login"`

---

## Task 3 — GachaScene

**Files:** `src/scenes/GachaScene.ts`

- [ ] **Create `src/scenes/GachaScene.ts`**:

```ts
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { HARD_PITY, MULTI_PULL_COST, SINGLE_PULL_COST, type SummonResult } from "../core/gacha.ts";
import { Rng } from "../core/rng.ts";
import { TOWERS } from "../data/towers.ts";

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

export class GachaScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private crystalText!: Phaser.GameObjects.Text;
  private pityText!: Phaser.GameObjects.Text;
  private pull1Btn!: Phaser.GameObjects.Text;
  private pull10Btn!: Phaser.GameObjects.Text;
  private resultContainer!: Phaser.GameObjects.Container;

  constructor() {
    super("GachaScene");
  }

  create(): void {
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    this.add
      .text(W / 2, 28, "✦ Summon Hall", {
        fontSize: "28px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 8, "← Back", { fontSize: "16px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    this.crystalText = this.add
      .text(W / 2, 72, "", { fontSize: "18px", color: "#90caf9" })
      .setOrigin(0.5);

    this.pityText = this.add
      .text(W / 2, 100, "", { fontSize: "14px", color: "#aaaaaa" })
      .setOrigin(0.5);

    this.pull1Btn = this.add
      .text(W / 2 - 140, 144, `1× Pull  (${SINGLE_PULL_COST} 💎)`, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#1a4a7a",
      })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });

    this.pull10Btn = this.add
      .text(W / 2 + 140, 144, `10× Pull  (${MULTI_PULL_COST} 💎)`, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#1a4a7a",
      })
      .setOrigin(0.5)
      .setPadding(14, 8, 14, 8)
      .setInteractive({ useHandCursor: true });

    this.pull1Btn.on("pointerdown", () => this.doPull(1));
    this.pull10Btn.on("pointerdown", () => this.doPull(10));

    this.resultContainer = this.add.container(0, 0);

    this.refreshUI();
  }

  private refreshUI(): void {
    const s = this.mgr.getSave();
    this.crystalText.setText(`💎 ${s.currency.crystals} Crystals`);
    this.pityText.setText(
      `Pity: ${s.currency.pityCount} / ${HARD_PITY}` +
        (s.currency.pityInsuranceActive ? "  ⚡ Insurance active" : ""),
    );
    this.pull1Btn.setAlpha(s.currency.crystals >= SINGLE_PULL_COST ? 1 : 0.4);
    this.pull10Btn.setAlpha(s.currency.crystals >= MULTI_PULL_COST ? 1 : 0.4);
  }

  private doPull(count: 1 | 10): void {
    const s = this.mgr.getSave();
    const needed = count === 1 ? SINGLE_PULL_COST : MULTI_PULL_COST;
    if (s.currency.crystals < needed) return;

    const results = this.mgr.afterSummon(count, new Rng(Date.now()));
    this.showResults(results);
    this.refreshUI();
  }

  private showResults(results: SummonResult[]): void {
    this.resultContainer.removeAll(true);

    const W = this.scale.width;
    const CARD_W = 84;
    const CARD_H = 96;
    const COLS = Math.min(results.length, 5);
    const GAP_X = 96;
    const ROW_H = CARD_H + 18;
    const START_Y = 190;

    results.forEach((r, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = W / 2 - ((COLS - 1) * GAP_X) / 2 + col * GAP_X;
      const y = START_Y + row * ROW_H;

      const def = TOWERS.find((t) => t.id === r.characterId);
      const hexStr = RARITY_HEX[r.rarity] ?? "#888888";
      const colorInt = parseInt(hexStr.replace("#", ""), 16);

      const bg = this.add.graphics();
      bg.fillStyle(colorInt, 0.18);
      bg.fillRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 8);
      bg.lineStyle(2, colorInt, 1);
      bg.strokeRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 8);

      const nameText = this.add
        .text(x, y + 10, def?.name ?? r.characterId, {
          fontSize: "8px",
          color: hexStr,
          wordWrap: { width: CARD_W - 6 },
          align: "center",
        })
        .setOrigin(0.5, 0);

      const rarityText = this.add
        .text(x, y + 48, r.rarity, {
          fontSize: "10px",
          color: hexStr,
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0);

      const starsText = this.add
        .text(x, y + 66, "★".repeat(r.newStars), {
          fontSize: "12px",
          color: "#ffd700",
        })
        .setOrigin(0.5, 0);

      const extras: Phaser.GameObjects.GameObject[] = [bg, nameText, rarityText, starsText];

      if (r.isNew) {
        const badge = this.add
          .text(x, y + CARD_H - 2, "NEW!", {
            fontSize: "9px",
            color: "#ffffff",
            backgroundColor: "#c0392b",
          })
          .setOrigin(0.5, 1)
          .setPadding(3, 1, 3, 1);
        extras.push(badge);
      }

      this.resultContainer.add(extras);
    });
  }
}
```

- [ ] **Typecheck:** `npm run typecheck 2>&1 | tail -10`

- [ ] **Commit:** `git add src/scenes/GachaScene.ts && git commit -m "feat(scene): GachaScene — crystal balance, pity, pull buttons, result cards"`

---

## Task 4 — CollectionScene

**Files:** `src/scenes/CollectionScene.ts`

- [ ] **Create `src/scenes/CollectionScene.ts`**:

```ts
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";

const RARITY_INT: Record<string, number> = {
  Common: 0x9e9e9e,
  Magic: 0x2196f3,
  Rare: 0x9c27b0,
  Legendary: 0xff9800,
  Unique: 0xf44336,
};

const RARITY_HEX: Record<string, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

const COLS = 8;
const CARD_W = 100;
const CARD_H = 72;
const GAP_X = 114;
const GAP_Y = 88;

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super("CollectionScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");
    const save = mgr.getSave();
    const W = this.scale.width;

    this.add
      .text(W / 2, 18, "◈ Collection", {
        fontSize: "26px",
        color: "#ffd700",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const ownedCount = Object.keys(save.collection).length;
    this.add
      .text(W / 2, 52, `${ownedCount} / ${TOWERS.length} collected`, {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);

    this.add
      .text(20, 6, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    const START_X = (W - (COLS - 1) * GAP_X - CARD_W) / 2 + CARD_W / 2;
    const START_Y = 78;

    const g = this.add.graphics();

    TOWERS.forEach((tower, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * GAP_X;
      const y = START_Y + row * GAP_Y;
      const isOwned = tower.id in save.collection;
      const stars = getTowerStars(save, tower.id);
      const colorInt = isOwned ? (RARITY_INT[tower.rarity] ?? 0x888888) : 0x333333;
      const hexColor = isOwned ? (RARITY_HEX[tower.rarity] ?? "#888888") : "#555555";
      const alpha = isOwned ? 1.0 : 0.4;

      g.fillStyle(colorInt, 0.12 * (isOwned ? 1 : 0.5));
      g.fillRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 6);
      g.lineStyle(1.5, colorInt, alpha);
      g.strokeRoundedRect(x - CARD_W / 2, y, CARD_W, CARD_H, 6);

      this.add
        .text(x, y + 7, tower.name, {
          fontSize: "8px",
          color: hexColor,
          wordWrap: { width: CARD_W - 8 },
          align: "center",
        })
        .setOrigin(0.5, 0);

      this.add
        .text(x, y + 38, tower.rarity, {
          fontSize: "9px",
          color: isOwned ? "#cccccc" : "#555555",
        })
        .setOrigin(0.5, 0);

      if (isOwned && stars > 0) {
        this.add
          .text(x, y + 54, "★".repeat(stars), {
            fontSize: "11px",
            color: "#ffd700",
          })
          .setOrigin(0.5, 0);
      }
    });
  }
}
```

- [ ] **Typecheck:** `npm run typecheck 2>&1 | tail -10`

- [ ] **Commit:** `git add src/scenes/CollectionScene.ts && git commit -m "feat(scene): CollectionScene — tower roster grid, owned/unowned, star count"`

---

## Task 5 — BattleScene Integration

**Files:** `src/scenes/BattleScene.ts`

This task wires `SaveManager` into the existing `BattleScene`. Changes:

1. Read `SaveManager` from registry in `create()`.
2. Build the 7-slot squad from the player's owned collection; fall back to `SQUAD_IDS` if the collection is empty (allows first-time players to jump straight in).
3. Pass `heroSave` to `BattleState` so hero stats include passive nodes + items.
4. Track a `_victoryProcessed` flag. When `outcome` first becomes `"won"`, call `afterBattle()`, persist, and show a drop overlay.
5. Add a "← Menu" button that appears once the battle ends.
6. Remove the now-unused `setHeroSave()` / `heroSave` field.

- [ ] **Replace the full contents of `src/scenes/BattleScene.ts`** with:

```ts
/**
 * BattleScene — the thin Phaser rendering/input layer over the headless
 * BattleState simulation. It draws placeholder shapes (Phase 1 has no art) and
 * translates player input into simulation commands:
 *   - Tap a tower button (or press 1-7) to select a tower to build.
 *   - Tap an empty slot to place the selected tower (costs gold).
 *   - Tap anywhere else to walk the hero there.
 *
 * Phase 4a: reads SaveManager from Phaser registry; squad filtered by owned
 * collection; afterBattle() called on win.
 */
import Phaser from "phaser";
import { BattleState, type EnemyRuntime, type TowerRuntime } from "../core/battle.ts";
import { loadCatalog, type Catalog } from "../data/catalog.ts";
import { defaultHeroStats, STAGE_1 } from "../data/stage.ts";
import type { CharacterDef, ItemSlot, Vec2 } from "../data/schema.ts";
import { dist } from "../core/path.ts";
import { totalXpForLevel } from "../core/hero.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { TOWERS } from "../data/towers.ts";
import { Rng } from "../core/rng.ts";
import type { HeroSave } from "../core/save.ts";

/** Preferred squad order — roles: damage, splash, chain, dot, debuff, support, damage(Unique) */
const PREFERRED_SQUAD: string[] = [
  "zoran-thricedraw",
  "iron-bo-cannonarm",
  "hyo-frost-arc",
  "shion-venom-priestess",
  "yuki-frostward-maiden",
  "aldric-banner-bearer",
  "karu-sunfist",
];

const SQUAD_SIZE = 7;
const SLOT_RADIUS = 26;

const ROLE_COLOR: Record<string, number> = {
  damage: 0x4fc3f7,
  splash: 0xff8a65,
  chain: 0xba68c8,
  dot: 0x9ccc65,
  support: 0xfff176,
  debuff: 0x4db6ac,
  economy: 0xffd54f,
};

/**
 * Build a squad of up to SQUAD_SIZE towers from the player's owned collection.
 * Prefers PREFERRED_SQUAD order when those towers are owned. If the player owns
 * nothing (fresh save), returns the full PREFERRED_SQUAD as a fallback so the
 * game is immediately playable.
 */
function buildSquad(save: HeroSave, catalog: Catalog): CharacterDef[] {
  const owned = new Set(Object.keys(save.collection));

  // Prefer squad members the player owns
  const preferred = PREFERRED_SQUAD.filter((id) => owned.has(id))
    .map((id) => catalog.characters.get(id))
    .filter((c): c is CharacterDef => Boolean(c));

  // Supplement with any other owned tower until SQUAD_SIZE
  if (preferred.length < SQUAD_SIZE && owned.size > 0) {
    for (const t of TOWERS) {
      if (preferred.length >= SQUAD_SIZE) break;
      if (owned.has(t.id) && !preferred.find((p) => p.id === t.id)) {
        const def = catalog.characters.get(t.id);
        if (def) preferred.push(def);
      }
    }
  }

  // Fallback: empty collection → use full PREFERRED_SQUAD (unrestricted demo mode)
  if (preferred.length === 0) {
    return PREFERRED_SQUAD.map((id) => catalog.characters.get(id)).filter((c): c is CharacterDef =>
      Boolean(c),
    );
  }

  return preferred;
}

export class BattleScene extends Phaser.Scene {
  private catalog!: Catalog;
  private battle!: BattleState;
  private buildOrder: CharacterDef[] = [];
  private selectedTowerId: string | null = null;
  private saveManager!: SaveManager;

  private staticGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private buildButtons: Phaser.GameObjects.Text[] = [];
  private hudLevelText!: Phaser.GameObjects.Text;
  private hudSkillText!: Phaser.GameObjects.Text;

  // Victory / outcome state
  private _victoryProcessed = false;
  private _menuBtn: Phaser.GameObjects.Text | null = null;
  private _dropOverlay: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.saveManager = this.registry.get("saveManager");
    const save = this.saveManager.getSave();

    this._victoryProcessed = false;
    this._menuBtn = null;
    this._dropOverlay = null;

    this.catalog = loadCatalog();
    this.buildOrder = buildSquad(save, this.catalog);
    this.selectedTowerId = this.buildOrder[0]?.id ?? null;

    this.battle = new BattleState(STAGE_1, this.catalog, {
      seed: 12345,
      hero: {
        stats: defaultHeroStats(),
        startPos: { x: 480, y: 270 },
        damageType: "Physical",
      },
      heroSave: save,
    });

    this.staticGfx = this.add.graphics();
    this.dynGfx = this.add.graphics();
    this.drawStatic();

    this.hud = this.add.text(10, 8, "", { fontSize: "16px", color: "#ffffff" }).setDepth(10);
    this.banner = this.add
      .text(480, 270, "", { fontSize: "48px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(20);

    this.info = this.add
      .text(10, 484, "", { fontSize: "11px", color: "#cfd8dc", wordWrap: { width: 940 } })
      .setDepth(10);

    this.hudLevelText = this.add
      .text(36, 97, "", { fontSize: "11px", color: "#ffffff", align: "center" })
      .setOrigin(0.5, 0.5)
      .setDepth(20)
      .setVisible(false);

    this.hudSkillText = this.add
      .text(58, 117, "", { fontSize: "9px", color: "#ddaaff", align: "center" })
      .setOrigin(0.5, 0.5)
      .setDepth(20)
      .setVisible(false);

    this.buildBuildBar();
    this.bindInput();
  }

  private drawStatic(): void {
    const g = this.staticGfx;
    g.clear();
    g.lineStyle(36, 0x2c3446, 1);
    const p = STAGE_1.path;
    g.beginPath();
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
    g.strokePath();
    const c = this.battle.castlePos;
    g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 22, c.y - 22, 44, 44);
    g.lineStyle(2, 0x55617a, 1);
    for (const s of STAGE_1.towerSlots) g.strokeCircle(s.x, s.y, SLOT_RADIUS);
  }

  private buildBuildBar(): void {
    this.buildOrder.forEach((def, i) => {
      const btn = this.add
        .text(10 + i * 130, 510, "", {
          fontSize: "13px",
          color: "#fff",
          backgroundColor: "#333",
        })
        .setPadding(6, 4, 6, 4)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);
      btn.on(
        "pointerdown",
        (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          this.selectedTowerId = def.id;
          e.stopPropagation();
        },
      );
      this.buildButtons.push(btn);
    });
    this.refreshBuildBar();

    for (let i = 0; i < Math.min(9, this.buildOrder.length); i++) {
      this.input.keyboard?.on(`keydown-${i + 1 === 10 ? 0 : i + 1}`, () => {
        this.selectedTowerId = this.buildOrder[i].id;
      });
    }
  }

  private refreshBuildBar(): void {
    this.buildButtons.forEach((btn, i) => {
      const def = this.buildOrder[i];
      if (!def) return;
      const selected = def.id === this.selectedTowerId;
      btn.setText(`${i + 1} ${def.name} (${def.cost}g)`);
      btn.setBackgroundColor(
        selected ? "#1565c0" : this.battle.gold >= def.cost ? "#333" : "#5a1f1f",
      );
    });
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.battle.outcome !== "ongoing") return;
      if (pointer.worldY >= 500) return;
      const world: Vec2 = { x: pointer.worldX, y: pointer.worldY };

      const slotIndex = this.slotAt(world);
      if (slotIndex >= 0 && this.selectedTowerId) {
        if (this.battle.placeTower(this.selectedTowerId, slotIndex)) return;
      }
      this.battle.commandHero(world);
    });
  }

  private slotAt(world: Vec2): number {
    for (let i = 0; i < STAGE_1.towerSlots.length; i++) {
      if (dist(world, STAGE_1.towerSlots[i]) <= SLOT_RADIUS) {
        const occupied = this.battle.towers.some((t) => t.slotIndex === i && t.alive);
        if (!occupied) return i;
      }
    }
    return -1;
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.battle.tick(dt);
    this.draw();
  }

  private draw(): void {
    const g = this.dynGfx;
    g.clear();

    for (const t of this.battle.towers) this.drawTower(g, t);
    for (const e of this.battle.enemies) this.drawEnemy(g, e);
    this.drawHero(g);

    this.refreshBuildBar();
    const b = this.battle;
    this.hud.setText(
      `${STAGE_1.name} [${b.difficulty}]   Gold ${b.gold}   ` +
        `Castle ${Math.max(0, Math.ceil(b.castleHp))}   ` +
        `Hero ${Math.max(0, Math.ceil(b.hero.hp))}/${b.hero.stats.maxHp}   ` +
        `Wave ${Math.max(0, b.waveIndex + 1)}/${STAGE_1.waves.length}`,
    );

    this.drawHeroSaveHUD(g);

    const sel = this.buildOrder.find((d) => d.id === this.selectedTowerId);
    if (sel) {
      this.info.setText(
        `${sel.name} — ${sel.rarity} ${sel.role} (${sel.damageType}/${sel.target})  ·  ${sel.description}`,
      );
    }

    if (b.outcome === "won") {
      this.banner.setText("VICTORY").setColor("#a5d6a7");
      this.processVictory();
    } else if (b.outcome === "lost") {
      this.banner.setText("DEFEAT").setColor("#ef9a9a");
    }

    if (b.outcome !== "ongoing" && !this._menuBtn) {
      this._menuBtn = this.add
        .text(this.scale.width / 2, 370, "← Return to Menu", {
          fontSize: "20px",
          color: "#ffffff",
          backgroundColor: "#223355",
        })
        .setOrigin(0.5)
        .setPadding(16, 10, 16, 10)
        .setInteractive({ useHandCursor: true })
        .setDepth(30);
      this._menuBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
    }
  }

  /** Called once when outcome === "won". Persists drops and shows them. */
  private processVictory(): void {
    if (this._victoryProcessed) return;
    this._victoryProcessed = true;

    const result = this.saveManager.afterBattle(
      STAGE_1.id,
      "won",
      this.battle.difficulty,
      new Rng(Date.now()),
    );

    if (result) {
      const lines = [`+${result.crystalsAwarded} 💎 crystals`];
      if (result.isFirstClear) lines.push("★ First clear bonus!");
      if (result.itemDropped) lines.push(`📦 Item: ${result.itemDropped.defId}`);
      if (result.skillDropped) lines.push(`⚡ Skill: ${result.skillDropped}`);
      if (result.characterDropped) lines.push(`✨ New character: ${result.characterDropped}`);

      this._dropOverlay = this.add
        .text(this.scale.width / 2, 310, lines.join("\n"), {
          fontSize: "16px",
          color: "#ffffff",
          backgroundColor: "#1a2a3a",
          align: "center",
        })
        .setOrigin(0.5)
        .setPadding(16, 10, 16, 10)
        .setDepth(25);
    }
  }

  private drawTower(g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
    const disabled = t.disabledTimer > 0;
    const color = disabled ? 0x555555 : (ROLE_COLOR[t.def.role] ?? 0xffffff);
    g.fillStyle(color, 1).fillRect(t.pos.x - 14, t.pos.y - 14, 28, 28);
    g.lineStyle(1, color, 0.25).strokeCircle(t.pos.x, t.pos.y, t.stats.range);
    if (t.stats.maxMana > 0) {
      g.fillStyle(0x42a5f5, 0.9);
      g.fillRect(t.pos.x - 14, t.pos.y + 16, 28 * (t.mana / t.stats.maxMana), 3);
    }
    if (t.hp < t.stats.maxHp) {
      g.fillStyle(0x000000, 0.6).fillRect(t.pos.x - 14, t.pos.y - 20, 28, 3);
      g.fillStyle(0xef5350, 1).fillRect(
        t.pos.x - 14,
        t.pos.y - 20,
        28 * Phaser.Math.Clamp(t.hp / t.stats.maxHp, 0, 1),
        3,
      );
    }
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyRuntime): void {
    const boss = e.def.archetype === "Boss";
    const r = boss ? 16 : e.flying ? 8 : 10;
    const alpha = e.stealth ? 0.4 : 1;
    const base = e.enraged ? 0xff5252 : e.flying ? 0xce93d8 : boss ? 0xb71c1c : 0xe57373;
    g.fillStyle(base, alpha).fillCircle(e.pos.x, e.pos.y, r);
    if (e.stunTimer > 0) g.lineStyle(2, 0xfff176, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    else if (e.slowPct > 0) g.lineStyle(2, 0x4fc3f7, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    const w = boss ? 40 : 20;
    const top = e.pos.y - r - 7;
    g.fillStyle(0x000000, 0.6).fillRect(e.pos.x - w / 2, top, w, 4);
    g.fillStyle(0x66bb6a, 1).fillRect(
      e.pos.x - w / 2,
      top,
      w * Phaser.Math.Clamp(e.hp / e.stats.maxHp, 0, 1),
      4,
    );
    if (e.shield > 0) {
      g.fillStyle(0x80d8ff, 1).fillRect(
        e.pos.x - w / 2,
        top - 4,
        w * Phaser.Math.Clamp(e.shield / e.stats.maxHp, 0, 1),
        3,
      );
    }
  }

  private drawHero(g: Phaser.GameObjects.Graphics): void {
    const h = this.battle.hero;
    if (!h.alive) return;
    g.fillStyle(0xffd700, 1).fillCircle(h.pos.x, h.pos.y, 13);
    g.lineStyle(1, 0xffd700, 0.25).strokeCircle(h.pos.x, h.pos.y, h.stats.range);
    g.fillStyle(0x000000, 0.6).fillRect(h.pos.x - 16, h.pos.y - 24, 32, 5);
    g.fillStyle(0x66bb6a, 1).fillRect(
      h.pos.x - 16,
      h.pos.y - 24,
      32 * Phaser.Math.Clamp(h.hp / h.stats.maxHp, 0, 1),
      5,
    );
    g.fillStyle(0x42a5f5, 1).fillRect(
      h.pos.x - 16,
      h.pos.y - 18,
      32 * Phaser.Math.Clamp(h.mana / Math.max(1, h.stats.maxMana), 0, 1),
      3,
    );
  }

  private drawHeroSaveHUD(g: Phaser.GameObjects.Graphics): void {
    const save = this.saveManager.getSave();

    const lvl = save.hero.level;
    const xpGained = lvl < 100 ? save.hero.totalXp - totalXpForLevel(lvl) : 1;
    const xpTotal = lvl < 100 ? totalXpForLevel(lvl + 1) - totalXpForLevel(lvl) : 1;
    const xpPct = Math.min(1, xpTotal > 0 ? xpGained / xpTotal : 1);

    g.fillStyle(0x2244aa, 1).fillRect(8, 88, 56, 18);
    this.hudLevelText.setText(`Lv ${lvl}`).setVisible(true);

    g.fillStyle(0x111133, 1).fillRect(68, 88, 140, 8);
    if (xpPct > 0) {
      g.fillStyle(0x44aaff, 1).fillRect(68, 88, Math.floor(140 * xpPct), 8);
    }

    if (save.hero.equippedSkillId) {
      g.fillStyle(0x442266, 1).fillRect(8, 110, 100, 14);
      this.hudSkillText.setText(`Skill: ${save.hero.equippedSkillId}`).setVisible(true);
    } else {
      this.hudSkillText.setVisible(false);
    }

    const SLOTS: ItemSlot[] = [
      "Weapon",
      "Helmet",
      "BodyArmor",
      "Gloves",
      "Boots",
      "Amulet",
      "Ring1",
      "Ring2",
      "Pet",
      "Wing",
    ];
    SLOTS.forEach((slot, idx) => {
      const equipped = save.inventory.equipped[slot];
      g.fillStyle(equipped ? 0xffcc44 : 0x444444, 1).fillCircle(12 + idx * 14, 130, 4);
    });
  }
}
```

- [ ] **Typecheck + test:** `npm run typecheck && npm test 2>&1 | tail -15` — all 191 tests still pass; typecheck clean.

- [ ] **Commit:** `git add src/scenes/BattleScene.ts && git commit -m "feat(scene): BattleScene — SaveManager integration, squad from collection, afterBattle on win"`

---

## Task 6 — Final Verification

- [ ] **Full suite:** `npm run typecheck && npm test && npm run build 2>&1 | tail -20`
  - All 191 tests pass, typecheck clean, build succeeds.

- [ ] **Log final commits:** `git log --oneline -8`
