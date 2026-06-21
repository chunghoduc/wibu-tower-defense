/**
 * BattleScene rendering — the per-frame `draw()` orchestrator plus all the
 * vector-shape drawing helpers (towers, enemies, hero, HUD glyphs). Methods are
 * merged onto the BattleScene prototype in `BattleScene.ts`; `this` is the scene.
 */
import Phaser from "phaser";
import { type EnemyRuntime, type TowerRuntime, MANA_MAX } from "../core/battle.ts";
import type { CharacterDef, ItemSlot } from "../data/schema.ts";
import { ELITE_SIZE_MULT } from "../core/elite.ts";
import { totalXpForLevel } from "../core/hero.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { WORLD_WIDTH, WORLD_HEIGHT, stageNumber } from "../data/stage.ts";
import { buildEndlessBackdrop } from "../core/endlessBackdrop.ts";
import { waveCounterLabel } from "../core/waveCounter.ts";
import { EndlessBackdropFx } from "./endlessBackdropFx.ts";
import { BattleTilemap } from "./battleTilemap.ts";
import { DEPTH } from "./battleDepths.ts";
import { terrainKeyFor } from "../data/terrainManifest.ts";
import { stageThemeForStage } from "../data/chapters.ts";
import { crispText } from "./ui.ts";
import { fadeToScene } from "./uiKit.ts";
import {
  ROLE_COLOR,
  KIND_COLOR,
  TERRAIN_COLOR,
  towerKind,
  starPoints,
  towerStatRows,
} from "./battleSceneHelpers.ts";
import { auraRadiusOf, auraPulse, AURA_RING_COLOR } from "../core/auraIndicator.ts";
import { groundLanes } from "../core/path.ts";
import { roleBadgeTex } from "./roleBadge.ts";
import { CASTLE_TEX } from "../data/assetKeys.ts";
import { castleArtState, castleTexForState } from "./castleArt.ts";
import type { BattleScene } from "./BattleScene.ts";

/** In-world width the castle sprite renders at — reads as a fortress, not a tile. */
const CASTLE_TARGET_W = 110;

