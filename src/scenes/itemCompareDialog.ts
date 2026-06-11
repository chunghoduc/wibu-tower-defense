// src/scenes/itemCompareDialog.ts
//
// The inventory "compare & replace" modal. When a player taps a bag item whose
// equip slot is already full, this lays the bag item against the one it would
// replace: every stat/affix row shows the CURRENTLY EQUIPPED value plus the delta
// the swap would apply (green = upgrade, red = downgrade). A Replace button does
// the swap; Enhance opens the existing enhance flow; tapping the scrim closes.
//
// Renders into a caller-owned container (HeroScene.dialog) so the scene keeps
// ownership of visibility/lifecycle — mirrors renderItemTooltip's contract.
import Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { compareItems, type ItemRef, type CompareRow } from "../data/itemCompare.ts";
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

const W = 348;
const ROW_H = 19;
const HEADER_H = 66;
const SECTION_H = 22;
const FOOTER_H = 60;

/** Render the compare-and-replace modal into `dialog` and make it visible. */
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  equipped: ItemRef,
  slot: ItemSlot,
  cb: CompareCallbacks,
): void {
  dialog.removeAll(true);
  const { stats, affixes } = compareItems(bag, equipped);

  // Body height = stats block (+ its header) plus the affix block when present.
  let bodyRows = SECTION_H + Math.max(1, stats.length) * ROW_H;
  if (affixes.length) bodyRows += SECTION_H + affixes.length * ROW_H;
  const H = HEADER_H + bodyRows + FOOTER_H;
  const dx = (scene.scale.width - W) / 2;
  const dy = Math.max(40, (scene.scale.height - H) / 2 - 10);

  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[bag.def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  const scrim = scene.add.zone(0, 0, scene.scale.width, scene.scale.height).setOrigin(0).setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g);
  dialog.add(scrim);

  const txt = (xx: number, yy: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) => {
    const t = crispText(scene, dx + xx, dy + yy, s, { fontSize: "12px", color: "#dfe8f3", ...style });
    dialog.add(t);
    return t;
  };

  // Header: the bag item we're considering, then the equipped item it replaces.
  const enh = (r: ItemRef) => (r.inst.enhanceLevel ? ` +${r.inst.enhanceLevel}` : "");
  txt(14, 10, `Equip: ${bag.def.name}${enh(bag)}`,
    { fontSize: "14px", color: RARITY_HEX[bag.def.rarity], fontStyle: "bold" });
  txt(14, 31, `Replaces ${SLOT_LABEL[slot]}: ${equipped.def.name}${enh(equipped)}`,
    { fontSize: "11px", color: RARITY_HEX[equipped.def.rarity] });
  // Sub-legend: each row reads "<equipped value>  (<change if you swap>)".
  txt(14, 48, "stat", { fontSize: "9px", color: "#7e8ea3" });
  txt(W - 16, 48, "now   (change)", { fontSize: "9px", color: "#7e8ea3" }).setOrigin(1, 0);
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(dx + 12, dy + HEADER_H - 6, dx + W - 12, dy + HEADER_H - 6);

  let y = HEADER_H;
  const section = (title: string) => { txt(14, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" }); y += SECTION_H; };
  const rowLine = (r: CompareRow) => {
    txt(20, y, r.label, { fontSize: "12px", color: "#cdd9ea" });
    txt(W - 96, y, r.equipped, { fontSize: "12px", color: "#dfe8f3" }).setOrigin(1, 0);
    txt(W - 16, y, `(${r.delta})`, { fontSize: "12px", color: DELTA_COLOR[String(r.dir) as "0"], fontStyle: "bold" }).setOrigin(1, 0);
    y += ROW_H;
  };

  section("Stats");
  if (stats.length) stats.forEach(rowLine);
  else { txt(20, y, "No base stats.", { fontSize: "11px", color: "#7c8aa0" }); y += ROW_H; }

  if (affixes.length) { section("Affixes"); affixes.forEach(rowLine); }

  // Footer buttons: Replace (primary) + Enhance, with a corner close.
  const btnY = dy + H - 44;
  const replace = crispText(scene, dx + W * 0.34, btnY, "⇄  Replace", {
    fontSize: "14px", color: "#fff", backgroundColor: "#1565c0",
  }).setOrigin(0.5, 0).setPadding(16, 8, 16, 8).setInteractive({ useHandCursor: true });
  replace.on("pointerup", cb.onReplace);
  dialog.add(replace);

  const enhance = crispText(scene, dx + W * 0.74, btnY, "⚒  Enhance", {
    fontSize: "13px", color: "#dfe8f3", backgroundColor: "#26344a",
  }).setOrigin(0.5, 0).setPadding(14, 8, 14, 8).setInteractive({ useHandCursor: true });
  enhance.on("pointerup", cb.onEnhance);
  dialog.add(enhance);

  const close = crispText(scene, dx + W - 14, dy + 8, "✕", { fontSize: "16px", color: "#ef9a9a" })
    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
  close.on("pointerup", cb.onClose);
  dialog.add(close);

  // panelText keeps a faint sub-legend crisp at small size without a heavy stroke.
  dialog.add(panelText(scene, dx + 14, dy + H - FOOTER_H + 4,
    "Green = upgrade · Red = downgrade", { fontSize: "9px", color: "#6c7c93" }));

  dialog.setVisible(true);
}
