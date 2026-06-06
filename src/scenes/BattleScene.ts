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
import { defaultHeroStats, STAGE_1, WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import type { CharacterDef, Difficulty, ItemSlot, StageDef, Vec2 } from "../data/schema.ts";
import { dist } from "../core/path.ts";
import { totalXpForLevel } from "../core/hero.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { TOWERS } from "../data/towers.ts";
import { Rng } from "../core/rng.ts";
import type { HeroSave } from "../core/save.ts";
import { hasSprite } from "./PreloadScene.ts";
import { FxLayer } from "./fx.ts";
import type { FxEvent } from "../core/battle.ts";

/** Preferred squad order — one per role plus a Unique marquee. */
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

const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x35562f, sand: 0xb8a05a, water: 0x2a5f93, stone: 0x6b6c74, jungle: 0x1f4a2a, mountain: 0x5a4d40,
};

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
 * game is immediately playable without any collection.
 */
function buildSquad(save: HeroSave, catalog: Catalog): CharacterDef[] {
  const owned = new Set(Object.keys(save.collection));

  // A player-chosen squad takes priority (only the still-owned members).
  const chosen = (save.squad ?? [])
    .filter((id) => owned.has(id))
    .map((id) => catalog.characters.get(id))
    .filter((c): c is CharacterDef => Boolean(c));
  if (chosen.length > 0) return chosen.slice(0, SQUAD_SIZE);

  const preferred = PREFERRED_SQUAD
    .filter((id) => owned.has(id))
    .map((id) => catalog.characters.get(id))
    .filter((c): c is CharacterDef => Boolean(c));

  if (preferred.length < SQUAD_SIZE && owned.size > 0) {
    for (const t of TOWERS) {
      if (preferred.length >= SQUAD_SIZE) break;
      if (owned.has(t.id) && !preferred.find((p) => p.id === t.id)) {
        const def = catalog.characters.get(t.id);
        if (def) preferred.push(def);
      }
    }
  }

  // Empty collection → unrestricted fallback so new players can play immediately
  if (preferred.length === 0) {
    return PREFERRED_SQUAD
      .map((id) => catalog.characters.get(id))
      .filter((c): c is CharacterDef => Boolean(c));
  }

  return preferred;
}

export class BattleScene extends Phaser.Scene {
  private catalog!: Catalog;
  private battle!: BattleState;
  private stage!: StageDef;
  private difficulty!: Difficulty;
  private buildOrder: CharacterDef[] = [];
  private saveManager!: SaveManager;

  private staticGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;     // screen-space HUD shapes
  private world!: Phaser.GameObjects.Layer;        // battlefield (zoomed camera)
  private ui!: Phaser.GameObjects.Layer;           // HUD (fixed camera)
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private avatarTiles: Phaser.GameObjects.Container[] = [];
  private placeGhost: Phaser.GameObjects.Container | null = null;
  private gameSpeed = 1;
  private speedBtn!: Phaser.GameObjects.Text;
  private hudLevelText!: Phaser.GameObjects.Text;
  private hudSkillText!: Phaser.GameObjects.Text;

  private _victoryProcessed = false;
  private _menuBtn: Phaser.GameObjects.Text | null = null;

