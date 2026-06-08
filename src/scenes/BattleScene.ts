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
import { ELITE_SIZE_MULT } from "../core/elite.ts";
import { totalXpForLevel } from "../core/hero.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { Rng } from "../core/rng.ts";
import { hasSprite } from "./PreloadScene.ts";
import { terrainKeyFor } from "../data/terrainManifest.ts";
import { stageThemeForStage } from "../data/chapters.ts";
import { stageBgKey } from "../data/uiManifest.ts";
import { crispText } from "./ui.ts";
import { showBattleLootPanel } from "./rewardPanel.ts";
import { buildLootSummary } from "../data/rewardTiles.ts";
import { passiveInfo, towerActiveInfo } from "../data/passiveSkills.ts";
import { activeSkillDetail } from "../data/skillDescribe.ts";
import { upgradeSummary } from "../core/towerUpgrade.ts";
import { BattleInfoPanel, type HeroPanelVM, type TowerPanelVM, type PanelItem } from "./battleInfoPanel.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { ITEM_SLOTS, type Rarity } from "../data/schema.ts";
import { FxLayer } from "./fx.ts";
import { Sfx } from "./audio.ts";
import type { FxEvent } from "../core/battle.ts";
import { rewardLabel } from "../core/rewards.ts";
import { isoWeekKey } from "../core/meta.ts";
import { boxIdForTier } from "../data/materials.ts";
import type { ChallengeEffects } from "../data/challengeModifiers.ts";

/** A special battle mode launched from the Activities hub (else a normal stage). */
export interface BattleMode {
  kind: "normal" | "challenge" | "endless" | "bossrush";
  challenge?: ChallengeEffects;
  endlessMul?: number;
}
import { HeroLayeredSprite } from "./HeroLayeredSprite.ts";
import { BattleCameraController } from "./battleCamera.ts";

import {
  SLOT_RADIUS, TERRAIN_COLOR, RARITY_INT,
  statRows, HERO_STAT_KEYS, TOWER_STAT_KEYS, ROLE_COLOR, towerKind, KIND_COLOR,
  enemyStatusTint, starPoints, buildSquad,
} from "./battleSceneHelpers.ts";

export class BattleScene extends Phaser.Scene {
  private catalog!: Catalog;
  private battle!: BattleState;
  private stage!: StageDef;
  private difficulty!: Difficulty;
  private battleMode: BattleMode = { kind: "normal" };
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
  private terrainSprites: Phaser.GameObjects.Image[] = [];
  private placeGhost: Phaser.GameObjects.Container | null = null;
  private gameSpeed = 1;
  private speedBtn!: Phaser.GameObjects.Text;
  private sfx = new Sfx();
  private hudLevelText!: Phaser.GameObjects.Text;
  private hudSkillText!: Phaser.GameObjects.Text;

  private _victoryProcessed = false;
  private _defeatPlayed = false;
  private _rewardsShown = false;
  private _menuBtn: Phaser.GameObjects.Text | null = null;
  private killSaveDirty = false;   // kill XP/loot pending a debounced flush
  private lastKillFlush = 0;

  // Pixel-art sprite pools (keyed by entity uid); fall back to shapes if missing.
  private towerSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private heroSprite: HeroLayeredSprite | null = null;
  private fx!: FxLayer;
  private camCtl?: BattleCameraController;
  private tapX = 0;
  private tapY = 0;
  private panel!: BattleInfoPanel;
  private battleW = 0;
  private selectedTowerUid = -1;
  private quickActions: Phaser.GameObjects.Container | null = null;
  private confirmDialog: Phaser.GameObjects.Container | null = null;
  private rangePreviewUid = -1;   // tower whose range ring to show (on upgrade hover)
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
    this._defeatPlayed = false;
    this._rewardsShown = false;
    this._menuBtn = null;
    this.towerSprites.clear();
    this.enemySprites.clear();
    this.heroSprite = null;
    this.selectedTowerUid = -1;
    this.quickActions = null;
    this.confirmDialog = null;
    this.rangePreviewUid = -1;
    this.avatarTiles = [];      // stale refs from a prior battle are destroyed by shutdown
    this.terrainSprites = [];
    this.placeGhost = null;

    // Stage and difficulty come from StageSelectScene via registry; fall back to stage 1 / Normal
    this.stage = (this.registry.get("selectedStage") as StageDef | undefined) ?? STAGE_1;
    this.difficulty = (this.registry.get("selectedDifficulty") as Difficulty | undefined) ?? "Normal";
    // Optional special mode (F5 challenge / F11 endless / F12 boss rush) from the
    // Activities hub; cleared after reading so it doesn't leak into the next battle.
    this.battleMode = (this.registry.get("battleMode") as BattleMode | undefined) ?? { kind: "normal" };
    this.registry.set("battleMode", undefined);

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
      challenge: this.battleMode.challenge,
      endlessMul: this.battleMode.endlessMul,
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

