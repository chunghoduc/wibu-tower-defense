import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import type { CharacterDef } from "../data/schema.ts";
import { passiveInfo, towerActiveInfo } from "../data/passiveSkills.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { drawScrollbar } from "./scrollbar.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import { towerTex, skillTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";

// Avatar-forward grid: each card shows the tower's portrait (frame 0 of its
// `tower__<id>` sheet). Owned cards are full colour; locked ones render as a
// dark silhouette of the same art. Rows overflow the viewport and scroll.
const COLS = 6;
const CARD_W = 142;
const CARD_H = 134;
const GX = 10;
const GY = 10;
const X0 = (960 - (COLS * CARD_W + (COLS - 1) * GX)) / 2;
const Y0 = 80;
const BOTTOM = 530;
const ROW_H = CARD_H + GY;

export class CollectionScene extends Phaser.Scene {
  private detail: Phaser.GameObjects.Container | null = null;
  private grid!: Phaser.GameObjects.Container;
  private offset = 0;
  private maxOffset = 0;
  private drag!: DragScrollHandle;

  constructor() {
    super("CollectionScene");
  }

  create(): void {
    this.detail = null;
    this.offset = 0;
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

    this.grid = this.add.container(0, 0);

    const visibleRows = Math.max(1, Math.floor((BOTTOM - Y0) / ROW_H));
    const totalRows = Math.ceil(TOWERS.length / COLS);
    this.maxOffset = Math.max(0, totalRows - visibleRows);

    // Mouse wheel (desktop) scrolls one row per notch.
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.detail || this.maxOffset <= 0) return;
      const next = Phaser.Math.Clamp(this.offset + (dy > 0 ? 1 : -1), 0, this.maxOffset);
      if (next !== this.offset) {
        this.offset = next;
        this.drawGrid(save);
      }
    });

    // Touch/drag scrolling (mobile). A moved gesture suppresses the card tap.
    this.drag = attachDragScroll(this, {
      rect: () => ({ x: X0, y: Y0, w: COLS * (CARD_W + GX), h: BOTTOM - Y0 }),
      rowH: ROW_H,
      maxOffset: () => this.maxOffset,
      getOffset: () => this.offset,
      setOffset: (n) => {
        this.offset = n;
      },
      onChange: () => this.drawGrid(save),
      enabled: () => !this.detail,
    });

    this.drawGrid(save);
  }

  /** Render only the rows currently inside the viewport window. */
  private drawGrid(save: ReturnType<SaveManager["getSave"]>): void {
    this.grid.removeAll(true);
    const visibleRows = Math.max(1, Math.floor((BOTTOM - Y0) / ROW_H));
    this.offset = Phaser.Math.Clamp(this.offset, 0, this.maxOffset);

    for (let r = 0; r < visibleRows; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = (this.offset + r) * COLS + c;
        if (idx >= TOWERS.length) break;
        this.drawCard(save, TOWERS[idx], X0 + c * (CARD_W + GX), Y0 + r * ROW_H);
      }
    }

    drawScrollbar(this, this.grid, {
      x: X0 + COLS * (CARD_W + GX) - GX + 2,
      y: Y0,
      h: visibleRows * ROW_H - GY,
      total: Math.ceil(TOWERS.length / COLS),
      visible: visibleRows,
      offset: this.offset,
    });
  }

  private drawCard(
    save: ReturnType<SaveManager["getSave"]>,
    tower: CharacterDef,
    x: number,
    y: number,
  ): void {
    const isOwned = tower.id in save.collection;
    const stars = getTowerStars(save, tower.id);
    const colorInt = isOwned ? (RARITY_INT[tower.rarity] ?? 0x888888) : 0x37404e;
    const hexColor = isOwned ? (RARITY_HEX[tower.rarity] ?? "#888888") : "#6b7689";

    const g = this.add.graphics();
    g.fillStyle(0x0c111a, isOwned ? 1 : 0.85).fillRoundedRect(x, y, CARD_W, CARD_H, 8);
    g.fillStyle(colorInt, isOwned ? 0.14 : 0.06).fillRoundedRect(x, y, CARD_W, CARD_H, 8);
    g.lineStyle(1.5, colorInt, isOwned ? 1 : 0.5).strokeRoundedRect(x, y, CARD_W, CARD_H, 8);
    this.grid.add(g);

    // Avatar: frame 0 of the tower sheet, fit into the upper portrait area.
    const avH = 82,
      avCX = x + CARD_W / 2,
      avCY = y + 8 + avH / 2;
    const avKey = towerTex(tower.id);
    if (this.textures.exists(avKey)) {
      const img = this.add.image(avCX, avCY, avKey, 0).setOrigin(0.5);
      img.setScale(Math.min((CARD_W - 16) / img.width, avH / img.height));
      if (!isOwned) img.setTintFill(0x1d2532); // silhouette on WebGL
      this.grid.add(img);
    } else {
      this.grid.add(
        this.add
          .text(avCX, avCY, isOwned ? "◈" : "?", { fontSize: "30px", color: hexColor })
          .setOrigin(0.5),
      );
    }
    // Locked: darken the portrait (renderer-independent) and mark it unknown.
    if (!isOwned) {
      const veil = this.add.graphics();
      veil.fillStyle(0x080b12, 0.6).fillRoundedRect(x + 8, y + 8, CARD_W - 16, avH, 6);
      this.grid.add(veil);
      this.grid.add(
        this.add
          .text(avCX, avCY, "?", { fontSize: "34px", color: "#7d889c", fontStyle: "bold" })
          .setOrigin(0.5),
      );
    }

    // Name.
    this.grid.add(
      this.add
        .text(avCX, y + 96, isOwned ? tower.name : "??????", {
          fontSize: "10px",
          color: hexColor,
          fontStyle: "bold",
          wordWrap: { width: CARD_W - 10 },
          align: "center",
        })
        .setOrigin(0.5, 0),
    );

    // Footer: rarity (left) + stars (right).
    this.grid.add(
      this.add
        .text(x + 8, y + CARD_H - 16, tower.rarity, {
          fontSize: "9px",
          color: isOwned ? "#c4ccd8" : "#566073",
        })
        .setOrigin(0, 0),
    );
    if (isOwned && stars > 0) {
      this.grid.add(
        this.add
          .text(x + CARD_W - 8, y + CARD_H - 16, "★".repeat(stars), {
            fontSize: "11px",
            color: "#ffd700",
          })
          .setOrigin(1, 0),
      );
    }

    // Tap opens the codex — unless the gesture was a scroll drag.
    const z = this.add
      .zone(x, y, CARD_W, CARD_H)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (!this.drag.didScroll()) this.showDetail(tower, stars);
    });
    this.grid.add(z);
  }

  /** Modal codex card: avatar, homage/outfit/weapon, lore, and skill icons. */
  private showDetail(tower: CharacterDef, stars: number): void {
    this.detail?.destroy(true);
    const W = this.scale.width,
      H = this.scale.height;
    const PW = 540,
      PH = 396;
    const px = (W - PW) / 2,
      py = (H - PH) / 2;
    const accent = RARITY_INT[tower.rarity] ?? 0x888888;
    const accentHex = RARITY_HEX[tower.rarity] ?? "#888888";
    const c = this.add.container(0, 0).setDepth(100);

    // Dim backdrop — click anywhere outside closes.
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.66).fillRect(0, 0, W, H);
    const dimZone = this.add
      .zone(W / 2, H / 2, W, H)
      .setInteractive()
      .on("pointerdown", () => this.closeDetail());
    c.add([dim, dimZone]);

    // Panel.
    const panel = this.add.graphics();
    panel.fillStyle(0x10141d, 0.99).fillRoundedRect(px, py, PW, PH, 10);
    panel.lineStyle(2, accent, 1).strokeRoundedRect(px, py, PW, PH, 10);
    const panelZone = this.add.zone(px + PW / 2, py + PH / 2, PW, PH).setInteractive(); // swallow clicks
    c.add([panel, panelZone]);

    const pad = 18;
    const x = px + pad;
    const top = py + pad;

    // Avatar.
    const avSize = 92;
    const avKey = towerTex(tower.id);
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
    c.add(
      this.add.text(tx, top, tower.name, {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
        wordWrap: { width: PW - avSize - pad * 2 - 14 },
      }),
    );
    c.add(
      this.add.text(tx, top + 28, `${tower.rarity} · ${roleLabel(tower.role)}`, {
        fontSize: "13px",
        color: accentHex,
        fontStyle: "bold",
      }),
    );
    if (stars > 0)
      c.add(this.add.text(tx, top + 46, "★".repeat(stars), { fontSize: "14px", color: "#ffd700" }));
    const close = this.add
      .text(px + PW - pad, top - 4, "✕", { fontSize: "20px", color: "#9fb0c4", fontStyle: "bold" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.closeDetail());
    c.add(close);

    // Codex metadata + lore.
    let y = top + avSize + 12;
    const labelW = 72;
    const field = (label: string, value: string): void => {
      c.add(this.add.text(x, y, label, { fontSize: "12px", color: "#ffd86a", fontStyle: "bold" }));
      const t = this.add.text(x + labelW, y, value, {
        fontSize: "12px",
        color: "#dfe7f2",
        wordWrap: { width: PW - pad * 2 - labelW },
      });
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
    if (tower.active) {
      const a = towerActiveInfo(tower.active);
      rows.push({
        key: skillTex(tower.active),
        name: a.name,
        desc: a.description,
        tag: "Active",
        col: "#a8d8ff",
      });
    }
    for (const pid of tower.passives) {
      const p = passiveInfo(pid);
      rows.push({
        key: skillTex(pid),
        name: p.name,
        desc: p.description,
        tag: "Passive",
        col: "#cdd6e6",
      });
    }

    const S = 34,
      rowH = 40,
      colW = (PW - pad * 2) / 2;
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
      c.add(
        this.add.text(rx + S + 8, ry + 1, r.name, {
          fontSize: "12px",
          color: "#ffffff",
          fontStyle: "bold",
        }),
      );
      c.add(
        this.add.text(rx + S + 8, ry + 16, r.tag, {
          fontSize: "9px",
          color: r.tag === "Active" ? "#a8d8ff" : "#8fa0b4",
        }),
      );
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
    damage: "Damage",
    splash: "Splash",
    chain: "Chain",
    dot: "Damage-over-time",
    debuff: "Debuff",
    support: "Support",
  };
  return map[role] ?? role;
}