  // Pixel-art sprite pools (keyed by entity uid); fall back to shapes if missing.
  private towerSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private heroSprite: Phaser.GameObjects.Sprite | null = null;
  private fx!: FxLayer;
  private towerPanel: Phaser.GameObjects.Container | null = null;
  private towerPanelUid = -1;
  private towerPanelRefresh: (() => void) | null = null;
  private keys?: {
    up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.saveManager = this.registry.get("saveManager");
    const save = this.saveManager.getSave();

    this._victoryProcessed = false;
    this._menuBtn = null;
    this.towerSprites.clear();
    this.enemySprites.clear();
    this.heroSprite = null;
    this.towerPanel = null;
    this.towerPanelUid = -1;
    this.avatarTiles = [];      // stale refs from a prior battle are destroyed by shutdown
    this.placeGhost = null;

    // Stage and difficulty come from StageSelectScene via registry; fall back to stage 1 / Normal
    this.stage = (this.registry.get("selectedStage") as StageDef | undefined) ?? STAGE_1;
    this.difficulty = (this.registry.get("selectedDifficulty") as Difficulty | undefined) ?? "Normal";

    this.catalog = loadCatalog();
    this.buildOrder = buildSquad(save, this.catalog);

    this.battle = new BattleState(this.stage, this.catalog, {
      seed: 12345,
      difficulty: this.difficulty,
      hero: {
        stats: defaultHeroStats(),
        startPos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
        damageType: "Physical",
      },
      heroSave: save,
    });

    // Two display layers: the battlefield (rendered by a zoomed-out camera) and
    // the HUD (rendered by a fixed 1:1 camera).
    this.world = this.add.layer();
    this.ui = this.add.layer();

    this.staticGfx = this.add.graphics();
    this.dynGfx = this.add.graphics().setDepth(5); // bars/rings above sprites (depth 2)
    this.world.add([this.staticGfx, this.dynGfx]);
    this.fx = new FxLayer(this, 6, this.world);
    this.drawStatic();

    this.uiGfx = this.add.graphics().setDepth(8);
    this.hud = this.add.text(10, 8, "", { fontSize: "16px", color: "#ffffff" }).setDepth(10);
    this.banner = this.add.text(480, 250, "", { fontSize: "48px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(20);
    this.info = this.add.text(10, 484, "", { fontSize: "11px", color: "#cfd8dc", wordWrap: { width: 940 } }).setDepth(10);
    this.hudLevelText = this.add.text(36, 97, "", { fontSize: "11px", color: "#ffffff", align: "center" }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.hudSkillText = this.add.text(58, 117, "", { fontSize: "9px", color: "#ddaaff", align: "center" }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.gameSpeed = 1;
    this.speedBtn = this.add.text(this.scale.width - 14, 38, "", { fontSize: "14px", color: "#fff", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(10, 5, 10, 5).setDepth(12).setInteractive({ useHandCursor: true });
    this.speedBtn.on("pointerdown", () => { this.gameSpeed = this.gameSpeed === 0 ? 1 : this.gameSpeed >= 3 ? 0 : this.gameSpeed + 1; this.updateSpeedBtn(); });
    this.updateSpeedBtn();
    this.ui.add([this.uiGfx, this.hud, this.banner, this.info, this.hudLevelText, this.hudSkillText, this.speedBtn]);

    this.buildBuildBar();
    this.setupPlacementDrag(); // register drag handlers once (tiles rebuild without re-registering)
    this.bindInput();

    // Camera setup: main shows the whole world zoomed out; uiCam draws the HUD 1:1.
    const zoom = Math.min(this.scale.width / WORLD_WIDTH, this.scale.height / WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setZoom(zoom).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.cameras.main.ignore(this.ui);
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCam.ignore(this.world);
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard?.addKeys({
      up: KC.UP, down: KC.DOWN, left: KC.LEFT, right: KC.RIGHT,
      w: KC.W, a: KC.A, s: KC.S, d: KC.D,
    }) as typeof this.keys;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.closeTowerPanel(); this.clearGhost(); });
  }

  private drawStatic(): void {
    const g = this.staticGfx;
    g.clear();
    // ground tint
    g.fillStyle(0x202a22, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // terrain features (T13)
    for (const f of this.stage.terrain ?? []) {
      const col = TERRAIN_COLOR[f.type];
      g.fillStyle(col, f.blocks ? 0.95 : 0.5).fillCircle(f.x, f.y, f.r);
      g.lineStyle(2, Phaser.Display.Color.IntegerToColor(col).darken(30).color, f.blocks ? 0.9 : 0.4).strokeCircle(f.x, f.y, f.r);
      if (f.type === "mountain") { g.fillStyle(0xe8eef4, 0.5).fillTriangle(f.x - f.r * 0.4, f.y + f.r * 0.2, f.x, f.y - f.r * 0.5, f.x + f.r * 0.4, f.y + f.r * 0.2); }
    }
    // lane
    g.lineStyle(36, 0x3a4458, 1);
    const p = this.stage.path;
    g.beginPath();
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
    g.strokePath();
    // castle
    const c = this.battle.castlePos;
    g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 24, c.y - 24, 48, 48);
    g.lineStyle(3, 0x9ab0e0, 1).strokeRect(c.x - 24, c.y - 24, 48, 48);
  }

  /** Build the bottom bar of draggable character avatars (T12). */
  private buildBuildBar(): void {
    const TW = 74;
    this.buildOrder.forEach((def, i) => {
      const x = 14 + i * TW, y = 504;
      const c = this.add.container(x + TW / 2, y + 16).setSize(TW - 8, 44).setDepth(12);
      const bg = this.add.graphics();
      bg.fillStyle(0x1a2230, 1).fillRoundedRect(-(TW - 8) / 2, -16, TW - 8, 44, 6);
      bg.lineStyle(1.5, 0x3a4a64, 1).strokeRoundedRect(-(TW - 8) / 2, -16, TW - 8, 44, 6);
      c.add(bg);
      const key = `tower__${def.id}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(0, -2, key, 0).setOrigin(0.5);
        img.setScale(34 / img.height);
        c.add(img);
      }
      c.add(this.add.text(0, 14, `${def.cost}g`, { fontSize: "9px", color: "#ffd86a" }).setOrigin(0.5));
      c.setData("towerId", def.id);
      c.setInteractive({ useHandCursor: true, draggable: true });
      this.ui.add(c);
      this.avatarTiles.push(c);
    });
  }

  /** Recreate the avatar tiles (e.g. to snap a dragged tile home). */
  private rebuildAvatarTiles(): void {
    this.avatarTiles.forEach((t) => t.destroy());
    this.avatarTiles = [];
    this.buildBuildBar();
  }

  private refreshBuildBar(): void {
    for (const c of this.avatarTiles) {
      const id = c.getData("towerId") as string;
      const def = this.buildOrder.find((d) => d.id === id);
      c.setAlpha(def && this.battle.gold >= def.cost ? 1 : 0.45);
    }
  }

  /** Drag an avatar onto the field to place its tower at a free spot (T12 + T14). */
  private setupPlacementDrag(): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!obj.getData || !obj.getData("towerId")) return;
      this.makeGhost(obj.getData("towerId"));
    });
    this.input.on("drag", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      if (!obj.getData || !obj.getData("towerId")) return;
      obj.x = x; obj.y = y;
      this.updateGhost(obj.getData("towerId"), p);
    });
    this.input.on("dragend", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      const id = obj.getData && obj.getData("towerId");
      if (!id) return;
      this.clearGhost();
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      if (p.y < 500 && this.battle.outcome === "ongoing" && !this.towerPanel) {
        this.battle.placeTowerAt(id, { x: wp.x, y: wp.y });
      }
      this.rebuildAvatarTiles(); // snap the dragged tile home (drag handlers stay registered)
    });
  }

  private makeGhost(towerId: string): void {
    this.clearGhost();
    const g = this.add.container(0, 0).setDepth(7).setAlpha(0.7);
    const ring = this.add.graphics();
    g.add(ring); g.setData("ring", ring);
    const key = `tower__${towerId}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key, 0).setOrigin(0.5, 0.78);
      img.setScale(50 / img.height); g.add(img);
    }
    this.world.add(g);
    this.placeGhost = g;
  }

  private updateGhost(towerId: string, pointer: Phaser.Input.Pointer): void {
    if (!this.placeGhost) return;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.placeGhost.setPosition(wp.x, wp.y);
    const def = this.buildOrder.find((d) => d.id === towerId);
    const ok = pointer.y < 500 && this.battle.canPlaceAt({ x: wp.x, y: wp.y }) && !!def && this.battle.gold >= def.cost;
    const range = def?.baseStats.range ?? 130;
    const ring = this.placeGhost.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    ring.lineStyle(1.5, ok ? 0x66ff88 : 0xff5a5a, 0.4).strokeCircle(0, 0, range);   // coverage preview
    ring.fillStyle(ok ? 0x66ff88 : 0xff5a5a, 0.06).fillCircle(0, 0, range);
    ring.lineStyle(2, ok ? 0x66ff88 : 0xff5a5a, 0.95).strokeCircle(0, 0, 16);        // footprint
  }

  private clearGhost(): void {
    this.placeGhost?.destroy(true);
    this.placeGhost = null;
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.battle.outcome !== "ongoing") return;
      if (pointer.y >= 500) return; // bottom HUD strip (screen space)
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const world: Vec2 = { x: wp.x, y: wp.y };

      // An open tower panel: a tap inside it is for its buttons; outside closes it.
      if (this.towerPanel) {
        const b = this.towerPanel.getBounds();
        if (Phaser.Geom.Rectangle.Contains(b, world.x, world.y)) return;
        this.closeTowerPanel();
        return;
      }

      // Tap an existing tower → upgrade/sell panel; else walk the hero there.
      const tower = this.towerAt(world);
      if (tower) { this.openTowerPanel(tower.uid); return; }
      this.battle.commandHero(world);
    });
  }

  /** The alive tower under a tap, if any. */
  private towerAt(world: Vec2): TowerRuntime | null {
    for (const t of this.battle.towers) {
      if (t.alive && dist(world, t.pos) <= SLOT_RADIUS) return t;
    }
    return null;
  }

  private closeTowerPanel(): void {
    this.towerPanel?.destroy(true);
    this.towerPanel = null;
    this.towerPanelUid = -1;
    this.towerPanelRefresh = null;
  }

  /** Build the upgrade/sell panel for a placed tower. */
  private openTowerPanel(uid: number): void {
    this.closeTowerPanel();
    const t = this.battle.towers.find((x) => x.uid === uid && x.alive);
    if (!t) return;
    this.towerPanelUid = uid;

    const W = 224, H = 96;
    let px = t.pos.x + 24, py = t.pos.y - H / 2;
    px = Phaser.Math.Clamp(px, 6, WORLD_WIDTH - W - 6);
    py = Phaser.Math.Clamp(py, 30, WORLD_HEIGHT - H - 6);
    const c = this.add.container(px, py).setDepth(40);
    this.world.add(c);

    const g = this.add.graphics();
    g.fillStyle(0x121622, 0.96).fillRoundedRect(0, 0, W, H, 8);
    g.lineStyle(2, 0x3a4a6a, 1).strokeRoundedRect(0, 0, W, H, 8);
    c.add(g);

    const title = this.add.text(8, 6, "", { fontSize: "12px", color: "#ffd86a", fontStyle: "bold" });
    const stats = this.add.text(8, 24, "", { fontSize: "10px", color: "#ccd6e6" });
    c.add(title); c.add(stats);

    const upBtn = this.add.text(8, H - 26, "", { fontSize: "11px", color: "#fff", backgroundColor: "#1565c0" })
      .setPadding(6, 4, 6, 4).setInteractive({ useHandCursor: true });
    const sellBtn = this.add.text(W - 8, H - 26, "", { fontSize: "11px", color: "#fff", backgroundColor: "#7a2e2e" })
      .setOrigin(1, 0).setPadding(6, 4, 6, 4).setInteractive({ useHandCursor: true });
    c.add(upBtn); c.add(sellBtn);

    upBtn.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.battle.upgradeTower(uid)) this.refreshTowerPanel(title, stats, upBtn, sellBtn);
    });
    sellBtn.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.battle.sellTower(uid);
      // Defer the close so the panel ref (and its bounds guard) survive the rest
      // of this pointer-event dispatch — prevents the scene handler from falling
      // through to a hero-move / placement at the button location.
      this.time.delayedCall(0, () => this.closeTowerPanel());
    });

    this.towerPanel = c;
    this.towerPanelRefresh = () => this.refreshTowerPanel(title, stats, upBtn, sellBtn);
    this.towerPanelRefresh();
  }

  private refreshTowerPanel(
    title: Phaser.GameObjects.Text, stats: Phaser.GameObjects.Text,
    upBtn: Phaser.GameObjects.Text, sellBtn: Phaser.GameObjects.Text,
  ): void {
    const t = this.battle.towers.find((x) => x.uid === this.towerPanelUid && x.alive);
    if (!t) { this.closeTowerPanel(); return; }
    title.setText(`${t.def.name}  Lv${t.baseLevel}+${t.battleLevel}`);
    stats.setText(`ATK ${Math.round(t.stats.atk)}   HP ${Math.round(t.stats.maxHp)}   RNG ${Math.round(t.stats.range)}`);
    const cost = this.battle.upgradeCost(t.uid);
    if (cost === 0) {
      upBtn.setText("MAX").setBackgroundColor("#444").setAlpha(0.7);
    } else {
      upBtn.setText(`⬆ Upgrade (${cost}g)`).setAlpha(this.battle.gold >= cost ? 1 : 0.5)
        .setBackgroundColor(this.battle.gold >= cost ? "#1565c0" : "#444");
    }
    sellBtn.setText(`✕ Sell +${this.battle.sellValue(t.uid)}g`);
  }


  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.handleKeyboardHero();
    for (let i = 0; i < this.gameSpeed; i++) this.battle.tick(dt); // 0 = paused, 2/3 = fast-forward
    this.draw();
  }

  private updateSpeedBtn(): void {
    const label = this.gameSpeed === 0 ? "⏸ Paused" : `▶ ${this.gameSpeed}×`;
    this.speedBtn.setText(label).setBackgroundColor(this.gameSpeed === 0 ? "#5a3a2a" : "#243a5a");
  }

  /** WASD / arrow keys steer the hero (held = continuous movement). */
  private handleKeyboardHero(): void {
    const k = this.keys;
    if (!k || this.battle.outcome !== "ongoing" || !this.battle.hero.alive) return;
    let dx = 0, dy = 0;
    if (k.left.isDown || k.a.isDown) dx -= 1;
    if (k.right.isDown || k.d.isDown) dx += 1;
    if (k.up.isDown || k.w.isDown) dy -= 1;
    if (k.down.isDown || k.s.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const h = this.battle.hero.pos;
    this.battle.commandHero({
      x: Phaser.Math.Clamp(h.x + (dx / len) * 80, 4, WORLD_WIDTH - 4),
      y: Phaser.Math.Clamp(h.y + (dy / len) * 80, 4, WORLD_HEIGHT - 4),
    });
  }

  private draw(): void {
    const g = this.dynGfx;
    g.clear();
    this.uiGfx.clear();

    // Keep the tower panel live: close it if its tower is gone, else refresh
    // affordability/stats against current gold.
    if (this.towerPanel) {
      if (!this.battle.towers.some((t) => t.uid === this.towerPanelUid && t.alive)) this.closeTowerPanel();
      else this.towerPanelRefresh?.();
    }

    this.manageSprites();
    for (const ev of this.battle.fx) this.playFx(ev);
    for (const t of this.battle.towers) this.drawTower(g, t);
    for (const e of this.battle.enemies) this.drawEnemy(g, e);
    this.drawHero(g);

    this.refreshBuildBar();
    const b = this.battle;
    this.hud.setText(
      `${this.stage.name} [${b.difficulty}]   Gold ${b.gold}   ` +
        `Castle ${Math.max(0, Math.ceil(b.castleHp))}   ` +
        `Hero ${Math.max(0, Math.ceil(b.hero.hp))}/${b.hero.stats.maxHp}   ` +
        `Wave ${Math.max(0, b.waveIndex + 1)}/${this.stage.waves.length}`,
    );

    this.drawHeroSaveHUD(this.uiGfx);

    this.info.setText("Drag a character onto the field to deploy (avoid obstacles).  ·  WASD / arrows or tap to move your hero.  ·  Tap a tower to upgrade/sell.");

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
      this.ui.add(this._menuBtn);
      this._menuBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
    }
  }

  private processVictory(): void {
    if (this._victoryProcessed) return;
    this._victoryProcessed = true;

    const result = this.saveManager.afterBattle(
      this.stage.id,
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

      const overlay = this.add
        .text(this.scale.width / 2, 300, lines.join("\n"), {
          fontSize: "16px",
          color: "#ffffff",
          backgroundColor: "#1a2a3a",
          align: "center",
        })
        .setOrigin(0.5)
        .setPadding(16, 10, 16, 10)
        .setDepth(25);
      this.ui.add(overlay);
    }
  }

  /** Render one sim FX event, and trigger sprite animations (attack swing, hit flash). */
  private playFx(ev: FxEvent): void {
    this.fx.play(ev);
    if (ev.type === "attack") {
      const s = ev.source === "hero" ? this.heroSprite : (this.towerSprites.get(ev.uid) ?? null);
      this.playAttack(s);
    } else if (ev.type === "hit") {
      const e = this.enemySprites.get(ev.uid);
      if (e) this.flash(e, 0xffffff);
    } else if (ev.type === "enemyAttack") {
      const victim = ev.target === "hero" ? this.heroSprite : this.towerNear(ev.targetAt);
      if (victim) this.flash(victim, 0xff4444);
    }
  }

  /** Tower sprite nearest a position (towers are static, so this is exact). */
  private towerNear(at: { x: number; y: number }): Phaser.GameObjects.Sprite | null {
    let best: Phaser.GameObjects.Sprite | null = null, bd = 12 * 12;
    for (const s of this.towerSprites.values()) {
      const dx = s.x - at.x, dy = s.y - at.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Play a sprite's attack animation once, then return to idle. Guards against culling. */
  private playAttack(s: Phaser.GameObjects.Sprite | null): void {
    if (!s || !s.active) return;
    const key = s.texture.key;
    const atk = `${key}_attack`;
    if (!this.anims.exists(atk)) return;
    if (s.anims.currentAnim?.key === atk && s.anims.isPlaying) return; // already swinging
    s.play(atk);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (s.active && this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
  }

  /** Brief tint-flash on a sprite. Re-flashing resets the timer; guarded against culling. */
  private flash(s: Phaser.GameObjects.Sprite, color: number): void {
    if (!s.active) return;
    const prev = s.getData("flashTimer") as Phaser.Time.TimerEvent | undefined;
    prev?.remove();
    s.setTintFill(color);
    s.setData("flashTimer", this.time.delayedCall(80, () => { if (s.active) s.clearTint(); }));
  }

  /** Acquire/update a pooled sprite for an entity; null if no art for this key. */
  private ensureSprite(
    map: Map<number, Phaser.GameObjects.Sprite>,
    uid: number,
    key: string,
    x: number,
    y: number,
    displayH: number,
  ): Phaser.GameObjects.Sprite | null {
    if (!hasSprite(this, key)) return null;
    let s = map.get(uid);
    if (!s) {
      s = this.add.sprite(x, y, key).setOrigin(0.5, 0.78).setDepth(2);
      s.setScale(displayH / s.height);
      this.world.add(s);
      map.set(uid, s);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    }
    s.setPosition(x, y);
    return s;
  }

  /** Create/update/cull pixel-art sprites for towers, enemies and the hero. */
  private manageSprites(): void {
    const seenT = new Set<number>();
    for (const t of this.battle.towers) {
      if (!t.alive) continue;
      const s = this.ensureSprite(this.towerSprites, t.uid, `tower__${t.def.id}`, t.pos.x, t.pos.y, 50);
      if (s) { seenT.add(t.uid); s.setAlpha(t.disabledTimer > 0 ? 0.5 : 1); }
    }
    for (const [uid, s] of this.towerSprites) if (!seenT.has(uid)) { s.destroy(); this.towerSprites.delete(uid); }

    const seenE = new Set<number>();
    for (const e of this.battle.enemies) {
      const boss = e.def.archetype === "Boss";
      const key = `${boss ? "boss" : "enemy"}__${e.def.id}`;
      const s = this.ensureSprite(this.enemySprites, e.uid, key, e.pos.x, e.pos.y, boss ? 62 : 30);
      if (s) { seenE.add(e.uid); s.setAlpha(e.stealth ? 0.45 : 1); }
    }
    for (const [uid, s] of this.enemySprites) if (!seenE.has(uid)) { s.destroy(); this.enemySprites.delete(uid); }

    const h = this.battle.hero;
    if (h.alive && hasSprite(this, "hero__hero")) {
      if (!this.heroSprite) {
        this.heroSprite = this.add.sprite(h.pos.x, h.pos.y, "hero__hero").setOrigin(0.5, 0.78).setDepth(3);
        this.heroSprite.setScale(54 / this.heroSprite.height);
        this.world.add(this.heroSprite);
        if (this.anims.exists("hero__hero_idle")) this.heroSprite.play("hero__hero_idle");
      }
      this.heroSprite.setPosition(h.pos.x, h.pos.y).setVisible(true);
    } else if (this.heroSprite && !h.alive) {
      this.heroSprite.setVisible(false);
    }
  }

  private drawTower(g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
    const disabled = t.disabledTimer > 0;
    const color = disabled ? 0x555555 : (ROLE_COLOR[t.def.role] ?? 0xffffff);
    if (!this.towerSprites.has(t.uid)) {
      g.fillStyle(color, 1).fillRect(t.pos.x - 14, t.pos.y - 14, 28, 28);
    }
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
    if (!this.enemySprites.has(e.uid)) g.fillStyle(base, alpha).fillCircle(e.pos.x, e.pos.y, r);
    else if (e.enraged) g.lineStyle(2, 0xff5252, 0.8).strokeCircle(e.pos.x, e.pos.y, r + 4);
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
    if (!this.heroSprite) g.fillStyle(0xffd700, 1).fillCircle(h.pos.x, h.pos.y, 13);
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
      "Weapon", "Helmet", "BodyArmor", "Gloves", "Boots",
      "Amulet", "Ring1", "Ring2", "Pet", "Wing",
    ];
    SLOTS.forEach((slot, idx) => {
      const equipped = save.inventory.equipped[slot];
      g.fillStyle(equipped ? 0xffcc44 : 0x444444, 1).fillCircle(12 + idx * 14, 130, 4);
    });
  }
}