    // The panel OVERLAYS the battlefield (does not resize it). battleW = full width.
    this.battleW = this.scale.width;
    const bcx = this.battleW / 2;
    this.uiGfx = this.add.graphics().setDepth(8);
    this.hud = crispText(this, 10, 8, "", { fontSize: "15px", color: "#ffffff", wordWrap: { width: this.battleW - 120 } }).setDepth(10);
    this.banner = crispText(this, bcx, 150, "", { fontSize: "40px", color: "#ffffff", fontStyle: "bold", strokeThickness: 6 }).setOrigin(0.5).setDepth(20);
    this.info = crispText(this, 10, this.scale.height - 16, "", { fontSize: "12px", color: "#dbe6ee", wordWrap: { width: this.battleW - 20 } }).setDepth(10);
    this.hudLevelText = crispText(this, 36, 97, "", { fontSize: "11px", color: "#ffffff", align: "center" }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.hudSkillText = crispText(this, 58, 117, "", { fontSize: "10px", color: "#ddaaff", align: "center" }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.gameSpeed = 1;
    // Speed / mute float above the panel (depth 50) at the top-right.
    this.speedBtn = crispText(this, this.scale.width - 12, 8, "", { fontSize: "13px", color: "#fff", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(8, 4, 8, 4).setDepth(50).setInteractive({ useHandCursor: true });
    this.speedBtn.on("pointerdown", () => { this.gameSpeed = this.gameSpeed === 0 ? 1 : this.gameSpeed >= 3 ? 0 : this.gameSpeed + 1; this.updateSpeedBtn(); });
    this.updateSpeedBtn();
    const muteBtn = crispText(this, this.scale.width - 64, 8, "🔊", { fontSize: "13px", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(6, 4, 6, 4).setDepth(50).setInteractive({ useHandCursor: true });
    muteBtn.on("pointerdown", () => muteBtn.setText(this.sfx.toggleMute() ? "🔇" : "🔊"));
    this.ui.add([this.uiGfx, this.hud, this.banner, this.info, this.hudLevelText, this.hudSkillText, this.speedBtn, muteBtn]);

    this.panel = new BattleInfoPanel(this, this.ui, this.scale.width, this.scale.height, () => this.togglePanel());

    this.buildBuildBar();
    this.setupPlacementDrag(); // register drag handlers once (tiles rebuild without re-registering)
    this.bindInput();

    // Camera: world zoom-to-fit the FULL screen (panel overlays it); uiCam 1:1.
    const zoom = Math.min(this.scale.width / WORLD_WIDTH, this.scale.height / WORLD_HEIGHT);
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setZoom(zoom).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.cameras.main.ignore(this.ui);
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCam.ignore(this.world);

    // Pinch / wheel / drag-to-pan camera — zoom in to see sprites & combat VFX
    // at full resolution; drag the field to move the window once zoomed.
    this.camCtl = new BattleCameraController(this, this.cameras.main, {
      worldW: WORLD_WIDTH, worldH: WORLD_HEIGHT,
      minZoom: zoom, maxZoom: zoom * 2.4,
      blockAt: (p) => this.panel.hitsPanel(p.x) || this.panel.hitsTab(p.x, p.y) || p.y >= 500,
      isBusy: () => this.placeGhost != null,
    });
    this.addZoomButtons();

    this.panel.showHero(this.heroVM());  // build hero content (panel starts collapsed)
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard?.addKeys({
      up: KC.UP, down: KC.DOWN, left: KC.LEFT, right: KC.RIGHT,
      w: KC.W, a: KC.A, s: KC.S, d: KC.D,
    }) as typeof this.keys;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.killSaveDirty) { this.saveManager.flush(); this.killSaveDirty = false; }
      this.deselectTower();
      this.clearGhost();
      this.camCtl?.destroy();
      this.camCtl = undefined;
      this.terrainSprites.forEach((s) => s.destroy());
      this.terrainSprites = [];
    });
  }

  /** Persist mid-battle kill rewards at most ~once/sec to avoid storage thrash. */
  private maybeFlushKillRewards(): void {
    if (!this.killSaveDirty) return;
    const now = this.time.now;
    if (now - this.lastKillFlush < 1000) return;
    this.lastKillFlush = now;
    this.killSaveDirty = false;
    this.saveManager.flush();
  }

  private drawStatic(): void {
    const g = this.staticGfx;
    g.clear();
    this.terrainSprites.forEach((s) => s.destroy());
    this.terrainSprites = [];
    // Chapter backdrop (T2): a painted battlefield background per chapter theme,
    // with a subtle dark veil over it for unit contrast. Falls back to a flat
    // ground tint if the image failed to load.
    const theme = stageThemeForStage(this.stage.id);
    // Prefer the design team's hand-painted per-stage backdrop; fall back to the
    // per-chapter SDXL backdrop, then a flat ground tint.
    const stageBg = stageBgKey(this.stage.id);
    const bgKeyToUse = this.textures.exists(stageBg) ? stageBg : (this.textures.exists(theme.bgKey) ? theme.bgKey : null);
    if (bgKeyToUse) {
      const bg = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, bgKeyToUse).setDepth(-10);
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
      this.world.add(bg);
      this.terrainSprites.push(bg as unknown as Phaser.GameObjects.Image);
      // Lighter veil for the painted per-stage art (it's already balanced).
      const veil = bgKeyToUse === stageBg ? 0.22 : 0.4;
      g.fillStyle(theme.groundOverlay, veil).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    } else {
      g.fillStyle(0x202a22, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    // terrain features (T13): SVG art authored by the svg-asset-gen skill, drawn
    // as images above the ground but below units (depth 1). Falls back to a
    // tinted blob if a texture failed to load so the map is never blank.
    for (const f of this.stage.terrain ?? []) {
      const key = terrainKeyFor(f.type, f.x, f.y);
      if (this.textures.exists(key)) {
        // The art's silhouette fills ~0.45 of the 128px box; scale so the blob's
        // radius ≈ the feature radius (a touch of overhang reads as organic).
        const img = this.add.image(f.x, f.y, key)
          .setDisplaySize(f.r * 2.6, f.r * 2.6).setDepth(1);
        if (theme.terrainTint !== 0xffffff) img.setTint(theme.terrainTint); // match the biome
        if (!f.blocks) img.setAlpha(0.92); // decor sits a hair lighter than obstacles
        this.world.add(img);
        this.terrainSprites.push(img);
        continue;
      }
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
      c.add(crispText(this, 0, 14, `${def.cost}g`, { fontSize: "10px", color: "#ffd86a" }).setOrigin(0.5));
      const badge = this.add.graphics();
      this.drawTypeBadge(badge, (TW - 8) / 2 - 9, -8, def); // melee/ranged + role (T5)
      c.add(badge);
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
      if (!this.panel.hitsPanel(p.x) && p.y < 500 && this.battle.outcome === "ongoing") {
        if (this.battle.placeTowerAt(id, { x: wp.x, y: wp.y })) this.sfx.place();
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
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.tapX = pointer.x; this.tapY = pointer.y; });
    // Command on RELEASE, and only for a genuine tap — so a drag-to-pan, a pinch,
    // a wheel-zoom or a tower-placement drag never also walks the hero.
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (this.battle.outcome !== "ongoing") return;
      if (this.camCtl?.consumedGesture) return;                                   // pan / pinch / zoom gesture
      if (Math.hypot(pointer.x - this.tapX, pointer.y - this.tapY) > 8) return;    // a drag, not a tap
      // A tap on any interactive HUD/UI widget (speed & mute buttons, zoom
      // buttons, build-bar avatars, tower panel) must NOT command the hero.
      // Towers aren't interactive objects (tapped via towerAt), so tapping a
      // tower still falls through to the panel logic below.
      if (currentlyOver && currentlyOver.length > 0) return;
      if (this.panel.hitsPanel(pointer.x) || this.panel.hitsTab(pointer.x, pointer.y)) return; // over the panel / its tab
      if (pointer.y >= 500) return;          // bottom build-bar strip
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const world: Vec2 = { x: wp.x, y: wp.y };

      // Tap a tower → show it in the panel + on-map quick actions. Tap empty
      // ground → revert the panel to the hero view and walk the hero there.
      const tower = this.towerAt(world);
      if (tower) { this.selectTower(tower.uid); return; }
      this.deselectTower();
      this.battle.commandHero(world);
    });
  }

  /** ＋ / − zoom buttons on the left edge (HUD camera; fixed while the view pans). */
  private addZoomButtons(): void {
    const mk = (y: number, label: string, onTap: () => void) => {
      const b = crispText(this, 14, y, label, { fontSize: "22px", color: "#fff", backgroundColor: "#243a5a", fontStyle: "bold" })
        .setOrigin(0, 0.5).setPadding(9, 3, 9, 5).setDepth(50).setInteractive({ useHandCursor: true });
      b.on("pointerdown", onTap);
      this.ui.add(b);
    };
    mk(this.scale.height - 150, "+", () => this.camCtl?.zoomStep(true));
    mk(this.scale.height - 110, "−", () => this.camCtl?.zoomStep(false));
  }

  /** The alive tower under a tap, if any. */
  private towerAt(world: Vec2): TowerRuntime | null {
    for (const t of this.battle.towers) {
      if (t.alive && dist(world, t.pos) <= SLOT_RADIUS) return t;
    }
    return null;
  }

  // ── Right info panel (hero / tower views) ─────────────────────────────────

  /** Convert a world point to its on-screen pixel position under the battle camera. */
  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (wx - cam.worldView.x) * cam.zoom + cam.x, y: (wy - cam.worldView.y) * cam.zoom + cam.y };
  }

  /** Build the hero view model (the default panel content). */
  private heroVM(): HeroPanelVM {
    const save = this.saveManager.getSave();
    const h = this.battle.hero;
    const items: Record<string, PanelItem> = {};
    for (const slot of ITEM_SLOTS) {
      const instId = save.inventory.equipped[slot];
      const inst = instId ? save.inventory.items.find((it) => it.id === instId) : undefined;
      const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
      if (!inst || !def) continue;
      items[slot] = { iconKey: `item__${inst.defId}`, name: def.name, plus: inst.enhanceLevel ?? 0, rarityColor: RARITY_INT[def.rarity as Rarity] };
    }
    const skills = save.hero.equippedSkillIds
      .map((id) => ({ id, def: ACTIVE_SKILLS_MAP.get(id) }))
      .filter((e) => e.def)
      .map((e) => ({ label: `⚡ ${e.def!.name}`, desc: e.def!.description, color: "#a8d8ff", iconKey: `skill__${e.id}` }));
    return {
      kind: "hero", name: "Hero", level: save.hero.level,
      hp: h.hp, maxHp: h.stats.maxHp, mana: h.mana, maxMana: h.stats.maxMana,
      stats: statRows(h.stats as unknown as Record<string, number>, HERO_STAT_KEYS),
      items, skills,
    };
  }

  /** Build a tower view model from its runtime. */
  private towerVM(t: TowerRuntime): TowerPanelVM {
    const skills: { label: string; desc: string; color: string; iconKey?: string }[] = [];
    if (t.def.active) { const a = towerActiveInfo(t.def.active); skills.push({ label: `⚡ ${a.name}`, desc: activeSkillDetail(t.def, t.stats), color: "#a8d8ff", iconKey: `skill__${t.def.active}` }); }
    for (const pid of t.def.passives) { const p = passiveInfo(pid); skills.push({ label: `• ${p.name}`, desc: p.description, color: "#cdd6e6", iconKey: `skill__${pid}` }); }
    skills.push({ label: "▲ Upgrades", desc: upgradeSummary(t.def.role), color: "#ffd86a" });
    return {
      kind: "tower", uid: t.uid, name: t.def.name, iconKey: `tower__${t.def.id}`,
      stars: t.battleLevel,
      hp: t.hp, maxHp: t.stats.maxHp, mana: t.mana, maxMana: t.stats.maxMana,
      stats: statRows(t.stats as unknown as Record<string, number>, TOWER_STAT_KEYS),
      skills,
      upgradeCost: this.battle.upgradeCost(t.uid), sellValue: this.battle.sellValue(t.uid),
      maxed: this.battle.upgradeCost(t.uid) === 0,
    };
  }

  private showTowerPanel(t: TowerRuntime): void {
    const uid = t.uid;
    this.panel.showTower(this.towerVM(t), {
      onUpgrade: () => this.doUpgrade(uid),
      onSell: () => this.confirmSell(uid),
      onUpgradeHover: (over) => { this.rangePreviewUid = over ? uid : -1; },
    });
  }

  /** Toggle button on the panel edge: collapse, or expand (showing the hero by default). */
  private togglePanel(): void {
    if (this.panel.isOpen()) { this.panel.setOpen(false); }
    else { if (this.selectedTowerUid < 0) this.panel.showHero(this.heroVM()); this.panel.setOpen(true); }
  }

  /** Select a tower: open the panel with its info + on-map quick-action icons. */
  private selectTower(uid: number): void {
    const t = this.battle.towers.find((x) => x.uid === uid && x.alive);
    if (!t) return;
    this.selectedTowerUid = uid;
    this.showTowerPanel(t);
    this.panel.setOpen(true);
    this.buildQuickActions(t);
  }

  /** Drop the tower selection: revert the panel to the hero view + remove quick actions. */
  private deselectTower(): void {
    if (this.selectedTowerUid < 0) return;
    this.selectedTowerUid = -1;
    this.rangePreviewUid = -1;
    this.quickActions?.destroy(true);
    this.quickActions = null;
    this.panel.showHero(this.heroVM());
  }

  private doUpgrade(uid: number): void {
    if (this.battle.upgradeTower(uid)) {
      const t = this.battle.towers.find((x) => x.uid === uid);
      if (t) { this.fx.starUp(t.pos, t.battleLevel); this.sfx.place(); this.showTowerPanel(t); this.buildQuickActions(t); }
    }
  }
  /** Ask before selling a tower — selling is irreversible and refunds < cost. */
  private confirmSell(uid: number): void {
    const t = this.battle.towers.find((x) => x.uid === uid && x.alive);
    if (!t) return;
    this.confirmDialog?.destroy(true);
    const W = this.scale.width, H = this.scale.height;
    const refund = this.battle.sellValue(uid);
    const c = this.add.container(0, 0).setDepth(70);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);
    const dimZone = this.add.zone(W / 2, H / 2, W, H).setInteractive().on("pointerup", () => this.closeConfirm());
    c.add([dim, dimZone]);

    const bw = 300, bh = 132, bx = (W - bw) / 2, by = (H - bh) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x141c28, 0.99).fillRoundedRect(bx, by, bw, bh, 10);
    panel.lineStyle(2, 0x7a2e2e, 1).strokeRoundedRect(bx, by, bw, bh, 10);
    const panelZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive(); // swallow clicks
    c.add([panel, panelZone]);

    c.add(crispText(this, W / 2, by + 18, "Sell this tower?", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0));
    c.add(crispText(this, W / 2, by + 44, `${t.def.name}\nRefund +${refund}g`, { fontSize: "12px", color: "#ffd6a0", align: "center" }).setOrigin(0.5, 0));

    const yes = crispText(this, bx + bw / 2 - 70, by + bh - 34, "Sell", { fontSize: "14px", color: "#fff", backgroundColor: "#7a2e2e", fixedWidth: 96, align: "center" })
      .setOrigin(0.5, 0).setPadding(0, 8, 0, 8).setInteractive({ useHandCursor: true });
    yes.on("pointerup", () => { this.closeConfirm(); this.doSell(uid); });
    const no = crispText(this, bx + bw / 2 + 70, by + bh - 34, "Cancel", { fontSize: "14px", color: "#fff", backgroundColor: "#33415a", fixedWidth: 96, align: "center" })
      .setOrigin(0.5, 0).setPadding(0, 8, 0, 8).setInteractive({ useHandCursor: true });
    no.on("pointerup", () => this.closeConfirm());
    c.add([yes, no]);

    this.ui.add(c);
    this.confirmDialog = c;
  }

  private closeConfirm(): void {
    this.confirmDialog?.destroy(true);
    this.confirmDialog = null;
  }

  private doSell(uid: number): void {
    this.battle.sellTower(uid);
    this.time.delayedCall(0, () => this.deselectTower());
  }

  /** Two compact upgrade/sell icons floating above the selected tower (UI layer, crisp). */
  private buildQuickActions(t: TowerRuntime): void {
    this.quickActions?.destroy(true);
    const s = this.worldToScreen(t.pos.x, t.pos.y - 22);
    const c = this.add.container(s.x, s.y).setDepth(48);
    const mk = (dx: number, glyph: string, cost: string, bg: number, onClick: () => void, onHover?: (over: boolean) => void): void => {
      const g = this.add.graphics();
      g.fillStyle(bg, 0.96).fillRoundedRect(dx - 19, -13, 38, 26, 5);
      g.lineStyle(1.5, 0xffffff, 0.55).strokeRoundedRect(dx - 19, -13, 38, 26, 5);
      c.add(g);
      c.add(crispText(this, dx, -11, glyph, { fontSize: "12px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5, 0));
      c.add(crispText(this, dx, 2, cost, { fontSize: "8px", color: "#ffe7a0" }).setOrigin(0.5, 0));
      // Interactive zone uses CONTAINER-RELATIVE coords so the click lands on the
      // icon (and the scene's pointerdown bails on currentlyOver → hero won't move).
      const z = this.add.zone(dx, 0, 38, 26).setInteractive({ useHandCursor: true });
      z.on("pointerup", onClick);
      if (onHover) { z.on("pointerover", () => onHover(true)); z.on("pointerout", () => onHover(false)); }
      c.add(z);
    };
    const cost = this.battle.upgradeCost(t.uid);
    // Hovering the upgrade icon reveals this tower's attack range ring.
    mk(-21, "⬆", cost === 0 ? "MAX" : `${cost}g`, cost === 0 ? 0x555555 : 0x1565c0,
      () => this.doUpgrade(t.uid), (over) => { this.rangePreviewUid = over ? t.uid : -1; });
    mk(22, "✕", `+${this.battle.sellValue(t.uid)}g`, 0x7a2e2e, () => this.confirmSell(t.uid));
    this.ui.add(c);
    this.quickActions = c;
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
    if (this.selectedTowerUid >= 0) {
      const t = this.battle.towers.find((x) => x.uid === this.selectedTowerUid && x.alive);
      if (!t) this.deselectTower();
      else this.panel.tick({ hp: t.hp, maxHp: t.stats.maxHp, mana: t.mana, maxMana: t.stats.maxMana, gold: this.battle.gold, upgradeCost: this.battle.upgradeCost(t.uid) });
    } else {
      const h = this.battle.hero;
      this.panel.tick({ hp: h.hp, maxHp: h.stats.maxHp, mana: h.mana, maxMana: h.stats.maxMana, gold: this.battle.gold, upgradeCost: 0 });
    }

    this.manageSprites();
    for (const ev of this.battle.fx) this.playFx(ev);
    this.maybeFlushKillRewards();
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
      if (!this._victoryProcessed) this.sfx.win();
      this.showBattleRewards("won");
    } else if (b.outcome === "lost") {
      this.banner.setText("DEFEAT").setColor("#ef9a9a");
      if (!this._defeatPlayed) { this._defeatPlayed = true; this.sfx.lose(); }
      this.showBattleRewards("lost");
    }

    if (b.outcome !== "ongoing" && !this._menuBtn) {
      this._menuBtn = crispText(this, this.battleW / 2, 478, "← Return to Menu", {
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

  /**
   * Show the post-battle loot screen (win OR loss). It merges loot gathered
   * during the run (item/box drops + XP from kills, kept even on a loss) with
   * the stage-clear rewards (won only), rendering every reward as an icon tile
   * with hover detail. Runs once per battle.
   */
  private showBattleRewards(outcome: "won" | "lost"): void {
    if (this._rewardsShown) return;
    this._rewardsShown = true;
    this._victoryProcessed = true;

    // afterBattle persists the stage-clear rewards and returns them (won only).
    const clear = outcome === "won"
      ? this.saveManager.afterBattle(this.stage.id, "won", this.battle.difficulty, new Rng(Date.now()))
      : null;

    // Special-mode payouts layered on top of the normal stage rewards.
    let modeNote = "";
    const wavesReached = Math.max(0, this.battle.waveIndex + 1);
    if (this.battleMode.kind === "challenge" && outcome === "won") {
      const r = this.saveManager.claimChallengeClear(new Date().toISOString().slice(0, 10));
      if (r) modeNote = `Daily Challenge cleared! ${rewardLabel(r)}`;
    } else if (this.battleMode.kind === "endless") {
      const pb = this.saveManager.recordEndlessWave(this.stage.id, wavesReached);
      modeNote = `Endless: reached wave ${wavesReached}${pb ? " — new best!" : ""}`;
    } else if (this.battleMode.kind === "bossrush") {
      const r = this.saveManager.recordBossRushTier(isoWeekKey(new Date()), wavesReached);
      modeNote = `Boss Rush: tier ${wavesReached}${rewardLabel(r) ? ` · ${rewardLabel(r)}` : ""}`;
    }
    // F14 flawless victory → a bonus boss chest.
    if (outcome === "won" && this.battleMode.kind === "normal" && this.battle.wasFlawless()) {
      this.saveManager.addMaterial(boxIdForTier(3), 1);
      modeNote = "Flawless! +1 Rare Boss Chest";
    }

    const summary = buildLootSummary(outcome, this.battle.battleLoot, clear);
    this.ui.add(showBattleLootPanel(this, summary, this.battleW / 2, 182));
    if (modeNote) this.ui.add(crispText(this, this.battleW / 2, 150, modeNote, { fontSize: "14px", color: "#ffe07a", fontStyle: "bold", stroke: "#1a1206", strokeThickness: 4 }).setOrigin(0.5).setDepth(40));
  }

  /** Render one sim FX event, and trigger sprite animations (attack swing, hit flash). */
  private playFx(ev: FxEvent): void {
    this.fx.play(ev);
    if (ev.type === "attack") {
      this.sfx.attack(ev.ranged);
      if (ev.source === "hero") {
        this.heroSprite?.playAttack();   // body anim + weapon swing arc
      } else {
        this.playSpriteOneShot(this.towerSprites.get(ev.uid) ?? null, ["attack"], "idle");
      }
    } else if (ev.type === "hit") {
      this.sfx.hit();
      const e = this.enemySprites.get(ev.uid);
      if (e) { this.flash(e, 0xffffff); e.setData("hurtUntil", this.time.now + 160); } // hurt squash (procedural fallback)
      this.playSpriteOneShot(e ?? null, ["hurt"], "walk");    // enemy/boss recoil frames
    } else if (ev.type === "enemyAttack") {
      this.sfx.enemyHit();
      const victim = ev.target === "hero" ? (this.heroSprite?.getBodySprite() ?? null) : this.towerNear(ev.targetAt);
      if (victim) this.flash(victim, 0xff4444);
      if (ev.target === "hero") this.heroSprite?.playHurt();   // recoil + hurt frames
      this.playSpriteOneShot(this.enemySprites.get(ev.uid) ?? null, ["attack"], "walk"); // enemy/boss attack swing (atk1/atk2 frames)
    } else if (ev.type === "death") {
      this.sfx.death();
    } else if (ev.type === "cast") {
      this.sfx.cast();
      if (ev.source === "hero") this.heroSprite?.playCast();   // hero skill frames + flourish
      else this.playSpriteOneShot(this.towerSprites.get(ev.uid) ?? null, ["skill", "attack"], "idle"); // tower active skill
    } else if (ev.type === "bossCast") {
      this.playSpriteOneShot(this.enemySprites.get(ev.uid) ?? null, ["skill", "attack"], "walk"); // boss ability
    } else if (ev.type === "loot") {
      this.sfx.coin();
    } else if (ev.type === "killReward") {
      this.killSaveDirty = true;   // XP/loot already in the save; flush debounced
      // F17 loot fanfare: a high-tier boss chest gets an escalated cue.
      if (ev.box) {
        const tier = Number(ev.box.match(/t(\d)$/)?.[1] ?? 1);
        if (tier >= 4) { this.sfx.coin(); this.cameras.main.flash(180, 255, 230, 150); }
        this.floatWorldText(ev.at.x, ev.at.y, tier >= 4 ? "✦ RARE CHEST!" : "Chest!", tier >= 4 ? "#ffd24d" : "#cfe0f5", tier >= 4 ? 16 : 12);
      }
    } else if (ev.type === "combo") {
      // F13: escalating kill-streak text, hotter as the streak climbs.
      const hot = ev.mult >= 2.4 ? "#ff5a3c" : ev.mult >= 1.7 ? "#ffae3c" : "#ffe07a";
      this.floatWorldText(ev.at.x, ev.at.y, `${ev.count}x  ·  ×${ev.mult.toFixed(1)}`, hot, 12 + Math.min(10, ev.count / 3));
    } else if (ev.type === "perfect") {
      // F14: brief center banner + sting for a flawless wave.
      this.flashBanner(`PERFECT WAVE!  +${ev.bonus}🪙`, "#9fe0b0");
      this.sfx.coin();
    }
  }

  /** Floating, rising, fading text at a WORLD position (combo/loot fanfare). */
  private floatWorldText(wx: number, wy: number, msg: string, color: string, size: number): void {
    const t = crispText(this, wx, wy, msg, { fontSize: `${Math.round(size)}px`, color, fontStyle: "bold", stroke: "#1a1206", strokeThickness: 3 })
      .setOrigin(0.5).setDepth(14);
    this.world.add(t);
    this.tweens.add({ targets: t, y: wy - 28, alpha: 0, scale: 1.25, duration: 760, ease: "Sine.easeOut", onComplete: () => t.destroy() });
  }

  /** Briefly flash a message on the big center banner, then clear it. */
  private flashBanner(msg: string, color: string): void {
    this.banner.setText(msg).setColor(color).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: "Back.easeOut" });
    this.time.delayedCall(1100, () => this.tweens.add({ targets: this.banner, alpha: 0, duration: 350, onComplete: () => this.banner.setText("") }));
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

  /**
   * Play the first existing of `names` once on a sprite, then return to its
   * looping `base` animation (towers → idle, enemies/bosses → walk). Missing
   * clips fall through the list (so skill→attack fallback works), and a no-op
   * keeps the base playing — partial/old sheets degrade gracefully.
   */
  private playSpriteOneShot(s: Phaser.GameObjects.Sprite | null, names: string[], base: string): void {
    if (!s || !s.active) return;
    const key = s.texture.key;
    const anim = names.map((n) => `${key}_${n}`).find((a) => this.anims.exists(a));
    if (!anim) return;
    if (s.anims.currentAnim?.key === anim && s.anims.isPlaying) return; // already playing it
    s.play(anim);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (s.active && this.anims.exists(`${key}_${base}`)) s.play(`${key}_${base}`);
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
      const baseScale = displayH / s.height;
      s.setScale(baseScale).setData("baseScale", baseScale);
      this.world.add(s);
      map.set(uid, s);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    }
    s.setPosition(x, y);
    return s;
  }

  /**
   * Procedural enemy animation driving the single SDXL creature sprite so it
   * feels alive: GROUND enemies walk with a waddle + stride bob + breathing,
   * FLYING enemies hover above the lane with a smooth float + wing-sway tilt,
   * and any enemy squashes/recoils when HURT (set by the hit FX). Bosses with a
   * real rig walk sheet play that instead. Frozen enemies stand still + shiver.
   */
  private animateEnemy(s: Phaser.GameObjects.Sprite, e: EnemyRuntime, key: string): void {
    const frozen = e.slowPct >= 0.6;
    if (this.anims.exists(`${key}_walk`)) {
      // Don't interrupt a one-shot (attack / skill / hurt) — it returns to walk itself.
      const cur = s.anims.currentAnim?.key;
      const inOneShot = s.anims.isPlaying &&
        (cur === `${key}_attack` || cur === `${key}_skill` || cur === `${key}_hurt`);
      if (!frozen && !inOneShot && cur !== `${key}_walk`) s.play(`${key}_walk`);
      return;
    }

    const base = (s.getData("baseScale") as number) ?? s.scaleX;
    const now = this.time.now;
    const t = now * 0.011 + e.uid * 1.7;
    let scaleX = base, scaleY = base, angle = 0, yOff = 0;

    if (e.def.flying) {
      yOff = -14 - Math.sin(t * 1.4) * 5;               // lift + hover bob
      angle = Math.sin(t * 1.4) * 4;                    // wing-sway tilt
      const breathe = 1 + Math.sin(t * 2) * 0.03;
      scaleX = base * breathe; scaleY = base * breathe;
    } else if (frozen) {
      angle = Math.sin(now * 0.05) * 1.2;               // faint shiver
    } else {
      angle = Math.sin(t) * 5;                          // walk waddle
      yOff = -Math.abs(Math.sin(t * 2)) * 2.2;          // stride bob
      scaleY = base * (1 + Math.sin(t * 2) * 0.02);     // breathing
    }

    // Hurt squash overlays the base motion (set on the hit FX, decays ~160ms).
    const hurtUntil = (s.getData("hurtUntil") as number) ?? 0;
    if (now < hurtUntil) {
      const k = (hurtUntil - now) / 160;                // 1 → 0
      scaleX = base * (1 + 0.18 * k);
      scaleY = base * (1 - 0.22 * k);
      angle *= 0.3;
    }

    s.setAngle(angle);
    s.setScale(scaleX, scaleY);
    s.y = e.pos.y + yOff;
  }

  /** Create/update/cull pixel-art sprites for towers, enemies and the hero. */
  private manageSprites(): void {
    const seenT = new Set<number>();
    for (const t of this.battle.towers) {
      if (!t.alive) continue;
      const s = this.ensureSprite(this.towerSprites, t.uid, `tower__${t.def.id}`, t.pos.x, t.pos.y, 50);
      if (s) {
        seenT.add(t.uid);
        s.setAlpha(t.disabledTimer > 0 ? 0.5 : 1);
        if (s.height) s.setScale((50 / s.height) * (1 + 0.05 * t.battleLevel)); // grow as upgraded (T10)
      }
    }
    for (const [uid, s] of this.towerSprites) if (!seenT.has(uid)) { s.destroy(); this.towerSprites.delete(uid); }

    const seenE = new Set<number>();
    for (const e of this.battle.enemies) {
      const boss = e.def.archetype === "Boss";
      const key = `${boss ? "boss" : "enemy"}__${e.def.id}`;
      // Elites render 150% bigger so the player can spot them at a glance (T17).
      const displayH = (boss ? 80 : 44) * (e.elite ? ELITE_SIZE_MULT : 1);
      const s = this.ensureSprite(this.enemySprites, e.uid, key, e.pos.x, e.pos.y, displayH);
      if (s) {
        seenE.add(e.uid);
        s.setAlpha(e.stealth ? (e.revealed ? 0.78 : 0.3) : 1);
        const tint = enemyStatusTint(e);   // burn/poison/freeze body tint (T8)
        if (tint === null) s.clearTint(); else s.setTint(tint);
        this.animateEnemy(s, e, key);      // walk / fly / hurt animation
      }
    }
    for (const [uid, s] of this.enemySprites) if (!seenE.has(uid)) { s.destroy(); this.enemySprites.delete(uid); }

    const h = this.battle.hero;
    if (h.alive && hasSprite(this, "hero__hero")) {
      if (!this.heroSprite) {
        const hs = new HeroLayeredSprite(this, h.pos.x, h.pos.y);
        hs.scaleToHeight(54).setDepth(3);
        hs.addToWorld(this.world);
        if (this.anims.exists("hero__hero_idle")) hs.play("hero__hero_idle");
        if (this.saveManager) hs.syncEquipment(this.saveManager.getSave().inventory);
        this.heroSprite = hs;
      }
      this.heroSprite.setPosition(h.pos.x, h.pos.y);
      this.heroSprite.setVisible(true);
      // Sync equipment visuals each frame (no-op when nothing changed)
      if (this.heroSprite && this.saveManager) {
        this.heroSprite.syncEquipment(this.saveManager.getSave().inventory);
      }
      // Drive locomotion (walk vs float), facing, wing hover and pet wander.
      const dx = h.moveTarget.x - h.pos.x, dy = h.moveTarget.y - h.pos.y;
      const moving = Math.hypot(dx, dy) > 1.5;
      const facingLeft = dx < -0.5 ? true : dx > 0.5 ? false : undefined;
      this.heroSprite.tick(this.time.now, moving, facingLeft);
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
    // No range ring on a placed tower normally — it only appears while hovering
    // the upgrade button, and then it previews the POST-UPGRADE range (falling
    // back to the current range when the tower is already maxed).
    if (t.uid === this.rangePreviewUid) {
      const r = this.battle.previewUpgradeRange(t.uid) ?? t.stats.range;
      g.lineStyle(1.5, color, 0.5).strokeCircle(t.pos.x, t.pos.y, r);
    }
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
    // Upgrade glow — upgraded towers carry a gold aura that intensifies (T10).
    if (t.battleLevel > 0 && !disabled) {
      const a = 0.1 + 0.05 * t.battleLevel;
      g.fillStyle(0xffd34d, a * 0.5).fillCircle(t.pos.x, t.pos.y, 19);
      g.lineStyle(2, 0xffd34d, Math.min(0.85, a + 0.25)).strokeCircle(t.pos.x, t.pos.y, 17);
    }
    // Star pips — how many in-battle stars this tower has (T11).
    if (t.battleLevel > 0) this.drawStarPips(g, t.pos.x, t.pos.y - 30, t.battleLevel);
    // Type badge — melee vs ranged + role colour, upper-right of the avatar (T5).
    this.drawTypeBadge(g, t.pos.x + 13, t.pos.y - 16, t.def);
  }

  /** A row of small gold stars marking a tower's in-battle upgrade level. */
  private drawStarPips(g: Phaser.GameObjects.Graphics, cx: number, cy: number, count: number): void {
    const gap = 8;
    const startX = cx - ((count - 1) * gap) / 2;
    for (let i = 0; i < count; i++) {
      const x = startX + i * gap;
      g.fillStyle(0x000000, 0.4).fillPoints(starPoints(x, cy + 0.6, 4.4, 1.9), true);
      g.fillStyle(0xffd34d, 1).fillPoints(starPoints(x, cy, 3.8, 1.6), true);
    }
  }

  /** Small badge showing tower type (melee/ranged) tinted by role, upper-right. */
  private drawTypeBadge(g: Phaser.GameObjects.Graphics, x: number, y: number, def: CharacterDef): void {
    const kind = towerKind(def);
    g.fillStyle(0x10141c, 0.9).fillCircle(x, y, 7.5);
    g.lineStyle(1.5, KIND_COLOR[kind], 1).strokeCircle(x, y, 7.5);
    g.fillStyle(ROLE_COLOR[def.role] ?? 0xffffff, 0.5).fillCircle(x, y, 6);
    g.lineStyle(1.6, 0xffffff, 0.95);
    if (kind === "melee") {
      // a little sword: blade + crossguard
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 3.2); g.strokePath();
      g.beginPath(); g.moveTo(x - 2.4, y + 1.4); g.lineTo(x + 2.4, y + 1.4); g.strokePath();
    } else {
      // a little arrow pointing right
      g.beginPath(); g.moveTo(x - 3.4, y); g.lineTo(x + 3, y); g.strokePath();
      g.beginPath(); g.moveTo(x + 0.6, y - 2.4); g.lineTo(x + 3.4, y); g.lineTo(x + 0.6, y + 2.4); g.strokePath();
    }
  }

  /** A dashed circle (stealth "hidden" marker). */
  private drawDashedRing(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const a0 = (Math.PI * 2 * i) / segs;
      g.beginPath();
      g.arc(cx, cy, radius, a0, a0 + ((Math.PI * 2) / segs) * 0.55, false);
      g.strokePath();
    }
  }

  /** A small eye glyph (stealth "spotted" marker). */
  private drawEye(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    g.fillStyle(color, 0.95).fillEllipse(x, y, 11, 6);
    g.fillStyle(0x10131c, 1).fillCircle(x, y, 2);
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyRuntime): void {
    const boss = e.def.archetype === "Boss";
    const r = (boss ? 16 : e.flying ? 8 : 10) * (e.elite ? ELITE_SIZE_MULT : 1);
    const alpha = e.stealth ? 0.4 : 1;
    const base = e.enraged ? 0xff5252 : e.flying ? 0xce93d8 : boss ? 0xb71c1c : 0xe57373;
    // Elite aura (T17): a pulsing gold double-ring so elites read instantly.
    if (e.elite) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.006 + e.uid);
      const ar = r + 6 + pulse * 4;
      g.fillStyle(0xffd34d, 0.12 + pulse * 0.08).fillCircle(e.pos.x, e.pos.y, ar);
      g.lineStyle(2, 0xffe082, 0.85).strokeCircle(e.pos.x, e.pos.y, ar);
      g.lineStyle(1, 0xfff3c4, 0.5).strokeCircle(e.pos.x, e.pos.y, r + 3);
    }
    if (!this.enemySprites.has(e.uid)) g.fillStyle(base, alpha).fillCircle(e.pos.x, e.pos.y, r);
    else if (e.enraged) g.lineStyle(2, 0xff5252, 0.8).strokeCircle(e.pos.x, e.pos.y, r + 4);
    if (e.stunTimer > 0) g.lineStyle(2, 0xfff176, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    else if (e.slowPct > 0) g.lineStyle(2, 0x4fc3f7, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    // Stealth (T9): a ghostly cyan dashed ring while hidden; an orange "spotted"
    // ring + eye when revealed by the hero (towers can then hit it).
    if (e.stealth) {
      if (e.revealed) {
        g.lineStyle(2, 0xffa726, 0.95).strokeCircle(e.pos.x, e.pos.y, r + 6);
        this.drawEye(g, e.pos.x, e.pos.y - r - 11, 0xffd27a);
      } else {
        this.drawDashedRing(g, e.pos.x, e.pos.y, r + 5, 0x80deea, 0.8);
      }
    }
    const w = boss ? 40 : e.elite ? 30 : 20;
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
    // Boss skill mana bar (T16).
    const bskill = e.def.boss?.skill;
    if (bskill) {
      const mf = Phaser.Math.Clamp(e.mana / bskill.manaCost, 0, 1);
      g.fillStyle(0x000000, 0.6).fillRect(e.pos.x - w / 2, top + 5, w, 3);
      g.fillStyle(0xb085f5, 1).fillRect(e.pos.x - w / 2, top + 5, w * mf, 3);
    }
    // Status glyphs (T8): burning / poison / freeze above the bar.
    this.drawStatusGlyphs(g, e, top - (e.shield > 0 ? 12 : 8));
  }

  /** Burning / poison / freeze status glyphs over an enemy (T8). */
  private drawStatusGlyphs(g: Phaser.GameObjects.Graphics, e: EnemyRuntime, gy: number): void {
    const kinds: ("burn" | "poison" | "freeze")[] = [];
    if (e.dots.length > 0) kinds.push(e.dots[0].type === "Magic" ? "poison" : "burn");
    if (e.slowPct >= 0.6) kinds.push("freeze");
    if (kinds.length === 0) return;
    const gap = 11;
    const startX = e.pos.x - ((kinds.length - 1) * gap) / 2;
    kinds.forEach((k, i) => this.drawStatusGlyph(g, k, startX + i * gap, gy));
  }

  private drawStatusGlyph(g: Phaser.GameObjects.Graphics, kind: "burn" | "poison" | "freeze", x: number, y: number): void {
    g.fillStyle(0x10131c, 0.55).fillCircle(x, y, 5.5); // dark backing for contrast
    if (kind === "burn") {
      g.fillStyle(0xff6a2a, 1).fillTriangle(x - 3.2, y + 3, x, y - 5, x + 3.2, y + 3);
      g.fillStyle(0xffd24d, 1).fillTriangle(x - 1.5, y + 3, x, y - 1, x + 1.5, y + 3);
    } else if (kind === "poison") {
      g.fillStyle(0x8bc34a, 1);
      g.fillCircle(x - 2, y + 1.5, 2.1); g.fillCircle(x + 1.8, y - 1, 1.7); g.fillCircle(x + 1.6, y + 2.2, 1.3);
    } else {
      g.lineStyle(1.7, 0xaee6ff, 0.95);
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
        g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
        g.strokePath();
      }
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

    if (save.hero.equippedSkillIds.length > 0) {
      const names = save.hero.equippedSkillIds.map((id) => ACTIVE_SKILLS_MAP.get(id)?.name ?? id);
      g.fillStyle(0x442266, 1).fillRect(8, 110, 100, 14);
      this.hudSkillText.setText(`Skill: ${names.join(", ")}`).setVisible(true);
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
