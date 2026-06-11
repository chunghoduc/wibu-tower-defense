// src/scenes/itemCompareDialog.ts
//
// The inventory "compare & replace" modal. When a player taps a bag item whose
// equip slot is already full, this lays the two items out as cards SIDE BY SIDE:
// the SELECTED (bag) item on the left, the EQUIPPED item it would replace on the
// right. Each row shows the same stat at the same height in both columns; the LEFT
// card carries the swap delta in a bracket (green = upgrade, red = downgrade). The
// Enhance button sits under the left (selected) card, Replace under the right
// (equipped) card; tapping the scrim closes.
//
// Renders into a caller-owned container (HeroScene.dialog) so the scene keeps
// ownership of visibility/lifecycle — mirrors renderItemTooltip's contract.
import Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { compareItems, type ItemRef, type CompareRow } from "../data/itemCompare.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addGatedButton } from "./gatedButton.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { instanceReqLevel } from "../data/items.ts";
import type { Rarity, ItemSlot } from "../data/schema.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc", Magic: "#5fa8ff", Rare: "#c98bff", Legendary: "#ffb74d", Unique: "#ff7a7a",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const DELTA_COLOR = { "1": "#6ee06e", "-1": "#ff7a7a", "0": "#8aa0bb" } as const;

const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon", Helmet: "Helmet", BodyArmor: "Body", Gloves: "Gloves", Boots: "Boots",
  Amulet: "Amulet", Ring1: "Ring", Ring2: "Ring", Pet: "Pet", Wing: "Wing",
};

export interface CompareCallbacks {
  onReplace: () => void;   // swap the equipped item for the bag item
  onEnhance: () => void;   // open the enhance dialog for the bag item
  onClose: () => void;     // dismiss the modal
}

const W = 430;             // wider: two columns on the 960-wide stage
const COL_GAP = 14;
const PAD = 14;
const ROW_H = 19;
const HEADER_H = 74;       // icon + name + section divider
const SECTION_H = 22;
const FOOTER_H = 64;

/** Render the compare-and-replace modal into `dialog` and make it visible. */
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  equipped: ItemRef,
  slot: ItemSlot,
  heroLevel: number,
  cb: CompareCallbacks,
): void {
  dialog.removeAll(true);
  const { stats, affixes } = compareItems(bag, equipped);

  // Body height = stats block (+ its header) plus the affix block when present.
  let bodyRows = SECTION_H + Math.max(1, stats.length) * ROW_H;
  if (affixes.length) bodyRows += SECTION_H + affixes.length * ROW_H;
  const H = HEADER_H + bodyRows + FOOTER_H;
  const dx = (scene.scale.width - W) / 2;
  const dy = Math.max(20, (scene.scale.height - H) / 2 - 6);

  // Column geometry (x offsets relative to dx).
  const colW = (W - PAD * 2 - COL_GAP) / 2;
  const leftX = PAD;                       // left (selected) card origin
  const rightX = PAD + colW + COL_GAP;     // right (equipped) card origin
  const midX = PAD + colW + COL_GAP / 2;   // divider between the cards

  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[bag.def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(1, 0x2a3650, 0.8).lineBetween(dx + midX, dy + 10, dx + midX, dy + H - FOOTER_H + 2);
  const scrim = scene.add.zone(0, 0, scene.scale.width, scene.scale.height).setOrigin(0).setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g);
  dialog.add(scrim);

  const txt = (xx: number, yy: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) => {
    const t = crispText(scene, dx + xx, dy + yy, s, { fontSize: "12px", color: "#dfe8f3", ...style });
    dialog.add(t);
    return t;
  };
  const enh = (r: ItemRef) => (r.inst.enhanceLevel ? ` +${r.inst.enhanceLevel}` : "");

  // Column header: icon + role tag + item name in its rarity colour.
  const header = (originX: number, tag: string, ref: ItemRef) => {
    const icon = makeFitIcon(scene, dx + originX + 16, dy + 26, `item__${ref.def.id}`, 30, "❔");
    dialog.add(icon);
    txt(originX + 36, 10, tag, { fontSize: "9px", color: "#7e8ea3" });
    txt(originX + 36, 22, `${ref.def.name}${enh(ref)}`,
      { fontSize: "12px", color: RARITY_HEX[ref.def.rarity], fontStyle: "bold",
        wordWrap: { width: colW - 40 } });
  };
  header(leftX, "SELECTED", bag);
  header(rightX, `EQUIPPED · ${SLOT_LABEL[slot]}`, equipped);
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(dx + PAD, dy + HEADER_H - 6, dx + W - PAD, dy + HEADER_H - 6);

  // Rows: same stat at the same y in both columns (union of both items' keys).
  let y = HEADER_H;
  const section = (title: string) => {
    txt(leftX + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    txt(rightX + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    y += SECTION_H;
  };
  const rowLine = (r: CompareRow) => {
    // left (selected) card: label … bag value (delta bracket)
    txt(leftX + 6, y, r.label, { fontSize: "12px", color: "#cdd9ea" });
    txt(leftX + colW - 52, y, r.bag, { fontSize: "12px", color: "#dfe8f3" }).setOrigin(1, 0);
    txt(leftX + colW - 2, y, `(${r.delta})`,
      { fontSize: "11px", color: DELTA_COLOR[String(r.dir) as "0"], fontStyle: "bold" }).setOrigin(1, 0);
    // right (equipped) card: label … equipped value
    txt(rightX + 6, y, r.label, { fontSize: "12px", color: "#cdd9ea" });
    txt(rightX + colW - 2, y, r.equipped, { fontSize: "12px", color: "#dfe8f3" }).setOrigin(1, 0);
    y += ROW_H;
  };

  section("Stats");
  if (stats.length) stats.forEach(rowLine);
  else { txt(leftX + 6, y, "No base stats.", { fontSize: "11px", color: "#7c8aa0" }); y += ROW_H; }

  if (affixes.length) { section("Affixes"); affixes.forEach(rowLine); }

  // Footer: Enhance under the left (selected) card, Replace under the right (equipped) card.
  const btnY = dy + H - 46;
  const enhance = crispText(scene, dx + leftX + colW / 2, btnY, "⚒  Enhance", {
    fontSize: "14px", color: "#dfe8f3", backgroundColor: "#26344a",
  }).setOrigin(0.5, 0).setPadding(14, 8, 14, 8).setInteractive({ useHandCursor: true });
  enhance.on("pointerup", cb.onEnhance);
  dialog.add(enhance);

  addGatedButton(scene, dialog, {
    x: dx + rightX + colW / 2, y: btnY, label: "⇄  Replace", bg: "#1565c0",
    gate: equipLevelGate(heroLevel, instanceReqLevel(bag.inst, bag.def)),
    onClick: cb.onReplace,
  });

  const close = crispText(scene, dx + W - 14, dy + 8, "✕", { fontSize: "16px", color: "#ef9a9a" })
    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
  close.on("pointerup", cb.onClose);
  dialog.add(close);

  // panelText keeps a faint legend crisp at small size without a heavy stroke.
  dialog.add(panelText(scene, dx + PAD, dy + H - 16,
    "Bracket = change vs equipped · Green up · Red down", { fontSize: "9px", color: "#6c7c93" }));

  dialog.setVisible(true);
}
