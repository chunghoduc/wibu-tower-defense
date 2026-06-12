/**
 * Auto-recycle dialog — pick rarities (Common/Magic/Rare) and bulk-smelt every
 * non-equipped item of those rarities at once. The caller owns the actual smelt
 * (confirm) and the live count/chaos source (preview); this module owns only the
 * toggle UI + preview rendering. Visual language mirrors ShopScene.openRecycle.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { AUTO_SMELT_RARITIES, type BulkSmeltPreview } from "../core/smelt.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e,
  Magic: 0x2196f3,
  Rare: 0x9c27b0,
  Legendary: 0xff9800,
  Unique: 0xf44336,
};
const CHAOS_COL = 0xe0457a;

export interface AutoRecycleOpts {
  preview(rarities: Rarity[]): BulkSmeltPreview;
  confirm(rarities: Rarity[]): void; // performs the smelt + redraw/flash, then dialog closes
  onClose(): void;
}

export function openAutoRecycleDialog(
  scene: Phaser.Scene,
  opts: AutoRecycleOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width,
    H = scene.scale.height;
  // Default: Common + Magic on, Rare off (Rare is reforge fuel — opt-in only).
  const selected = new Set<Rarity>(["Common", "Magic"]);

  const c = scene.add.container(0, 0).setDepth(300);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.74).fillRect(0, 0, W, H);
  const dimZone = scene.add
    .zone(W / 2, H / 2, W, H)
    .setInteractive()
    .on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  const bw = 384,
    bh = 248,
    bx = (W - bw) / 2,
    by = (H - bh) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(0x141c28, 0.99).fillRoundedRect(bx, by, bw, bh, 10);
  panel.lineStyle(2, CHAOS_COL, 1).strokeRoundedRect(bx, by, bw, bh, 10);
  const panelZone = scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive(); // swallow clicks
  c.add([panel, panelZone]);

  c.add(
    crispText(scene, W / 2, by + 16, "Auto Recycle", {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );
  c.add(
    crispText(scene, W / 2, by + 40, "Pick rarities, then smelt them all", {
      fontSize: "11px",
      color: "#9fb0c4",
      align: "center",
    }).setOrigin(0.5, 0),
  );

  // Live preview line; re-rendered on every toggle.
  const previewText = crispText(scene, W / 2, by + 128, "", {
    fontSize: "13px",
    color: "#ffd6a0",
    align: "center",
  }).setOrigin(0.5, 0);
  c.add(previewText);

  const chipObjs: { r: Rarity; bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] =
    [];
  const chipW = 96,
    chipH = 34,
    gap = 14;
  const totalW = AUTO_SMELT_RARITIES.length * chipW + (AUTO_SMELT_RARITIES.length - 1) * gap;
  let cx = (W - totalW) / 2;
  const chipY = by + 70;
  let smeltBtn!: Phaser.GameObjects.Text;

  function render(): void {
    for (const ch of chipObjs) {
      const on = selected.has(ch.r);
      const col = RARITY_INT[ch.r];
      ch.bg.clear();
      ch.bg.fillStyle(on ? col : 0x202a38, on ? 0.85 : 1).fillRoundedRect(0, 0, chipW, chipH, 6);
      ch.bg.lineStyle(2, col, 1).strokeRoundedRect(0, 0, chipW, chipH, 6);
      ch.label.setColor(on ? "#101010" : "#cdd6e4").setFontStyle(on ? "bold" : "normal");
    }
    const p = opts.preview([...selected]);
    previewText.setText(`Smelt ${p.count} item${p.count === 1 ? "" : "s"}  →  ❖ ${p.chaos} Chaos`);
    const enabled = p.count > 0;
    smeltBtn
      .setColor(enabled ? "#fff" : "#7a8494")
      .setBackgroundColor(enabled ? "#7a3a5a" : "#2a3142");
  }

  for (const r of AUTO_SMELT_RARITIES) {
    const bg = scene.add.graphics();
    bg.setPosition(cx, chipY);
    const label = crispText(scene, cx + chipW / 2, chipY + chipH / 2, r, {
      fontSize: "12px",
    }).setOrigin(0.5);
    const z = scene.add
      .zone(cx, chipY, chipW, chipH)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (selected.has(r)) selected.delete(r);
      else selected.add(r);
      render();
    });
    c.add([bg, label, z]);
    chipObjs.push({ r, bg, label });
    cx += chipW + gap;
  }

  smeltBtn = crispText(scene, W / 2, by + 162, "🔨 Smelt All", {
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#7a3a5a",
    fixedWidth: bw - 72,
    align: "center",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 9, 0, 9)
    .setInteractive({ useHandCursor: true });
  smeltBtn.on("pointerup", () => {
    const sel = [...selected];
    if (opts.preview(sel).count <= 0) return; // disabled state — inert
    opts.confirm(sel);
  });
  c.add(smeltBtn);

  const cancel = crispText(scene, W / 2, by + bh - 28, "Cancel", {
    fontSize: "13px",
    color: "#cdd6e4",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  cancel.on("pointerup", () => opts.onClose());
  c.add(cancel);

  render();
  return c;
}
