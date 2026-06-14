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
 *
 * The scene is large, so its behaviour is split by concern into sibling modules
 * and merged onto the prototype below via declaration merging:
 *   - battleSceneRender.ts  — per-frame draw() + vector-shape drawing
 *   - battleSceneSprites.ts — pooled sprites, procedural animation, FX events
 *   - battleSceneInput.ts   — pointer/keyboard, info panel, tower actions, rewards
 * This file keeps construction, scene setup, and the Phaser lifecycle hooks.
 * Fields the modules read are public-but-internal — not a public API.
 */
import Phaser from "phaser";
import { BattleState, type FxEvent } from "../core/battle.ts";
import { FixedStepper, SIM_STEP } from "../core/fixedStep.ts";
import { snapshotPositions } from "./renderLerp.ts";
import { loadCatalog, type Catalog } from "../data/catalog.ts";
import {
  defaultHeroStats,
  STAGE_1,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  stageNumber,
} from "../data/stage.ts";
import { endlessArenaStage } from "../core/endlessArena.ts";
import type { EndlessBackdropFx } from "./endlessBackdropFx.ts";
import type { BattleTilemap } from "./battleTilemap.ts";
import type { CharacterDef, Difficulty, StageDef } from "../data/schema.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { crispText } from "./ui.ts";
import { fadeIn, DUR } from "./uiKit.ts";
import { BattleInfoPanel } from "./battleInfoPanel.ts";
import { FxLayer } from "./fx.ts";
import { Sfx } from "./audio.ts";
import type { ChallengeEffects } from "../data/challengeModifiers.ts";
import { type HeroLayeredSprite } from "./HeroLayeredSprite.ts";
import { BattleCameraController } from "./battleCamera.ts";
import { RARITY_INT, buildSquad } from "./battleSceneHelpers.ts";
import { renderMethods, type RenderMethods } from "./battleSceneRender.ts";
import { spritesMethods, type SpritesMethods } from "./battleSceneSprites.ts";
import { inputMethods, type InputMethods } from "./battleSceneInput.ts";
import { placementMethods, type PlacementMethods } from "./battleScenePlacement.ts";
import { towerTex } from "../data/assetKeys.ts";
import { type CastleState } from "./castleArt.ts";
import { TAP_SLOP_PX } from "../core/gesture.ts";
import { emptyPlacement, type PlacementState } from "../core/placementMode.ts";

/** A special battle mode launched from the Activities hub (else a normal stage). */
export interface BattleMode {
  kind: "normal" | "challenge" | "endless" | "bossrush";
  challenge?: ChallengeEffects;
  endlessMul?: number;
}

/** The per-concern scene methods split into sibling modules are merged in below. */
export interface BattleScene
  extends RenderMethods,
    SpritesMethods,
    InputMethods,
    PlacementMethods {}

export class BattleScene extends Phaser.Scene {
  catalog!: Catalog;
  battle!: BattleState;
  stage!: StageDef;
  difficulty!: Difficulty;
  battleMode: BattleMode = { kind: "normal" };
  buildOrder: CharacterDef[] = [];
  saveManager!: SaveManager;

