/**
 * BattleInfoPanel — a compact, collapsible right-side info panel (UI layer, 1:1
 * camera → crisp text). It OVERLAYS the battlefield (does not resize it) and can
 * be toggled via a tab on its left edge. Icon-driven to stay small: stats are
 * icon+number, equipment is a paper-doll, skills are icons with hover tooltips.
 *
 * Presentational only — the scene passes a view model + callbacks.
 */
import Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { drawSkillGlyph, drawStatGlyph } from "./battleInfoGlyphs.ts";

export interface StatRow {
  key: string;
  value: string;
  /** Set when this stat is currently raised by a support-aura buff — the number
   *  is tinted this color (and re-tinted live as the tower enters/leaves auras). */
  buffColor?: number;
}
export interface PanelItem {
  iconKey: string | null;
  name: string;
  plus: number;
  rarityColor: number;
}
export interface SkillRow {
  label: string;
  desc: string;
  color: string;
  iconKey?: string;
}

export interface HeroPanelVM {
  kind: "hero";
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: StatRow[];
  items: Record<string, PanelItem>; // keyed by slot id
  skills: SkillRow[];
}
export interface TowerPanelVM {
  kind: "tower";
  uid: number;
  name: string;
  iconKey: string | null;
  stars: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: StatRow[];
  skills: SkillRow[];
  upgradeCost: number;
  sellValue: number;
  maxed: boolean;
}
export type PanelVM = HeroPanelVM | TowerPanelVM;
export interface TowerCallbacks {
  onUpgrade: () => void;
  onSell: () => void;
  onUpgradeHover?: (over: boolean) => void;
}
export interface LiveVals {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  upgradeCost: number;
  /** Fresh stat rows (tower only) so aura-buffed atk / attack-speed update live. */
  statRows?: StatRow[];
}

const STAT_COLOR = "#e8eef6";

export const PANEL_W = 232;
const PAD = 10;
const TAB_W = 22,
  TAB_H = 70;

// Equipment paper-doll layout (player-requested order).
const EQUIP_LAYOUT: (string | null)[][] = [
  ["Helmet", "Wing", "Pet"],
  ["Amulet", "Weapon", "BodyArmor"],
  ["Gloves", "Boots", null],
  ["Ring1", "Ring2", null],
];
const SLOT_ABBR: Record<string, string> = {
  Helmet: "Hd",
  Wing: "Wg",
  Pet: "Pet",
  Amulet: "Am",
  Weapon: "Wp",
  BodyArmor: "Ar",
  Gloves: "Gl",
  Boots: "Bt",
  Ring1: "R1",
  Ring2: "R2",
};

const STAT_LABEL: Record<string, string> = {
  atk: "Attack",
  range: "Range",
  attackSpeed: "Attack Speed",
  critRate: "Crit Chance",
  critDamage: "Crit Damage",
  armor: "Armor",
  magicResist: "Magic Resist",
  moveSpeed: "Move Speed",
  hpRegen: "HP Regen",
  skillPower: "Skill Power",
  omnivamp: "Omnivamp",
  goldFind: "Gold Find",
  armorPen: "Armor Pen",
  magicPen: "Magic Pen",
  damageReduction: "Damage Reduction",
  critDefense: "Crit Defense",
  tenacity: "Tenacity",
};

export class BattleInfoPanel {
  private readonly panelX: number;
  private readonly innerW: number;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly content: Phaser.GameObjects.Container;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly tab: Phaser.GameObjects.Container;
  private readonly tabLabel: Phaser.GameObjects.Text;
  private readonly tip: Phaser.GameObjects.Container;
  private readonly tipBg: Phaser.GameObjects.Graphics;
  private readonly tipText: Phaser.GameObjects.Text;