export const renderMethods = {
  draw(this: BattleScene): void {
    const g = this.dynGfx;
    g.clear();
    this.uiGfx.clear();

    // Keep the tower panel live: close it if its tower is gone, else refresh
    // affordability/stats against current gold.
    if (this.selectedTowerUid >= 0) {
      const t = this.battle.towers.find((x) => x.uid === this.selectedTowerUid && x.alive);
      if (!t) this.deselectTower();
      else
        this.panel.tick({
          hp: t.hp,
          maxHp: t.stats.maxHp,
          mana: t.mana,
          maxMana: t.def.role !== "support" ? MANA_MAX : 0,
          gold: this.battle.gold,
          upgradeCost: this.battle.upgradeCost(t.uid),
          statRows: towerStatRows(
            t.stats as unknown as Record<string, number>,
            t.buffAtkPct,
            t.buffAsPct,
          ),
        });
    } else {
      const h = this.battle.hero;
      this.panel.tick({
        hp: h.hp,
        maxHp: h.stats.maxHp,
        mana: h.mana,
        maxMana: MANA_MAX,
        gold: this.battle.gold,
        upgradeCost: 0,
      });
    }

    this.manageSprites();
    // Batched in update(): replays nothing on 0-step frames, drops nothing on
    // multi-step frames (the old direct read did both under fast-forward).
    for (const ev of this.pendingFx) this.playFx(ev);
    this.maybeFlushKillRewards();
    for (const t of this.battle.towers) this.drawAuraRing(g, t);
    for (const t of this.battle.towers) this.drawTower(g, t);
    for (const e of this.battle.enemies) this.drawEnemy(g, e);
    this.drawHero(g);

    this.refreshBuildBar();
    const b = this.battle;
    const endless = this.battleMode.kind === "endless";
    const best = endless ? this.saveManager.bestEndlessWave(this.stage.id) : 0;
    this.hud.setText(
      `${this.stage.name} [${b.difficulty}]   Gold ${b.gold}   ` +
        `Castle ${Math.max(0, Math.ceil(b.castleHp))}   ` +
        `Hero ${Math.max(0, Math.ceil(b.hero.hp))}/${b.hero.stats.maxHp}   ` +
        waveCounterLabel({
          endless,
          current: Math.max(0, b.waveIndex + 1),
          total: this.stage.waves.length,
          best,
        }),
    );
    this.refreshCallWaveBtn();

    this.drawHeroSaveHUD(this.uiGfx);

    this.info.setText(
      "Drag a character onto the field to deploy (avoid obstacles).  ·  WASD / arrows or tap to move your hero.  ·  Tap a tower to upgrade/sell.",
    );

    if (b.outcome === "won") {
      // The loot panel renders the VICTORY title itself; the transient banner stays clear.
      if (!this._victoryProcessed) this.sfx.win();
      this.showBattleRewards("won");
    } else if (b.outcome === "lost") {
      if (!this._defeatPlayed) {
        this._defeatPlayed = true;
        this.sfx.lose();
      }
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
      this._menuBtn.on("pointerdown", () => fadeToScene(this, "MainMenuScene"));
    }
  },

  drawTower(this: BattleScene, g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
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
    if (t.def.role !== "support") {
      g.fillStyle(0x42a5f5, 0.9);
      g.fillRect(t.pos.x - 14, t.pos.y + 16, 28 * (t.mana / MANA_MAX), 3);
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
    // Star pips — in-battle stars (★1 when placed, up to ★3 maxed).
    this.drawStarPips(g, t.pos.x, t.pos.y - 30, t.battleLevel + 1);
    // Type badge — melee vs ranged + role colour, upper-right of the avatar (T5).
    this.drawTypeBadge(g, t.pos.x + 13, t.pos.y - 16, t.def);
  },

  // Aura range indicator — a softly pulsing aquamarine ring + fill at the TRUE
  // tower-buff aura radius (behavior.buffAura.radius, already upgrade-scaled), drawn
  // under the tower bodies. Dimmed while the tower is disabled (its aura is inactive).
  drawAuraRing(this: BattleScene, g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
    if (!t.alive) return;
    const radius = auraRadiusOf(t);
    if (radius == null) return;
    const disabled = t.disabledTimer > 0;
    const pulse = auraPulse(this.time.now, t.uid);
    const fillA = (disabled ? 0.015 : 0.04) + pulse * (disabled ? 0.01 : 0.03);
    const ringA = (disabled ? 0.1 : 0.28) + pulse * (disabled ? 0.05 : 0.2);
    g.fillStyle(AURA_RING_COLOR, fillA).fillCircle(t.pos.x, t.pos.y, radius);
    g.lineStyle(1.5, AURA_RING_COLOR, ringA).strokeCircle(t.pos.x, t.pos.y, radius);
    g.lineStyle(1, AURA_RING_COLOR, ringA * 0.5).strokeCircle(t.pos.x, t.pos.y, radius - 4);
  },

  /** A row of small gold stars marking a tower's in-battle upgrade level. */
  drawStarPips(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    count: number,
  ): void {
    const gap = 8;
    const startX = cx - ((count - 1) * gap) / 2;
    for (let i = 0; i < count; i++) {
      const x = startX + i * gap;
      g.fillStyle(0x000000, 0.4).fillPoints(starPoints(x, cy + 0.6, 4.4, 1.9), true);
      g.fillStyle(0xffd34d, 1).fillPoints(starPoints(x, cy, 3.8, 1.6), true);
    }
  },

  /** Small badge showing tower type (melee/ranged) tinted by role, upper-right. */
  drawTypeBadge(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    def: CharacterDef,
  ): void {
    const kind = towerKind(def);
    g.fillStyle(0x10141c, 0.9).fillCircle(x, y, 7.5);
    g.lineStyle(1.5, KIND_COLOR[kind], 1).strokeCircle(x, y, 7.5);
    g.fillStyle(ROLE_COLOR[def.role] ?? 0xffffff, 0.5).fillCircle(x, y, 6);
    // The SDXL role emblem (a managed Image in manageSprites) rides on top when
    // present and shows the role. Only when its texture is absent do we fall back
    // to the legacy melee/ranged glyph, so the badge is never empty.
    if (this.textures.exists(roleBadgeTex(def.role))) return;
    g.lineStyle(1.6, 0xffffff, 0.95);
    if (kind === "melee") {
      // a little sword: blade + crossguard
      g.beginPath();
      g.moveTo(x, y - 4);
      g.lineTo(x, y + 3.2);
      g.strokePath();
      g.beginPath();
      g.moveTo(x - 2.4, y + 1.4);
      g.lineTo(x + 2.4, y + 1.4);
      g.strokePath();
    } else {
      // a little arrow pointing right
      g.beginPath();
      g.moveTo(x - 3.4, y);
      g.lineTo(x + 3, y);
      g.strokePath();
      g.beginPath();
      g.moveTo(x + 0.6, y - 2.4);
      g.lineTo(x + 3.4, y);
      g.lineTo(x + 0.6, y + 2.4);
      g.strokePath();
    }
  },

  /** A dashed circle (stealth "hidden" marker). */
  drawDashedRing(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    g.lineStyle(2, color, alpha);
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const a0 = (Math.PI * 2 * i) / segs;
      g.beginPath();
      g.arc(cx, cy, radius, a0, a0 + ((Math.PI * 2) / segs) * 0.55, false);
      g.strokePath();
    }
  },

  /** A small eye glyph (stealth "spotted" marker). */
  drawEye(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
  ): void {
    g.fillStyle(color, 0.95).fillEllipse(x, y, 11, 6);
    g.fillStyle(0x10131c, 1).fillCircle(x, y, 2);
  },

  drawEnemy(this: BattleScene, g: Phaser.GameObjects.Graphics, e: EnemyRuntime): void {
    const p = this.enemyRenderPos(e); // interpolated draw position (fixed-step sim)
    const boss = e.def.archetype === "Boss";
    const r = (boss ? 16 : e.flying ? 8 : 10) * (e.elite ? ELITE_SIZE_MULT : 1);
    const alpha = e.stealth ? 0.4 : 1;
    const base = e.enraged ? 0xff5252 : e.flying ? 0xce93d8 : boss ? 0xb71c1c : 0xe57373;
    // Elite aura (T17): a pulsing gold double-ring so elites read instantly.
    if (e.elite) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.006 + e.uid);
      const ar = r + 6 + pulse * 4;
      g.fillStyle(0xffd34d, 0.12 + pulse * 0.08).fillCircle(p.x, p.y, ar);
      g.lineStyle(2, 0xffe082, 0.85).strokeCircle(p.x, p.y, ar);
      g.lineStyle(1, 0xfff3c4, 0.5).strokeCircle(p.x, p.y, r + 3);
    }
    if (!this.enemySprites.has(e.uid)) g.fillStyle(base, alpha).fillCircle(p.x, p.y, r);
    else if (e.enraged) g.lineStyle(2, 0xff5252, 0.8).strokeCircle(p.x, p.y, r + 4);
    if (e.stunTimer > 0) g.lineStyle(2, 0xfff176, 0.9).strokeCircle(p.x, p.y, r + 3);
    else if (e.slowPct > 0) g.lineStyle(2, 0x4fc3f7, 0.9).strokeCircle(p.x, p.y, r + 3);
    // Stealth (T9): a ghostly cyan dashed ring while hidden; an orange "spotted"
    // ring + eye when revealed by the hero (towers can then hit it).
    if (e.stealth) {
      if (e.revealed) {
        g.lineStyle(2, 0xffa726, 0.95).strokeCircle(p.x, p.y, r + 6);
        this.drawEye(g, p.x, p.y - r - 11, 0xffd27a);
      } else {
        this.drawDashedRing(g, p.x, p.y, r + 5, 0x80deea, 0.8);
      }
    }
    const w = boss ? 40 : e.elite ? 30 : 20;
    const top = p.y - r - 7;
    g.fillStyle(0x000000, 0.6).fillRect(p.x - w / 2, top, w, 4);
    g.fillStyle(0x66bb6a, 1).fillRect(
      p.x - w / 2,
      top,
      w * Phaser.Math.Clamp(e.hp / e.stats.maxHp, 0, 1),
      4,
    );
    if (e.shield > 0) {
      g.fillStyle(0x80d8ff, 1).fillRect(
        p.x - w / 2,
        top - 4,
        w * Phaser.Math.Clamp(e.shield / e.stats.maxHp, 0, 1),
        3,
      );
    }
    // Boss skill mana bar (T16).
    const bskill = e.def.boss?.skill;
    if (bskill) {
      const mf = Phaser.Math.Clamp(e.mana / bskill.manaCost, 0, 1);
      g.fillStyle(0x000000, 0.6).fillRect(p.x - w / 2, top + 5, w, 3);
      g.fillStyle(0xb085f5, 1).fillRect(p.x - w / 2, top + 5, w * mf, 3);
    }
    // Status glyphs (T8): burning / poison / freeze above the bar.
    this.drawStatusGlyphs(g, e, p.x, top - (e.shield > 0 ? 12 : 8));
  },

  /** Burning / poison / freeze status glyphs over an enemy (T8). */
  drawStatusGlyphs(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    e: EnemyRuntime,
    px: number, // interpolated render X (matches the body, not the raw sim pos)
    gy: number,
  ): void {
    const kinds: ("burn" | "poison" | "freeze")[] = [];
    if (e.dots.length > 0) kinds.push(e.dots[0].type === "Magic" ? "poison" : "burn");
    if (e.slowPct >= 0.6) kinds.push("freeze");
    if (kinds.length === 0) return;
    const gap = 11;
    const startX = px - ((kinds.length - 1) * gap) / 2;
    kinds.forEach((k, i) => this.drawStatusGlyph(g, k, startX + i * gap, gy));
  },

  drawStatusGlyph(
    this: BattleScene,
    g: Phaser.GameObjects.Graphics,
    kind: "burn" | "poison" | "freeze",
    x: number,
    y: number,
  ): void {
    g.fillStyle(0x10131c, 0.55).fillCircle(x, y, 5.5); // dark backing for contrast
    if (kind === "burn") {
      g.fillStyle(0xff6a2a, 1).fillTriangle(x - 3.2, y + 3, x, y - 5, x + 3.2, y + 3);
      g.fillStyle(0xffd24d, 1).fillTriangle(x - 1.5, y + 3, x, y - 1, x + 1.5, y + 3);
    } else if (kind === "poison") {
      g.fillStyle(0x8bc34a, 1);
      g.fillCircle(x - 2, y + 1.5, 2.1);
      g.fillCircle(x + 1.8, y - 1, 1.7);
      g.fillCircle(x + 1.6, y + 2.2, 1.3);
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
  },

  drawHero(this: BattleScene, g: Phaser.GameObjects.Graphics): void {
    const h = this.battle.hero;
    if (!h.alive) return;
    const p = this.heroRenderPos(); // interpolated draw position (fixed-step sim)
    if (!this.heroSprite) g.fillStyle(0xffd700, 1).fillCircle(p.x, p.y, 13);
    g.lineStyle(1, 0xffd700, 0.25).strokeCircle(p.x, p.y, h.stats.range);
    g.fillStyle(0x000000, 0.6).fillRect(p.x - 16, p.y - 24, 32, 5);
    g.fillStyle(0x66bb6a, 1).fillRect(
      p.x - 16,
      p.y - 24,
      32 * Phaser.Math.Clamp(h.hp / h.stats.maxHp, 0, 1),
      5,
    );
    g.fillStyle(0x42a5f5, 1).fillRect(
      p.x - 16,
      p.y - 18,
      32 * Phaser.Math.Clamp(h.mana / MANA_MAX, 0, 1),
      3,
    );
  },

  drawHeroSaveHUD(this: BattleScene, g: Phaser.GameObjects.Graphics): void {
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
      "Weapon",
      "Helmet",
      "BodyArmor",
      "Gloves",
      "Pants",
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
  },

  drawStatic(this: BattleScene): void {
    const g = this.staticGfx;
    g.clear();
    this.terrainSprites.forEach((s) => s.destroy());
    this.terrainSprites = [];
    // Chapter backdrop (T2): a painted battlefield background per chapter theme,
    // with a subtle dark veil over it for unit contrast. Falls back to a flat
    // ground tint if the image failed to load.
    const theme = stageThemeForStage(this.stage.id);
    // Top-down tiled map (replaces the painted backdrop): a ground terrain layer
    // plus an auto-tiled dirt road following the enemy lanes. Rebuilt each
    // drawStatic; the prior one is torn down first (re-entry safe).
    this.battleTilemap?.destroy();
    this.battleTilemap = new BattleTilemap(
      this,
      this.world,
      theme.tiles,
      groundLanes(this.stage),
      stageNumber(this.stage.id) || 1,
    );
    // A very light veil over the tiles for unit contrast (tiles are already muted).
    g.fillStyle(theme.groundOverlay, 0.1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Endless: build the animated siege-atmosphere layer over the base, centered on
    // the arena castle (same stage-number seed as the maze). Rebuilt each drawStatic.
    this.endlessBackdropFx?.destroy();
    this.endlessBackdropFx = null;
    if (this.stage.arena) {
      const seed = stageNumber(this.stage.id) || 1;
      const spec = buildEndlessBackdrop(
        this.stage.arena,
        { width: WORLD_WIDTH, height: WORLD_HEIGHT },
        seed,
      );
      this.endlessBackdropFx = new EndlessBackdropFx(this, spec, this.world);
    }
    // terrain features (T13): SVG art authored by the svg-asset-gen skill, drawn
    // as images above the ground but below units (depth 1). Falls back to a
    // tinted blob if a texture failed to load so the map is never blank.
    for (const f of this.stage.terrain ?? []) {
      const key = terrainKeyFor(f.type, f.x, f.y);
      if (this.textures.exists(key)) {
        // The art's silhouette fills ~0.45 of the 128px box; scale so the blob's
        // radius ≈ the feature radius (a touch of overhang reads as organic).
        const img = this.add
          .image(f.x, f.y, key)
          .setDisplaySize(f.r * 2.6, f.r * 2.6)
          .setDepth(DEPTH.TERRAIN);
        if (theme.terrainTint !== 0xffffff) img.setTint(theme.terrainTint); // match the biome
        if (!f.blocks) img.setAlpha(0.92); // decor sits a hair lighter than obstacles
        this.world.add(img);
        this.terrainSprites.push(img);
        continue;
      }
      const col = TERRAIN_COLOR[f.type];
      g.fillStyle(col, f.blocks ? 0.95 : 0.5).fillCircle(f.x, f.y, f.r);
      g.lineStyle(
        2,
        Phaser.Display.Color.IntegerToColor(col).darken(30).color,
        f.blocks ? 0.9 : 0.4,
      ).strokeCircle(f.x, f.y, f.r);
      if (f.type === "mountain") {
        g.fillStyle(0xe8eef4, 0.5).fillTriangle(
          f.x - f.r * 0.4,
          f.y + f.r * 0.2,
          f.x,
          f.y - f.r * 0.5,
          f.x + f.r * 0.4,
          f.y + f.r * 0.2,
        );
      }
    }
    // arena gates: red mouths where each siege column enters the map.
    if (this.stage.arena) {
      g.fillStyle(0x7a2a2a, 1);
      g.lineStyle(2, 0xd06060, 1);
      for (const gp of this.stage.arena.gates) {
        const x = Math.max(10, Math.min(WORLD_WIDTH - 10, gp.x));
        const y = Math.max(10, Math.min(WORLD_HEIGHT - 10, gp.y));
        g.fillCircle(x, y, 13);
        g.strokeCircle(x, y, 13);
      }
    }
    // castle — an SDXL fortress sprite that swaps to battle-damaged art at low
    // HP; the legacy rectangle is the fallback when the texture is missing
    // (pre-generation / GPU-less env).
    const c = this.battle.castlePos;
    this.castleSprite?.destroy();
    this.castleSprite = undefined;
    if (this.textures.exists(CASTLE_TEX)) {
      this.castleArtStateNow = castleArtState(this.battle.castleHp, this.battle.castleMax);
      const img = this.add
        .image(c.x, c.y, castleTexForState(this.castleArtStateNow))
        .setDepth(DEPTH.CASTLE);
      img.setScale(CASTLE_TARGET_W / img.width);
      this.world.add(img);
      this.castleSprite = img;
    } else {
      g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 24, c.y - 24, 48, 48);
      g.lineStyle(3, 0x9ab0e0, 1).strokeRect(c.x - 24, c.y - 24, 48, 48);
    }
  },

  /** Keep the castle art in sync with its HP (intact ↔ damaged). */
  syncCastleArt(this: BattleScene): void {
    const img = this.castleSprite;
    if (!img) return;
    const state = castleArtState(this.battle.castleHp, this.battle.castleMax);
    if (state === this.castleArtStateNow) return;
    this.castleArtStateNow = state;
    img.setTexture(castleTexForState(state));
    img.setScale(CASTLE_TARGET_W / img.width);
  },
};

export type RenderMethods = typeof renderMethods;