  staticGfx!: Phaser.GameObjects.Graphics;
  dynGfx!: Phaser.GameObjects.Graphics;
  uiGfx!: Phaser.GameObjects.Graphics; // screen-space HUD shapes
  world!: Phaser.GameObjects.Layer; // battlefield (zoomed camera)
  ui!: Phaser.GameObjects.Layer; // HUD (fixed camera)
  hud!: Phaser.GameObjects.Text;
  banner!: Phaser.GameObjects.Text;
  info!: Phaser.GameObjects.Text;
  avatarTiles: Phaser.GameObjects.Container[] = [];
  avatarPulses: Phaser.Tweens.Tween[] = []; // breathing-glow tweens on rarer build-bar cards
  terrainSprites: Phaser.GameObjects.Image[] = [];
  /** SDXL castle sprite (when art exists); swaps to damaged art at low HP. */
  castleSprite?: Phaser.GameObjects.Image;
  castleArtStateNow: CastleState = "intact";
  endlessBackdropFx: EndlessBackdropFx | null = null;
  /** Top-down ground + auto-tiled road tilemap (replaces the painted backdrop). */
  battleTilemap: BattleTilemap | null = null;
  placeGhost: Phaser.GameObjects.Container | null = null;
  /** Tap-to-place: which build-bar card (if any) is armed for a field tap. */
  placement: PlacementState = emptyPlacement();
  gameSpeed = 1;
  /** Fixed-timestep driver — the sim only ever ticks in SIM_STEP increments. */
  stepper = new FixedStepper();
  /** Sim fx batched across this frame's fixed steps (the sim clears its own array per tick). */
  pendingFx: FxEvent[] = [];
  /** Enemy/hero positions as of the START of the latest sim step (render interpolation). */
  prevEnemyPos = new Map<number, { x: number; y: number }>();
  prevHeroPos: { x: number; y: number } | null = null;
  renderAlpha = 1; // lerp factor for draw(); 1 = draw live sim state
  // Reused per-frame dirty-tracking sets for manageSprites (no per-frame allocation).
  _seenT = new Set<number>();
  _seenE = new Set<number>();
  speedBtn!: Phaser.GameObjects.Text;
  callWaveBtn!: Phaser.GameObjects.Text;
  autoSkipText!: Phaser.GameObjects.Text;
  sfx = new Sfx();
  hudLevelText!: Phaser.GameObjects.Text;
  hudSkillText!: Phaser.GameObjects.Text;

  _victoryProcessed = false;
  _defeatPlayed = false;
  _rewardsShown = false;
  _menuBtn: Phaser.GameObjects.Text | null = null;
  killSaveDirty = false; // kill XP/loot pending a debounced flush
  lastKillFlush = 0;

  // Pixel-art sprite pools (keyed by entity uid); fall back to shapes if missing.
  towerSprites = new Map<number, Phaser.GameObjects.Sprite>();
  roleBadges = new Map<number, Phaser.GameObjects.Image>(); // per-tower role emblem
  enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  enemyShadows = new Map<number, Phaser.GameObjects.Ellipse>(); // ground-contact anchors

  heroSprite: HeroLayeredSprite | null = null;
  fx!: FxLayer;
  camCtl?: BattleCameraController;
  tapX = 0;
  tapY = 0;
  panel!: BattleInfoPanel;
  battleW = 0;
  selectedTowerUid = -1;
  quickActions: Phaser.GameObjects.Container | null = null;
  confirmDialog: Phaser.GameObjects.Container | null = null;
  rangePreviewUid = -1; // tower whose range ring to show (on upgrade hover)
  keys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
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
    this.roleBadges.clear();
    this.enemySprites.clear();
    this.enemyShadows.clear();
    this.heroSprite = null;
    this.selectedTowerUid = -1;
    this.quickActions = null;
    this.confirmDialog = null;
    this.rangePreviewUid = -1;
    this.avatarTiles = []; // stale refs from a prior battle are destroyed by shutdown
    this.avatarPulses = [];
    this.terrainSprites = [];
    this.endlessBackdropFx?.destroy();
    this.endlessBackdropFx = null;
    this.battleTilemap?.destroy();
    this.battleTilemap = null;
    this.placeGhost = null;
    this.placement = emptyPlacement();
    this.stepper.reset();
    this.pendingFx = [];
    this.prevEnemyPos.clear();
    this.prevHeroPos = null;
    this.renderAlpha = 1;

    // Stage and difficulty come from StageSelectScene via registry; fall back to stage 1 / Normal
    this.stage = (this.registry.get("selectedStage") as StageDef | undefined) ?? STAGE_1;
    this.difficulty =
      (this.registry.get("selectedDifficulty") as Difficulty | undefined) ?? "Normal";
    // Optional special mode (F5 challenge / F11 endless / F12 boss rush) from the
    // Activities hub; cleared after reading so it doesn't leak into the next battle.
    this.battleMode = (this.registry.get("battleMode") as BattleMode | undefined) ?? {
      kind: "normal",
    };
    this.registry.set("battleMode", undefined);

