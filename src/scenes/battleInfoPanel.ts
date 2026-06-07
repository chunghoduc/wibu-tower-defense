/**
 * BattleInfoPanel — the persistent right-side info panel in the battle UI layer
 * (1:1 camera, so text is full-size and crisp). Purely presentational: the scene
 * builds a view model and passes it in; the panel never reads battle state.
 *
 * - showHero(vm)  → hero portrait, level, HP/mana, stats, equipped items, skill
 * - showTower(vm) → tower avatar, stars, HP/mana, stats, skills, Upgrade/Sell
 * - tick(live)    → cheap per-frame refresh of HP/mana bars + upgrade affordability
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";

export interface StatRow { label: string; value: string; }
export interface PanelItem { iconKey: string | null; name: string; plus: number; rarityColor: number; }
export interface SkillRow { label: string; desc: string; color: string; }

export interface HeroPanelVM {
  kind: "hero";
  name: string; level: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
  stats: StatRow[]; items: PanelItem[]; skill: { name: string; desc: string } | null;
}
export interface TowerPanelVM {
  kind: "tower"; uid: number;
  name: string; iconKey: string | null; stars: number;
  hp: number; maxHp: number; mana: number; maxMana: number;
  stats: StatRow[]; skills: SkillRow[];
  upgradeCost: number; sellValue: number; maxed: boolean;
}
export type PanelVM = HeroPanelVM | TowerPanelVM;
export interface TowerCallbacks { onUpgrade: () => void; onSell: () => void; }

export interface LiveVals { hp: number; maxHp: number; mana: number; maxMana: number; gold: number; upgradeCost: number; }

const PAD = 12;

export class BattleInfoPanel {
  private readonly content: Phaser.GameObjects.Container;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly innerW: number;

  // live refs (rebuilt on show)
  private hpText: Phaser.GameObjects.Text | null = null;
  private manaText: Phaser.GameObjects.Text | null = null;
  private upBtn: Phaser.GameObjects.Text | null = null;
  private barLayout: { hpY: number; manaY: number; hasMana: boolean } = { hpY: 0, manaY: 0, hasMana: false };
  private current: PanelVM | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly x: number,
    w: number,
    private readonly h: number,
  ) {
    this.innerW = w - PAD * 2;
    const bg = scene.add.graphics().setDepth(14);
    bg.fillStyle(0x0c1018, 0.98).fillRect(x, 0, w, h);
    bg.lineStyle(2, 0x2a3a56, 1).beginPath();
    bg.moveTo(x, 0); bg.lineTo(x, h); bg.strokePath();
    this.content = scene.add.container(x + PAD, 0).setDepth(15);
    this.barGfx = scene.add.graphics().setDepth(16);
    layer.add([bg, this.content, this.barGfx]);
  }

  // ── public API ────────────────────────────────────────────────────────────

  showHero(vm: HeroPanelVM): void {
    this.current = vm;
    this.rebuild();
    let y = 50;
    y = this.header(vm.name, `Level ${vm.level}`, "hero__hero", 0, y, 0xffd700);
    y = this.bars(vm.hp, vm.maxHp, vm.mana, vm.maxMana, y);
    y = this.statGrid(vm.stats, y);
    y = this.sectionLabel("Equipment", y);
    y = this.itemGrid(vm.items, y);
    if (vm.skill) {
      y = this.sectionLabel("Active Skill", y);
      this.add(crispText(this.scene, 0, y, `⚡ ${vm.skill.name}`, { fontSize: "13px", color: "#a8d8ff", fontStyle: "bold" }));
      this.add(crispText(this.scene, 0, y + 18, vm.skill.desc, { fontSize: "11px", color: "#cdd9ea", wordWrap: { width: this.innerW } }));
    }
  }

  showTower(vm: TowerPanelVM, cb: TowerCallbacks): void {
    this.current = vm;
    this.rebuild();
    let y = 50;
    y = this.header(vm.name, "★".repeat(Math.max(0, vm.stars)) || "unupgraded", vm.iconKey, 0, y, 0x4fc3f7);
    y = this.bars(vm.hp, vm.maxHp, vm.mana, vm.maxMana, y);
    y = this.statGrid(vm.stats, y);
    y = this.sectionLabel("Skills", y);
    for (const s of vm.skills) {
      this.add(crispText(this.scene, 0, y, s.label, { fontSize: "12px", color: s.color, fontStyle: "bold" }));
      y += 15;
      this.add(crispText(this.scene, 8, y, s.desc, { fontSize: "10px", color: "#b9c6d8", wordWrap: { width: this.innerW - 8 } }));
      y += Math.max(16, Math.ceil(s.desc.length / 42) * 12 + 4);
    }
    // Upgrade / Sell buttons pinned near the bottom.
    const by = this.h - 44;
    this.upBtn = crispText(this.scene, 0, by, "", { fontSize: "14px", color: "#fff", backgroundColor: "#1565c0", fixedWidth: this.innerW * 0.58, align: "center" })
      .setPadding(0, 8, 0, 8).setInteractive({ useHandCursor: true });
    this.upBtn.on("pointerup", () => cb.onUpgrade());
    const sellBtn = crispText(this.scene, this.innerW, by, `✕ Sell\n+${vm.sellValue}g`, { fontSize: "13px", color: "#fff", backgroundColor: "#7a2e2e", fixedWidth: this.innerW * 0.38, align: "center" })
      .setOrigin(1, 0).setPadding(0, 6, 0, 6).setInteractive({ useHandCursor: true });
    sellBtn.on("pointerup", () => cb.onSell());
    this.add(this.upBtn); this.add(sellBtn);
    this.refreshUpBtn(vm.upgradeCost, vm.maxed, true);
  }

  /** Cheap per-frame update of dynamic values without rebuilding the panel. */
  tick(live: LiveVals): void {
    if (!this.current) return;
    this.drawBars(live.hp, live.maxHp, live.mana, live.maxMana);
    this.hpText?.setText(`${Math.max(0, Math.ceil(live.hp))} / ${Math.ceil(live.maxHp)}`);
    if (this.barLayout.hasMana) this.manaText?.setText(`${Math.floor(live.mana)} / ${Math.ceil(live.maxMana)}`);
    if (this.current.kind === "tower" && this.upBtn) {
      this.refreshUpBtn(live.upgradeCost, this.current.maxed, live.gold >= live.upgradeCost);
    }
  }

  // ── builders ──────────────────────────────────────────────────────────────

  private rebuild(): void {
    this.content.removeAll(true);
    this.hpText = this.manaText = this.upBtn = null;
  }
  private add(o: Phaser.GameObjects.GameObject): void { this.content.add(o); }

  private header(name: string, sub: string, iconKey: string | null, _f: number, y: number, subColor: number): number {
    if (iconKey && this.scene.textures.exists(iconKey)) {
      const img = this.scene.add.image(24, y + 22, iconKey, 0).setOrigin(0.5);
      img.setScale(Math.min(48 / img.width, 48 / img.height));
      this.add(img);
    } else {
      const g = this.scene.add.graphics(); g.fillStyle(0x223044, 1).fillRoundedRect(0, y, 48, 48, 6); this.add(g);
    }
    this.add(crispText(this.scene, 58, y + 2, name, { fontSize: "16px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: this.innerW - 58 } }));
    this.add(crispText(this.scene, 58, y + 26, sub, { fontSize: "13px", color: Phaser.Display.Color.IntegerToColor(subColor).rgba }));
    return y + 56;
  }

  private bars(hp: number, maxHp: number, mana: number, maxMana: number, y: number): number {
    this.barLayout = { hpY: y, manaY: y + 22, hasMana: maxMana > 0 };
    this.add(crispText(this.scene, 0, y - 1, "HP", { fontSize: "10px", color: "#9fb0c4" }));
    this.hpText = crispText(this.scene, this.innerW, y - 1, "", { fontSize: "11px", color: "#e8eef6" }).setOrigin(1, 0);
    this.add(this.hpText);
    if (maxMana > 0) {
      this.add(crispText(this.scene, 0, y + 21, "MP", { fontSize: "10px", color: "#9fb0c4" }));
      this.manaText = crispText(this.scene, this.innerW, y + 21, "", { fontSize: "11px", color: "#cfe0ff" }).setOrigin(1, 0);
      this.add(this.manaText);
    }
    this.drawBars(hp, maxHp, mana, maxMana);
    this.hpText.setText(`${Math.max(0, Math.ceil(hp))} / ${Math.ceil(maxHp)}`);
    if (maxMana > 0) this.manaText?.setText(`${Math.floor(mana)} / ${Math.ceil(maxMana)}`);
    return y + (maxMana > 0 ? 44 : 22);
  }

  private drawBars(hp: number, maxHp: number, mana: number, maxMana: number): void {
    const g = this.barGfx; g.clear();
    const bx = this.x + PAD, bw = this.innerW;
    const bar = (yy: number, frac: number, col: number) => {
      g.fillStyle(0x000000, 0.5).fillRoundedRect(bx, yy, bw, 8, 3);
      g.fillStyle(col, 1).fillRoundedRect(bx, yy, bw * Phaser.Math.Clamp(frac, 0, 1), 8, 3);
    };
    bar(this.barLayout.hpY + 11, maxHp > 0 ? hp / maxHp : 0, 0x4caf50);
    if (this.barLayout.hasMana) bar(this.barLayout.manaY + 11, maxMana > 0 ? mana / maxMana : 0, 0x42a5f5);
  }

  private statGrid(stats: StatRow[], y: number): number {
    const colW = this.innerW / 2;
    stats.forEach((s, i) => {
      const cx = (i % 2) * colW, cy = y + Math.floor(i / 2) * 18;
      this.add(crispText(this.scene, cx, cy, s.label, { fontSize: "11px", color: "#8fa3bb" }));
      this.add(crispText(this.scene, cx + colW - 6, cy, s.value, { fontSize: "11px", color: "#e8eef6", fontStyle: "bold" }).setOrigin(1, 0));
    });
    return y + Math.ceil(stats.length / 2) * 18 + 8;
  }

  private sectionLabel(text: string, y: number): number {
    const g = this.scene.add.graphics(); g.lineStyle(1, 0x2a3a56, 1).lineBetween(0, y + 8, this.innerW, y + 8); this.add(g);
    this.add(crispText(this.scene, 0, y, text, { fontSize: "11px", color: "#ffd86a", fontStyle: "bold", backgroundColor: "#0c1018" }).setPadding(0, 0, 4, 0));
    return y + 22;
  }

  private itemGrid(items: PanelItem[], y: number): number {
    const T = 30, gap = 4, perRow = Math.floor((this.innerW + gap) / (T + gap));
    items.forEach((it, i) => {
      const cx = (i % perRow) * (T + gap), cy = y + Math.floor(i / perRow) * (T + gap);
      const g = this.scene.add.graphics();
      g.fillStyle(0x18222e, 1).fillRoundedRect(cx, cy, T, T, 4);
      g.lineStyle(1.5, it.rarityColor, it.iconKey ? 1 : 0.4).strokeRoundedRect(cx, cy, T, T, 4);
      this.add(g);
      if (it.iconKey && this.scene.textures.exists(it.iconKey)) {
        const img = this.scene.add.image(cx + T / 2, cy + T / 2, it.iconKey).setOrigin(0.5);
        img.setScale(Math.min((T - 6) / img.width, (T - 6) / img.height));
        this.add(img);
      }
      if (it.plus > 0) this.add(crispText(this.scene, cx + T - 2, cy + 1, `+${it.plus}`, { fontSize: "8px", color: "#ffe07a", fontStyle: "bold" }).setOrigin(1, 0));
    });
    const rows = Math.max(1, Math.ceil(items.length / perRow));
    return y + rows * (T + gap) + 4;
  }

  private refreshUpBtn(cost: number, maxed: boolean, afford: boolean): void {
    if (!this.upBtn) return;
    if (maxed) this.upBtn.setText("★ MAX").setBackgroundColor("#444").setAlpha(0.75);
    else this.upBtn.setText(`⬆ Upgrade\n${cost}g`).setBackgroundColor(afford ? "#1565c0" : "#2a3a4a").setAlpha(afford ? 1 : 0.6);
  }
}
