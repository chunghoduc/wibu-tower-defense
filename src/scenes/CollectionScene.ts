import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import type { CharacterDef } from "../data/schema.ts";
import { passiveInfo, towerActiveInfo } from "../data/passiveSkills.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";

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
  private detail: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("CollectionScene");
  }

  create(): void {
    this.detail = null;
    fadeIn(this);
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
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

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

      // Click a card to open the character codex (metadata + skills).
      this.add
        .zone(x, y + CARD_H / 2, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.showDetail(tower, stars));
    });
  }

  /** Modal codex card: avatar, homage/outfit/weapon, lore, and skill icons. */
  private showDetail(tower: CharacterDef, stars: number): void {
    this.detail?.destroy(true);
    const W = this.scale.width, H = this.scale.height;
    const PW = 540, PH = 396;
    const px = (W - PW) / 2, py = (H - PH) / 2;
    const accent = RARITY_INT[tower.rarity] ?? 0x888888;
    const accentHex = RARITY_HEX[tower.rarity] ?? "#888888";
    const c = this.add.container(0, 0).setDepth(100);

    // Dim backdrop — click anywhere outside closes.
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.66).fillRect(0, 0, W, H);
    const dimZone = this.add.zone(W / 2, H / 2, W, H).setInteractive().on("pointerdown", () => this.closeDetail());
    c.add([dim, dimZone]);

    // Panel.
    const panel = this.add.graphics();
    panel.fillStyle(0x10141d, 0.99).fillRoundedRect(px, py, PW, PH, 10);
    panel.lineStyle(2, accent, 1).strokeRoundedRect(px, py, PW, PH, 10);
    const panelZone = this.add.zone(px + PW / 2, py + PH / 2, PW, PH).setInteractive(); // swallow clicks
    c.add([panel, panelZone]);

    const pad = 18;
    let x = px + pad;
    const top = py + pad;

    // Avatar.
    const avSize = 92;
    const avKey = `tower__${tower.id}`;
    const avBox = this.add.graphics();
    avBox.fillStyle(0x070a10, 1).fillRoundedRect(x, top, avSize, avSize, 8);
    avBox.lineStyle(1.5, accent, 0.8).strokeRoundedRect(x, top, avSize, avSize, 8);
    c.add(avBox);
    if (this.textures.exists(avKey)) {
      const img = this.add.image(x + avSize / 2, top + avSize / 2, avKey, 0).setOrigin(0.5);
      img.setScale(Math.min((avSize - 12) / img.width, (avSize - 12) / img.height));
      c.add(img);
    }

    // Title block (right of avatar).
    const tx = x + avSize + 14;
    c.add(this.add.text(tx, top, tower.name, { fontSize: "20px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: PW - avSize - pad * 2 - 14 } }));
    c.add(this.add.text(tx, top + 28, `${tower.rarity} · ${roleLabel(tower.role)}`, { fontSize: "13px", color: accentHex, fontStyle: "bold" }));
    if (stars > 0) c.add(this.add.text(tx, top + 46, "★".repeat(stars), { fontSize: "14px", color: "#ffd700" }));
    const close = this.add.text(px + PW - pad, top - 4, "✕", { fontSize: "20px", color: "#9fb0c4", fontStyle: "bold" })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.closeDetail());
    c.add(close);

    // Codex metadata + lore.
    let y = top + avSize + 12;
    const labelW = 72;
    const field = (label: string, value: string): void => {
      c.add(this.add.text(x, y, label, { fontSize: "12px", color: "#ffd86a", fontStyle: "bold" }));
      const t = this.add.text(x + labelW, y, value, { fontSize: "12px", color: "#dfe7f2", wordWrap: { width: PW - pad * 2 - labelW } });
      c.add(t);
      y += Math.max(18, t.height + 5);
    };
    const m = tower.meta;
    if (m) {
      field("Inspired by", m.homage);
      field("Outfit", m.outfit);
      field("Weapon", m.weapon.display);
    }
    field("Lore", tower.description);

    // Skills — active + passives as icon + name.
    y += 4;
    c.add(this.add.text(x, y, "SKILLS", { fontSize: "12px", color: "#9fb0c4", fontStyle: "bold" }));
    y += 20;
    const rows: { key: string; name: string; desc: string; tag: string; col: string }[] = [];
    if (tower.active) { const a = towerActiveInfo(tower.active); rows.push({ key: `skill__${tower.active}`, name: a.name, desc: a.description, tag: "Active", col: "#a8d8ff" }); }
    for (const pid of tower.passives) { const p = passiveInfo(pid); rows.push({ key: `skill__${pid}`, name: p.name, desc: p.description, tag: "Passive", col: "#cdd6e6" }); }

    const S = 34, rowH = 40, colW = (PW - pad * 2) / 2;
    rows.forEach((r, i) => {
      const rx = x + (i % 2) * colW;
      const ry = y + Math.floor(i / 2) * rowH;
      const box = this.add.graphics();
      const ic = Phaser.Display.Color.HexStringToColor(r.col.replace("#", "")).color;
      box.fillStyle(0x16202c, 1).fillRoundedRect(rx, ry, S, S, 6);
      box.lineStyle(1.5, ic, 0.9).strokeRoundedRect(rx, ry, S, S, 6);
      c.add(box);
      if (this.textures.exists(r.key)) {
        const img = this.add.image(rx + S / 2, ry + S / 2, r.key).setOrigin(0.5);
        img.setScale(Math.min((S - 6) / img.width, (S - 6) / img.height));
        c.add(img);
      }
      c.add(this.add.text(rx + S + 8, ry + 1, r.name, { fontSize: "12px", color: "#ffffff", fontStyle: "bold" }));
      c.add(this.add.text(rx + S + 8, ry + 16, r.tag, { fontSize: "9px", color: r.tag === "Active" ? "#a8d8ff" : "#8fa0b4" }));
    });

    this.detail = c;
  }

  private closeDetail(): void {
    this.detail?.destroy(true);
    this.detail = null;
  }
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    damage: "Damage", splash: "Splash", chain: "Chain", dot: "Damage-over-time", debuff: "Debuff", support: "Support",
  };
  return map[role] ?? role;
}