    // Endless mode fights on a generated maze arena (central castle, multi-gate
    // roads) instead of reusing the cleared stage's single lane. Seeded by stage
    // number so each endless stage has a stable, learnable battlefield.
    if (this.battleMode.kind === "endless") {
      this.stage = endlessArenaStage(this.stage, stageNumber(this.stage.id) || 1);
    }

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
      endless: this.battleMode.kind === "endless",
      bossRush: this.battleMode.kind === "bossrush",
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
    this.hud = crispText(this, 10, 8, "", {
      fontSize: "15px",
      color: "#ffffff",
      wordWrap: { width: this.battleW - 120 },
    }).setDepth(10);
    this.banner = crispText(this, bcx, 150, "", {
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold",
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setDepth(20);
    this.info = crispText(this, 10, this.scale.height - 16, "", {
      fontSize: "12px",
      color: "#dbe6ee",
      wordWrap: { width: this.battleW - 20 },
    }).setDepth(10);
    this.hudLevelText = crispText(this, 36, 97, "", {
      fontSize: "11px",
      color: "#ffffff",
      align: "center",
    })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.hudSkillText = crispText(this, 58, 117, "", {
      fontSize: "10px",
      color: "#ddaaff",
      align: "center",
    })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.gameSpeed = 1;
    // Speed / mute float above the panel (depth 50) at the top-right.
    this.speedBtn = crispText(this, this.scale.width - 12, 8, "", {
      fontSize: "13px",
      color: "#fff",
      backgroundColor: "#243a5a",
    })
      .setOrigin(1, 0)
      .setPadding(8, 4, 8, 4)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    this.speedBtn.on("pointerdown", () => {
      this.gameSpeed = this.gameSpeed === 0 ? 1 : this.gameSpeed >= 3 ? 0 : this.gameSpeed + 1;
      this.updateSpeedBtn();
    });
    this.updateSpeedBtn();
    const muteBtn = crispText(this, this.scale.width - 64, 8, "🔊", {
      fontSize: "13px",
      backgroundColor: "#243a5a",
    })
      .setOrigin(1, 0)
      .setPadding(6, 4, 6, 4)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    muteBtn.on("pointerdown", () => muteBtn.setText(this.sfx.toggleMute() ? "🔇" : "🔊"));
    // Call-wave-early skip: spawn the next wave now for bonus gold (campaign only).
    this.callWaveBtn = crispText(this, this.scale.width - 12, 34, "", {
      fontSize: "13px",
      color: "#fff5cc",
      backgroundColor: "#5a4a18",
      fontStyle: "bold",
    })
      .setOrigin(1, 0)
      .setPadding(8, 4, 8, 4)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.callWaveBtn.on("pointerdown", () => this.onCallWave());
    // Early-clear auto-skip: a centered "Next wave in N…" countdown shown after the
    // field is wiped out before its cadence elapses (driven by refreshCallWaveBtn).
    this.autoSkipText = crispText(this, this.scale.width / 2, 92, "", {
      fontSize: "20px",
      color: "#ffe27a",
      fontStyle: "bold",
      stroke: "#1a1206",
      strokeThickness: 5,
    })
      .setOrigin(0.5, 0)
      .setDepth(55)
      .setVisible(false);
    this.ui.add([
      this.uiGfx,
      this.hud,
      this.banner,
      this.info,
      this.hudLevelText,
      this.hudSkillText,
      this.speedBtn,
      muteBtn,
      this.callWaveBtn,
      this.autoSkipText,
    ]);

    this.panel = new BattleInfoPanel(this, this.ui, this.scale.width, this.scale.height, () =>
      this.togglePanel(),
    );

    this.buildBuildBar();
    this.setupPlacementDrag(); // register drag handlers once (tiles rebuild without re-registering)
    this.bindInput();

    // Camera: world zoom-to-fit the FULL screen (panel overlays it); uiCam 1:1.
    const zoom = Math.min(this.scale.width / WORLD_WIDTH, this.scale.height / WORLD_HEIGHT);
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
    this.cameras.main
      .setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      .setZoom(zoom)
      .centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.cameras.main.ignore(this.ui);
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCam.ignore(this.world);

    // Pinch / wheel / drag-to-pan camera — zoom in to see sprites & combat VFX
    // at full resolution; drag the field to move the window once zoomed.
    this.camCtl = new BattleCameraController(this, this.cameras.main, {
      worldW: WORLD_WIDTH,
      worldH: WORLD_HEIGHT,
      minZoom: zoom,
      maxZoom: zoom * 2.4,
      blockAt: (p) => this.panel.hitsPanel(p.x) || this.panel.hitsTab(p.x, p.y) || p.y >= 500,
      isBusy: () => this.placeGhost != null,
    });
    this.addZoomButtons();

    this.panel.showHero(this.heroVM()); // build hero content (panel starts collapsed)

    // Crossfade the whole screen in on entry — both the world camera and the
    // separate 1:1 HUD camera, so battle entry matches the menu transitions.
    fadeIn(this);
    uiCam.fadeIn(DUR.fade, 6, 9, 15);

    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard?.addKeys({
      up: KC.UP,
      down: KC.DOWN,
      left: KC.LEFT,
      right: KC.RIGHT,
      w: KC.W,
      a: KC.A,
      s: KC.S,
      d: KC.D,
    }) as typeof this.keys;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.killSaveDirty) {
        this.saveManager.flush();
        this.killSaveDirty = false;
      }
      this.deselectTower();
      this.clearGhost();
      this.camCtl?.destroy();
      this.camCtl = undefined;
      this.terrainSprites.forEach((s) => s.destroy());
      this.terrainSprites = [];
    });
  }

  /** Persist mid-battle kill rewards at most ~once/sec to avoid storage thrash. */
  maybeFlushKillRewards(): void {
    if (!this.killSaveDirty) return;
    const now = this.time.now;
    if (now - this.lastKillFlush < 1000) return;
    this.lastKillFlush = now;
    this.killSaveDirty = false;
    this.saveManager.flush();
  }

  /** Build the bottom bar of draggable character avatars (T12). */
  buildBuildBar(): void {
    const TW = 74;
    // Per-rarity glow: base alpha + an optional breathing pulse (stronger/faster up
    // the chain) so a card's rarity reads at a glance during battle. Common is plain.
    const RGLOW: Record<string, { glow: number; pulse: number }> = {
      Common: { glow: 0, pulse: 0 },
      Magic: { glow: 0.16, pulse: 0 },
      Rare: { glow: 0.24, pulse: 900 },
      Legendary: { glow: 0.32, pulse: 720 },
      Unique: { glow: 0.42, pulse: 560 },
    };
    this.buildOrder.forEach((def, i) => {
      const x = 14 + i * TW,
        y = 504;
      const c = this.add
        .container(x + TW / 2, y + 16)
        .setSize(TW - 8, 44)
        .setDepth(12);
      const w = TW - 8,
        hw = w / 2;
      const rarityCol = RARITY_INT[def.rarity] ?? 0x3a4a64;
      const rg = RGLOW[def.rarity] ?? RGLOW.Common;
      // Rarity glow sits behind the card body — a soft rarity-colored halo.
      if (rg.glow > 0) {
        const glow = this.add.graphics();
        glow.fillStyle(rarityCol, 1).fillRoundedRect(-hw - 4, -20, w + 8, 52, 9);
        glow.setAlpha(rg.glow);
        c.add(glow);
        if (rg.pulse > 0) {
          this.avatarPulses.push(
            this.tweens.add({
              targets: glow,
              alpha: rg.glow * 0.4,
              duration: rg.pulse,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            }),
          );
        }
      }
      const bg = this.add.graphics();
      bg.fillStyle(0x1a2230, 1).fillRoundedRect(-hw, -16, w, 44, 6);
      bg.lineStyle(1.5, rarityCol, 1).strokeRoundedRect(-hw, -16, w, 44, 6);
      c.add(bg);
      const key = towerTex(def.id);
      if (this.textures.exists(key)) {
        const img = this.add.image(0, -2, key, 0).setOrigin(0.5);
        img.setScale(34 / img.height);
        c.add(img);
      }
      c.add(
        crispText(this, 0, 14, `${def.cost}g`, { fontSize: "10px", color: "#ffd86a" }).setOrigin(
          0.5,
        ),
      );
      const badge = this.add.graphics();
      this.drawTypeBadge(badge, (TW - 8) / 2 - 9, -8, def); // melee/ranged + role (T5)
      c.add(badge);
      c.setData("towerId", def.id);
      c.setInteractive({ useHandCursor: true, draggable: true });
      // Tap (not drag) a card to ARM it for tap-to-place; drag still works.
      c.on("pointerdown", (p: Phaser.Input.Pointer) => {
        c.setData("tapDownX", p.x);
        c.setData("tapDownY", p.y);
      });
      c.on("pointerup", (p: Phaser.Input.Pointer) => {
        const dx = p.x - ((c.getData("tapDownX") as number) ?? p.x);
        const dy = p.y - ((c.getData("tapDownY") as number) ?? p.y);
        if (Math.hypot(dx, dy) > TAP_SLOP_PX) return; // that was a drag-place, not a tap
        this.toggleArm(def.id);
      });
      this.ui.add(c);
      this.avatarTiles.push(c);
    });
  }

  /** Recreate the avatar tiles (e.g. to snap a dragged tile home). */
  rebuildAvatarTiles(): void {
    this.avatarPulses.forEach((t) => t.stop()); // drop tweens before their glow graphics die
    this.avatarPulses = [];
    this.avatarTiles.forEach((t) => t.destroy());
    this.avatarTiles = [];
    this.buildBuildBar();
  }

  refreshBuildBar(): void {
    for (const c of this.avatarTiles) {
      const id = c.getData("towerId") as string;
      const def = this.buildOrder.find((d) => d.id === id);
      c.setAlpha(def && this.battle.gold >= def.cost ? 1 : 0.45);
    }
  }

  update(time: number, deltaMs: number): void {
    this.handleKeyboardHero();
    // Fixed timestep: accumulate (speed-scaled, frame-clamped) wall time and run
    // the sim in whole SIM_STEP ticks — the exact discretization the tests use.
    // gameSpeed: 0 = paused, 2/3 = fast-forward (more steps, never a bigger dt).
    const frame = Math.min(deltaMs / 1000, 0.25) * this.gameSpeed;
    const steps = this.stepper.advance(frame);
    this.pendingFx.length = 0;
    for (let i = 0; i < steps; i++) {
      if (this.battle.outcome !== "ongoing") break; // finished — don't replay stale fx
      snapshotPositions(this.battle.enemies, this.prevEnemyPos);
      const h = this.battle.hero;
      this.prevHeroPos = { x: h.pos.x, y: h.pos.y };
      this.battle.tick(SIM_STEP);
      this.pendingFx.push(...this.battle.fx);
    }
    this.renderAlpha = this.stepper.alpha;
    this.syncCastleArt();
    this.draw();
    this.endlessBackdropFx?.update(time);
  }
}

// Merge the per-concern scene methods onto the prototype. Their `this` is typed
// as BattleScene (see each module); the interface declaration above makes them
// visible to TypeScript on the class.
Object.assign(BattleScene.prototype, renderMethods, spritesMethods, inputMethods, placementMethods);