  private open = false;
  private current: PanelVM | null = null;
  private hpText: Phaser.GameObjects.Text | null = null;
  private manaText: Phaser.GameObjects.Text | null = null;
  private statTextByKey = new Map<string, Phaser.GameObjects.Text>();
  private upBtn: Phaser.GameObjects.Text | null = null;
  private bars: { hpY: number; manaY: number; hasMana: boolean } = {
    hpY: 0,
    manaY: 0,
    hasMana: false,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly screenW: number,
    private readonly screenH: number,
    onToggle: () => void,
  ) {
    this.panelX = screenW - PANEL_W;
    this.innerW = PANEL_W - PAD * 2;

    this.bg = scene.add.graphics().setDepth(40);
    this.bg.fillStyle(0x0c1018, 0.97).fillRect(this.panelX, 0, PANEL_W, screenH);
    this.bg.lineStyle(2, 0x2a3a56, 1).lineBetween(this.panelX, 0, this.panelX, screenH);
    this.content = scene.add.container(this.panelX + PAD, 0).setDepth(41);
    this.barGfx = scene.add.graphics().setDepth(42);

    // Hover tooltip (shared).
    this.tip = scene.add.container(0, 0).setDepth(60).setVisible(false);
    this.tipBg = scene.add.graphics();
    this.tipText = panelText(scene, 0, 0, "", {
      fontSize: "13px",
      color: "#f3f7fd",
      lineSpacing: 4,
    });
    this.tip.add([this.tipBg, this.tipText]);

    // Toggle tab on the panel's left edge.
    this.tab = scene.add.container(0, screenH / 2).setDepth(43);
    const tabBg = scene.add.graphics();
    tabBg.fillStyle(0x1a2740, 1).fillRoundedRect(0, -TAB_H / 2, TAB_W, TAB_H, 5);
    tabBg.lineStyle(1.5, 0x3a4a6a, 1).strokeRoundedRect(0, -TAB_H / 2, TAB_W, TAB_H, 5);
    this.tabLabel = crispText(scene, TAB_W / 2, 0, "◀", {
      fontSize: "14px",
      color: "#cfe0ff",
    }).setOrigin(0.5);
    const tabZone = scene.add
      .zone(0, -TAB_H / 2, TAB_W, TAB_H)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    tabZone.on("pointerup", () => onToggle());
    this.tab.add([tabBg, this.tabLabel, tabZone]);

    layer.add([this.bg, this.content, this.barGfx, this.tip, this.tab]);
    this.setOpen(false);
  }

  // ── open/close ──────────────────────────────────────────────────────────────
  isOpen(): boolean {
    return this.open;
  }
  /** A click at screen x is "on the panel" when the panel is open. */
  hitsPanel(x: number): boolean {
    return this.open && x >= this.panelX;
  }
  /** A click at (x,y) is on the toggle tab. */
  hitsTab(x: number, y: number): boolean {
    const tx = this.open ? this.panelX - TAB_W : this.screenW - TAB_W;
    return (
      x >= tx &&
      x <= tx + TAB_W &&
      y >= this.screenH / 2 - TAB_H / 2 &&
      y <= this.screenH / 2 + TAB_H / 2
    );
  }
  setOpen(v: boolean): void {
    this.open = v;
    this.bg.setVisible(v);
    this.content.setVisible(v);
    this.barGfx.setVisible(v);
    if (!v) this.tip.setVisible(false);
    this.tab.setX(v ? this.panelX - TAB_W : this.screenW - TAB_W);
    this.tabLabel.setText(v ? "▶" : "◀");
  }

  // ── content ─────────────────────────────────────────────────────────────────

  showHero(vm: HeroPanelVM): void {
    this.current = vm;
    this.rebuild();
    let y = this.header(vm.name, `Level ${vm.level}`, "hero__hero", 0xffd700);
    y = this.barsRow(vm.hp, vm.maxHp, vm.mana, vm.maxMana, y);
    y = this.statIcons(vm.stats, y);
    y = this.section("Equipment", y);
    y = this.equipDoll(vm.items, y);
    this.section("Skills", y);
    this.skillIcons(vm.skills, y + 16);
  }

