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

  private _victoryProcessed = false;
  private _menuBtn: Phaser.GameObjects.Text | null = null;

  // Pixel-art sprite pools (keyed by entity uid); fall back to shapes if missing.
  private towerSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private heroSprite: Phaser.GameObjects.Sprite | null = null;
  private fx!: FxLayer;

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

    // Stage and difficulty come from StageSelectScene via registry; fall back to stage 1 / Normal
    this.stage = (this.registry.get("selectedStage") as StageDef | undefined) ?? STAGE_1;
    this.difficulty = (this.registry.get("selectedDifficulty") as Difficulty | undefined) ?? "Normal";

    this.catalog = loadCatalog();
    this.buildOrder = buildSquad(save, this.catalog);
    this.selectedTowerId = this.buildOrder[0]?.id ?? null;

    this.battle = new BattleState(this.stage, this.catalog, {
      seed: 12345,
      difficulty: this.difficulty,
      hero: {
        stats: defaultHeroStats(),
        startPos: { x: 480, y: 270 },
        damageType: "Physical",
      },
      heroSave: save,
    });

    this.staticGfx = this.add.graphics();
    this.dynGfx = this.add.graphics().setDepth(5); // bars/rings render above sprites (depth 2)
    this.fx = new FxLayer(this, 6);
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
    const p = this.stage.path;
    g.beginPath();
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
    g.strokePath();
    const c = this.battle.castlePos;
    g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 22, c.y - 22, 44, 44);
    g.lineStyle(2, 0x55617a, 1);
    for (const s of this.stage.towerSlots) g.strokeCircle(s.x, s.y, SLOT_RADIUS);
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
    for (let i = 0; i < this.stage.towerSlots.length; i++) {
      if (dist(world, this.stage.towerSlots[i]) <= SLOT_RADIUS) {
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

      this.add
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

  /** Render one sim FX event, and trigger sprite animations (attack swing, hit flash). */
  private playFx(ev: FxEvent): void {
    this.fx.play(ev);
    if (ev.type === "attack") {
      const s = ev.source === "hero" ? this.heroSprite : this.spriteNear(this.towerSprites, ev.from);
      this.playAttack(s);
    } else if (ev.type === "hit") {
      const e = this.spriteNear(this.enemySprites, ev.at);
      if (e) this.flash(e);
    }
  }

  /** Nearest pooled sprite to a world position (towers static, enemies move). */
  private spriteNear(map: Map<number, Phaser.GameObjects.Sprite>, at: { x: number; y: number }): Phaser.GameObjects.Sprite | null {
    let best: Phaser.GameObjects.Sprite | null = null, bd = 18 * 18;
    for (const s of map.values()) {
      const dx = s.x - at.x, dy = s.y - at.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Play a sprite's attack animation once, then return to idle. */
  private playAttack(s: Phaser.GameObjects.Sprite | null): void {
    if (!s) return;
    const key = s.texture.key;
    const atk = `${key}_attack`;
    if (!this.anims.exists(atk)) return;
    const cur = s.anims.currentAnim?.key;
    if (cur === atk && s.anims.isPlaying) return; // already swinging
    s.play(atk);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
  }

  /** White hit-flash on an enemy sprite. */
  private flash(s: Phaser.GameObjects.Sprite): void {
    s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => s.clearTint());
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
      const s = this.ensureSprite(this.enemySprites, e.uid, key, e.pos.x, e.pos.y, boss ? 48 : 30);
      if (s) { seenE.add(e.uid); s.setAlpha(e.stealth ? 0.45 : 1); }
    }
    for (const [uid, s] of this.enemySprites) if (!seenE.has(uid)) { s.destroy(); this.enemySprites.delete(uid); }

    const h = this.battle.hero;
    if (h.alive && hasSprite(this, "hero__hero")) {
      if (!this.heroSprite) {
        this.heroSprite = this.add.sprite(h.pos.x, h.pos.y, "hero__hero").setOrigin(0.5, 0.78).setDepth(3);
        this.heroSprite.setScale(54 / this.heroSprite.height);
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
