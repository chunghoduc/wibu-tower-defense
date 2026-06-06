/**
 * BattleScene — the thin Phaser rendering/input layer over the headless
 * BattleState simulation. It draws placeholder shapes (Phase 1 has no art) and
 * translates player input into simulation commands:
 *   - Tap a tower button (or press 1-4) to select a tower to build.
 *   - Tap an empty slot to place the selected tower (costs gold).
 *   - Tap anywhere else to walk the hero there.
 */
import Phaser from "phaser";
import { BattleState, type EnemyRuntime, type TowerRuntime } from "../core/battle.ts";
import { loadCatalog, type Catalog } from "../data/catalog.ts";
import { defaultHeroStats, STAGE_1 } from "../data/stage.ts";
import type { CharacterDef, Vec2 } from "../data/schema.ts";
import { dist } from "../core/path.ts";

/** The 7-character squad shown on the build bar (one per role + a marquee). */
const SQUAD_IDS = [
  "zoran-thricedraw", // damage
  "iron-bo-cannonarm", // splash
  "hyo-frost-arc", // chain
  "shion-venom-priestess", // dot
  "yuki-frostward-maiden", // debuff
  "aldric-banner-bearer", // support
  "karu-sunfist", // damage (Unique marquee)
];

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

export class BattleScene extends Phaser.Scene {
  private catalog!: Catalog;
  private battle!: BattleState;
  private buildOrder: CharacterDef[] = [];
  private selectedTowerId: string | null = null;

  private staticGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private buildButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.catalog = loadCatalog();
    this.buildOrder = SQUAD_IDS.map((id) => this.catalog.characters.get(id)).filter(
      (c): c is CharacterDef => Boolean(c),
    );
    this.selectedTowerId = this.buildOrder[0]?.id ?? null;