  showTower(vm: TowerPanelVM, cb: TowerCallbacks): void {
    this.current = vm;
    this.rebuild();
    let y = this.header(
      vm.name,
      vm.stars > 0 ? "★".repeat(vm.stars) : "unupgraded",
      vm.iconKey,
      0x4fc3f7,
    );
    y = this.barsRow(vm.hp, vm.maxHp, vm.mana, vm.maxMana, y);
    y = this.statIcons(vm.stats, y);
    y = this.section("Skills", y);
    this.skillIcons(vm.skills, y);

    const by = this.screenH - 42;
    this.upBtn = crispText(this.scene, 0, by, "", {
      fontSize: "13px",
      color: "#fff",
      backgroundColor: "#1565c0",
      fixedWidth: this.innerW * 0.6,
      align: "center",
    })
      .setPadding(0, 7, 0, 7)
      .setInteractive({ useHandCursor: true });
    this.upBtn.on("pointerup", () => cb.onUpgrade());
    this.upBtn.on("pointerover", () => cb.onUpgradeHover?.(true));
    this.upBtn.on("pointerout", () => cb.onUpgradeHover?.(false));
    const sell = crispText(this.scene, this.innerW, by, `✕ Sell\n+${vm.sellValue}g`, {
      fontSize: "12px",
      color: "#fff",
      backgroundColor: "#7a2e2e",
      fixedWidth: this.innerW * 0.36,
      align: "center",
    })
      .setOrigin(1, 0)
      .setPadding(0, 5, 0, 5)
      .setInteractive({ useHandCursor: true });
    sell.on("pointerup", () => cb.onSell());
    this.add(this.upBtn);
    this.add(sell);
    this.refreshUp(vm.upgradeCost, vm.maxed, true);
  }

  tick(live: LiveVals): void {
    if (!this.current || !this.open) return;
    this.drawBars(live.hp, live.maxHp, live.mana, live.maxMana);
    this.hpText?.setText(`${Math.max(0, Math.ceil(live.hp))}/${Math.ceil(live.maxHp)}`);
    if (this.bars.hasMana)
      this.manaText?.setText(`${Math.floor(live.mana)}/${Math.ceil(live.maxMana)}`);
    if (this.current.kind === "tower" && this.upBtn)
      this.refreshUp(live.upgradeCost, this.current.maxed, live.gold >= live.upgradeCost);
    if (live.statRows) this.refreshStats(live.statRows);
  }

  /** Re-tint + retext stat numbers in place so aura buffs show the moment a tower
   *  enters or leaves a support aura — no full rebuild (row set is stable). */
  private refreshStats(rows: StatRow[]): void {
    for (const r of rows) {
      const t = this.statTextByKey.get(r.key);
      if (!t) continue;
      if (t.text !== r.value) t.setText(r.value);
      const col =
        r.buffColor != null ? Phaser.Display.Color.IntegerToColor(r.buffColor).rgba : STAT_COLOR;
      if (t.style.color !== col) t.setColor(col);
    }
  }

  // ── builders ─────────────────────────────────────────────────────────────────

  private rebuild(): void {
    this.content.removeAll(true);
    this.hpText = this.manaText = this.upBtn = null;
  }
  private add(o: Phaser.GameObjects.GameObject): void {
    this.content.add(o);
  }
  private gfx(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    this.add(g);
    return g;
  }

  private header(name: string, sub: string, iconKey: string | null, subColor: number): number {
    const y = 12;
    if (iconKey && this.scene.textures.exists(iconKey)) {
      const img = this.scene.add.image(20, y + 18, iconKey, 0).setOrigin(0.5);
      img.setScale(Math.min(40 / img.width, 40 / img.height));
      this.add(img);
    }
    this.add(
      crispText(this.scene, 46, y, name, {
        fontSize: "15px",
        color: "#fff",
        fontStyle: "bold",
        wordWrap: { width: this.innerW - 46 },
      }),
    );
    this.add(
      crispText(this.scene, 46, y + 22, sub, {
        fontSize: "12px",
        color: Phaser.Display.Color.IntegerToColor(subColor).rgba,
      }),
    );
    return y + 44;
  }

