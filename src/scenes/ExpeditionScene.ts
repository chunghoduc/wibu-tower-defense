/**
 * ExpeditionScene — pick the heroes to send on the idle expedition (F2). A grid
 * of every owned hero NOT in the active battle squad (those are committed to
 * fighting and can't also gather gold). Click tiles to toggle up to 3 into the
 * party; a live header shows the resulting gold/hr, which scales with each
 * chosen hero's rarity and star level. Dispatch starts (or re-parties) the run.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import { addNamePlate } from "./namePlate.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import { MAX_EXPEDITION_TOWERS, MIN_COLLECT_MS } from "../core/expedition.ts";
import type { Rarity, CharacterDef } from "../data/schema.ts";
import { towerTex } from "../data/assetKeys.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const RARITY_ORDER: Record<Rarity, number> = { Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 4 };

const W = 960;
const MIN_COLLECT_MIN = Math.round(MIN_COLLECT_MS / 60000);

export class ExpeditionScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private picked: string[] = [];

  constructor() { super("ExpeditionScene"); }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    const save = this.mgr.getSave();
    const eligible = new Set(this.mgr.expeditionEligibleTowerIds());
    // Pre-select the current party (drop any that have since joined the squad).
    this.picked = (save.meta.expedition.towerIds ?? []).filter((id) => eligible.has(id)).slice(0, MAX_EXPEDITION_TOWERS);

    crispText(this, W / 2, 10, "🧭 Choose Expedition Heroes", { fontSize: "22px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0).setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" }).setDepth(50)
      .setInteractive({ useHandCursor: true }).on("pointerup", () => fadeToScene(this, "ActivitiesScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 520, "", { fontSize: "13px", color: "#ffe1a8", backgroundColor: "#2a1f14" })
      .setOrigin(0.5).setPadding(10, 5, 10, 5).setDepth(60).setVisible(false);
    this.redraw();
  }

  private toggle(id: string): void {
    const i = this.picked.indexOf(id);
    if (i >= 0) { this.picked.splice(i, 1); }
    else if (this.picked.length < MAX_EXPEDITION_TOWERS) { this.picked.push(id); }
    else { this.showToast(`Party is full (max ${MAX_EXPEDITION_TOWERS}) — tap a chosen hero to remove.`); return; }
    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    const save = this.mgr.getSave();
    const rate = this.mgr.expeditionGoldPerHourFor(this.picked);

    // Header: party size + live gold/hr + the collect minimum.
    const g = this.add.graphics();
    g.fillStyle(0x141b26, 1).fillRoundedRect(24, 40, W - 48, 46, 10);
    g.lineStyle(2, 0x33405a, 1).strokeRoundedRect(24, 40, W - 48, 46, 10);
    this.layer.add(g);
    this.layer.add(crispText(this, 40, 50, `Party ${this.picked.length}/${MAX_EXPEDITION_TOWERS}`, { fontSize: "15px", color: "#ffe9b0", fontStyle: "bold" }));
    this.layer.add(crispText(this, 40, 68, `Gathers ${rate} 🪙/hr  ·  collectable after ${MIN_COLLECT_MIN}m, caps at 8h`, { fontSize: "12px", color: this.picked.length ? "#ffd56a" : "#9fb0c4" }));

    // Dispatch button on the right of the header.
    const enabled = this.picked.length > 0;
    if (enabled) {
      const btn = crispText(this, W - 40, 63, save.meta.expedition.startedAt > 0 ? "Re-dispatch" : "Dispatch", { fontSize: "15px", color: "#ffffff", backgroundColor: "#1f8f43", fontStyle: "bold" })
        .setOrigin(1, 0.5).setPadding(16, 7, 16, 7).setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setBackgroundColor("#27a851"));
      btn.on("pointerout", () => btn.setBackgroundColor("#1f8f43"));
      btn.on("pointerup", () => this.dispatch());
      this.layer.add(btn);
    } else {
      this.layer.add(crispText(this, W - 40, 63, "Pick at least 1 hero", { fontSize: "13px", color: "#6b7a8d" }).setOrigin(1, 0.5));
    }

    this.drawGrid(save);
  }

  private drawGrid(save: ReturnType<SaveManager["getSave"]>): void {
    const eligibleIds = new Set(this.mgr.expeditionEligibleTowerIds());
    const owned = TOWERS.filter((t) => eligibleIds.has(t.id)).sort((a, b) =>
      (RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]) || a.name.localeCompare(b.name));

    if (owned.length === 0) {
      this.layer.add(crispText(this, 40, 120,
        "No spare heroes — everyone you own is in the battle squad. Free one up in the Squad screen or summon more.",
        { fontSize: "13px", color: "#90a4bb", wordWrap: { width: W - 80 } }));
      return;
    }

    const COLS = 8, CW = 112, CH = 86, X0 = 28, Y0 = 100, BOTTOM = 500;
    owned.forEach((t, idx) => {
      const cx = X0 + (idx % COLS) * CW, cy = Y0 + Math.floor(idx / COLS) * CH;
      if (cy + CH - 10 > BOTTOM) return; // clip overflow
      this.layer.add(this.makeTile(t, cx, cy, CW - 10, CH - 10, getTowerStars(save, t.id)));
    });
  }

  private makeTile(t: CharacterDef, cx: number, cy: number, w: number, h: number, stars: number): Phaser.GameObjects.Container {
    const order = this.picked.indexOf(t.id);
    const picked = order >= 0;
    const c = this.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
    const g = this.add.graphics();
    g.fillStyle(picked ? 0x1f3322 : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(picked ? 3 : 1.5, picked ? 0x52c878 : RARITY_INT[t.rarity], picked ? 1 : 0.85).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    c.add(g);
    const key = towerTex(t.id);
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -10, key).setOrigin(0.5);
      img.setScale(44 / img.height); c.add(img);
    }
    addNamePlate(this, c, t.name, {
      width: w, topY: h / 2 - 24, height: 24, radius: 6,
      accent: RARITY_INT[t.rarity], color: RARITY_HEX[t.rarity], basePx: 9, minPx: 7, maxLines: 2,
    });
    if (stars > 0) c.add(crispText(this, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), { fontSize: "9px", color: "#ffd24a" }));
    if (picked) c.add(crispText(this, w / 2 - 6, -h / 2 + 3, `${order + 1}`, { fontSize: "12px", color: "#a5f0b8", fontStyle: "bold" }).setOrigin(1, 0));

    c.setInteractive({ useHandCursor: true });
    c.on("pointerup", () => this.toggle(t.id));
    return c;
  }

  private dispatch(): void {
    this.mgr.startExpedition(this.picked);
    this.showToast(`Dispatched ${this.picked.length} hero${this.picked.length === 1 ? "" : "es"}!`);
    this.time.delayedCall(700, () => fadeToScene(this, "ActivitiesScene"));
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}