    this.battle = new BattleState(STAGE_1, this.catalog, {
      seed: 12345,
      hero: { stats: defaultHeroStats(), startPos: { x: 480, y: 270 }, damageType: "Physical" },
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

    this.buildBuildBar();
    this.bindInput();
  }

  private drawStatic(): void {
    const g = this.staticGfx;
    g.clear();
    // Lane.
    g.lineStyle(36, 0x2c3446, 1);
    const p = STAGE_1.path;
    g.beginPath();
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
    g.strokePath();
    // Castle.
    const c = this.battle.castlePos;
    g.fillStyle(0x6d8ad0, 1).fillRect(c.x - 22, c.y - 22, 44, 44);
    // Tower slots.
    g.lineStyle(2, 0x55617a, 1);
    for (const s of STAGE_1.towerSlots) g.strokeCircle(s.x, s.y, SLOT_RADIUS);
  }

  private buildBuildBar(): void {
    this.buildOrder.forEach((def, i) => {
      const btn = this.add
        .text(10 + i * 150, 510, "", { fontSize: "13px", color: "#fff", backgroundColor: "#333" })
        .setPadding(6, 4, 6, 4)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);
      btn.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        this.selectedTowerId = def.id;
        e.stopPropagation();
      });
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
      const selected = def.id === this.selectedTowerId;
      btn.setText(`${i + 1} ${def.name} (${def.cost}g)`);
      btn.setBackgroundColor(selected ? "#1565c0" : this.battle.gold >= def.cost ? "#333" : "#5a1f1f");
    });
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.battle.outcome !== "ongoing") return;
      // Ignore taps in the bottom UI strip (build bar) — those are button taps.
      if (pointer.worldY >= 500) return;
      const world: Vec2 = { x: pointer.worldX, y: pointer.worldY };

      // Placing a tower? Find the nearest empty slot under the tap.
      const slotIndex = this.slotAt(world);
      if (slotIndex >= 0 && this.selectedTowerId) {
        if (this.battle.placeTower(this.selectedTowerId, slotIndex)) return;
      }
      // Otherwise, move the hero.
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
    // Clamp dt so tab-out/lag spikes don't teleport enemies through defenses.
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

    const sel = this.buildOrder.find((d) => d.id === this.selectedTowerId);
    if (sel) {
      this.info.setText(
        `${sel.name} — ${sel.rarity} ${sel.role} (${sel.damageType}/${sel.target})  ·  ${sel.description}`,
      );
    }

    if (b.outcome === "won") this.banner.setText("VICTORY").setColor("#a5d6a7");
    else if (b.outcome === "lost") this.banner.setText("DEFEAT").setColor("#ef9a9a");
  }

  private drawTower(g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
    const disabled = t.disabledTimer > 0;
    const color = disabled ? 0x555555 : ROLE_COLOR[t.def.role] ?? 0xffffff;
    g.fillStyle(color, 1).fillRect(t.pos.x - 14, t.pos.y - 14, 28, 28);
    // Range ring + mana fill.
    g.lineStyle(1, color, 0.25).strokeCircle(t.pos.x, t.pos.y, t.stats.range);
    if (t.stats.maxMana > 0) {
      g.fillStyle(0x42a5f5, 0.9);
      g.fillRect(t.pos.x - 14, t.pos.y + 16, 28 * (t.mana / t.stats.maxMana), 3);
    }
    // Tower HP (only when damaged).
    if (t.hp < t.stats.maxHp) {
      g.fillStyle(0x000000, 0.6).fillRect(t.pos.x - 14, t.pos.y - 20, 28, 3);
      g.fillStyle(0xef5350, 1).fillRect(t.pos.x - 14, t.pos.y - 20, 28 * Phaser.Math.Clamp(t.hp / t.stats.maxHp, 0, 1), 3);
    }
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyRuntime): void {
    const boss = e.def.archetype === "Boss";
    const r = boss ? 16 : e.flying ? 8 : 10;
    const alpha = e.stealth ? 0.4 : 1;
    const base = e.enraged ? 0xff5252 : e.flying ? 0xce93d8 : boss ? 0xb71c1c : 0xe57373;
    g.fillStyle(base, alpha).fillCircle(e.pos.x, e.pos.y, r);
    // Slow/stun status ring.
    if (e.stunTimer > 0) g.lineStyle(2, 0xfff176, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    else if (e.slowPct > 0) g.lineStyle(2, 0x4fc3f7, 0.9).strokeCircle(e.pos.x, e.pos.y, r + 3);
    // HP (and shield) bar.
    const w = boss ? 40 : 20;
    const top = e.pos.y - r - 7;
    g.fillStyle(0x000000, 0.6).fillRect(e.pos.x - w / 2, top, w, 4);
    g.fillStyle(0x66bb6a, 1).fillRect(e.pos.x - w / 2, top, w * Phaser.Math.Clamp(e.hp / e.stats.maxHp, 0, 1), 4);
    if (e.shield > 0) {
      g.fillStyle(0x80d8ff, 1).fillRect(e.pos.x - w / 2, top - 4, w * Phaser.Math.Clamp(e.shield / e.stats.maxHp, 0, 1), 3);
    }
  }

  private drawHero(g: Phaser.GameObjects.Graphics): void {
    const h = this.battle.hero;
    if (!h.alive) return;
    g.fillStyle(0xffd700, 1).fillCircle(h.pos.x, h.pos.y, 13);
    g.lineStyle(1, 0xffd700, 0.25).strokeCircle(h.pos.x, h.pos.y, h.stats.range);
    // HP + mana bars.
    g.fillStyle(0x000000, 0.6).fillRect(h.pos.x - 16, h.pos.y - 24, 32, 5);
    g.fillStyle(0x66bb6a, 1).fillRect(h.pos.x - 16, h.pos.y - 24, 32 * Phaser.Math.Clamp(h.hp / h.stats.maxHp, 0, 1), 5);
    g.fillStyle(0x42a5f5, 1).fillRect(
      h.pos.x - 16,
      h.pos.y - 18,
      32 * Phaser.Math.Clamp(h.mana / Math.max(1, h.stats.maxMana), 0, 1),
      3,
    );
  }
}