  private barsRow(hp: number, maxHp: number, mana: number, maxMana: number, y: number): number {
    this.bars = { hpY: y, manaY: y + 16, hasMana: maxMana > 0 };
    this.hpText = crispText(this.scene, this.innerW, y - 2, "", {
      fontSize: "10px",
      color: "#dfeaf6",
    }).setOrigin(1, 0);
    this.add(crispText(this.scene, 0, y - 2, "HP", { fontSize: "9px", color: "#9fb0c4" }));
    this.add(this.hpText);
    if (maxMana > 0) {
      this.manaText = crispText(this.scene, this.innerW, y + 14, "", {
        fontSize: "10px",
        color: "#cfe0ff",
      }).setOrigin(1, 0);
      this.add(crispText(this.scene, 0, y + 14, "MP", { fontSize: "9px", color: "#9fb0c4" }));
      this.add(this.manaText);
    }
    this.drawBars(hp, maxHp, mana, maxMana);
    this.hpText.setText(`${Math.max(0, Math.ceil(hp))}/${Math.ceil(maxHp)}`);
    if (maxMana > 0) this.manaText?.setText(`${Math.floor(mana)}/${Math.ceil(maxMana)}`);
    return y + (maxMana > 0 ? 32 : 16);
  }

  private drawBars(hp: number, maxHp: number, mana: number, maxMana: number): void {
    const g = this.barGfx;
    g.clear();
    const bx = this.panelX + PAD,
      bw = this.innerW;
    const bar = (yy: number, f: number, col: number) => {
      g.fillStyle(0x000000, 0.5).fillRoundedRect(bx, yy, bw, 6, 3);
      g.fillStyle(col, 1).fillRoundedRect(bx, yy, bw * Phaser.Math.Clamp(f, 0, 1), 6, 3);
    };
    bar(this.bars.hpY + 9, maxHp > 0 ? hp / maxHp : 0, 0x4caf50);
    if (this.bars.hasMana) bar(this.bars.manaY + 9, maxMana > 0 ? mana / maxMana : 0, 0x42a5f5);
  }

  /** Stats as a 2-column grid of icon + number. */
  private statIcons(stats: StatRow[], y: number): number {
    const ig = this.gfx();
    const colW = this.innerW / 2;
    this.statTextByKey.clear();
    stats.forEach((s, i) => {
      const cx = (i % 2) * colW,
        cy = y + Math.floor(i / 2) * 18;
      drawStatGlyph(ig, s.key, cx + 7, cy + 8, 6.5);
      const t = crispText(this.scene, cx + 18, cy, s.value, {
        fontSize: "11px",
        color:
          s.buffColor != null ? Phaser.Display.Color.IntegerToColor(s.buffColor).rgba : STAT_COLOR,
        fontStyle: "bold",
      });
      this.statTextByKey.set(s.key, t);
      this.add(t);
      // hover label
      const z = this.scene.add.zone(cx, cy, colW, 17).setOrigin(0).setInteractive();
      z.on("pointerover", (p: Phaser.Input.Pointer) => this.showTip(STAT_LABEL[s.key] ?? s.key, p));
      z.on("pointerout", () => this.tip.setVisible(false));
      this.add(z);
    });
    return y + Math.ceil(stats.length / 2) * 18 + 6;
  }

  private section(text: string, y: number): number {
    const g = this.gfx();
    g.lineStyle(1, 0x2a3a56, 1).lineBetween(0, y + 7, this.innerW, y + 7);
    this.add(
      crispText(this.scene, 0, y, text, {
        fontSize: "11px",
        color: "#ffd86a",
        fontStyle: "bold",
        backgroundColor: "#0c1018",
      }).setPadding(0, 0, 4, 0),
    );
    return y + 20;
  }

  /** Equipment paper-doll: slots in the requested layout. */
  private equipDoll(items: Record<string, PanelItem>, y: number): number {
    const T = 40,
      gap = 6,
      cols = 3;
    const startX = (this.innerW - (cols * T + (cols - 1) * gap)) / 2;
    EQUIP_LAYOUT.forEach((row, r) => {
      row.forEach((slot, c) => {
        if (!slot) return;
        const x = startX + c * (T + gap),
          sy = y + r * (T + gap);
        const it = items[slot];
        const g = this.scene.add.graphics();
        g.fillStyle(0x16202c, 1).fillRoundedRect(x, sy, T, T, 5);
        g.lineStyle(1.5, it ? it.rarityColor : 0x2c3a4e, it ? 1 : 0.7).strokeRoundedRect(
          x,
          sy,
          T,
          T,
          5,
        );
        this.add(g);
        if (it?.iconKey && this.scene.textures.exists(it.iconKey)) {
          const img = this.scene.add.image(x + T / 2, sy + T / 2, it.iconKey).setOrigin(0.5);
          img.setScale(Math.min((T - 6) / img.width, (T - 6) / img.height));
          this.add(img);
          if (it.plus > 0)
            this.add(
              crispText(this.scene, x + T - 2, sy + 1, `+${it.plus}`, {
                fontSize: "9px",
                color: "#ffe07a",
                fontStyle: "bold",
              }).setOrigin(1, 0),
            );
          const z = this.scene.add.zone(x, sy, T, T).setOrigin(0).setInteractive();
          z.on("pointerover", (p: Phaser.Input.Pointer) =>
            this.showTip(`${it.name}${it.plus ? ` +${it.plus}` : ""}`, p),
          );
          z.on("pointerout", () => this.tip.setVisible(false));
          this.add(z);
        } else {
          this.add(
            crispText(this.scene, x + T / 2, sy + T / 2, SLOT_ABBR[slot] ?? "", {
              fontSize: "10px",
              color: "#445468",
            }).setOrigin(0.5),
          );
        }
      });
    });
    return y + EQUIP_LAYOUT.length * (T + gap) + 2;
  }

  /** Skills as a row of icons; full text appears on hover. */
  private skillIcons(skills: SkillRow[], y: number): number {
    const S = 28,
      gap = 6;
    skills.forEach((s, i) => {
      const x = i * (S + gap);
      const g = this.scene.add.graphics();
      const col = Phaser.Display.Color.HexStringToColor(s.color.replace("#", "")).color;
      g.fillStyle(0x16202c, 1).fillRoundedRect(x, y, S, S, 5);
      g.lineStyle(1.5, col, 0.9).strokeRoundedRect(x, y, S, S, 5);
      this.add(g);
      // Prefer the painted skill icon texture; fall back to a procedural glyph.
      if (s.iconKey && this.scene.textures.exists(s.iconKey)) {
        const img = this.scene.add.image(x + S / 2, y + S / 2, s.iconKey).setOrigin(0.5);
        img.setScale(Math.min((S - 5) / img.width, (S - 5) / img.height));
        this.add(img);
      } else {
        drawSkillGlyph(g, s.label, s.desc, x + S / 2, y + S / 2, 8, col);
      }
      const z = this.scene.add
        .zone(x, y, S, S)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const title = s.label.replace(/^[⚡•▲]\s*/, "");
      z.on("pointerover", (p: Phaser.Input.Pointer) => this.showTip(`${title}\n${s.desc}`, p, 200));
      z.on("pointerout", () => this.tip.setVisible(false));
      this.add(z);
    });
    return y + S + 4;
  }

  private showTip(text: string, p: Phaser.Input.Pointer, wrapW = 160): void {
    this.tipText.setText(text).setWordWrapWidth(wrapW, true);
    const padX = 9,
      padY = 7;
    const w = Math.min(wrapW, this.tipText.width) + padX * 2,
      h = this.tipText.height + padY * 2;
    let tx = p.x - w - 8;
    if (tx < 4) tx = p.x + 12;
    const ty = Phaser.Math.Clamp(p.y - h / 2, 4, this.screenH - h - 4);
    this.tipBg.clear();
    this.tipBg.fillStyle(0x070b12, 0.98).fillRoundedRect(0, 0, w, h, 6);
    this.tipBg.lineStyle(1.5, 0x5a7cb0, 1).strokeRoundedRect(0, 0, w, h, 6);
    this.tipText.setPosition(padX, padY);
    this.tip.setPosition(tx, ty).setVisible(true);
    this.scene.children.bringToTop(this.tip);
  }

  private refreshUp(cost: number, maxed: boolean, afford: boolean): void {
    if (!this.upBtn) return;
    if (maxed) this.upBtn.setText("★ MAX").setBackgroundColor("#444").setAlpha(0.75);
    else
      this.upBtn
        .setText(`⬆ Upgrade\n${cost}g`)
        .setBackgroundColor(afford ? "#1565c0" : "#2a3a4a")
        .setAlpha(afford ? 1 : 0.6);
  }
}
