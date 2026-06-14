// src/scenes/itemCompareDialog.ts
//
// The inventory "compare & replace" modal. When a player taps a bag item whose
// equip slot(s) are already full, this lays the SELECTED (bag) item out on the
// left and ONE column per equipped item it could replace to its right. Each
// equipped column shows the same stat at the same row height as the others and
// carries the swap delta in a bracket (green = upgrade, red = downgrade), plus
// its OWN gated Replace button. A ring with both slots full therefore shows two
// equipped columns, two Replace buttons. The Enhance button sits under the
// SELECTED card; tapping the scrim closes.
//
// Renders into a caller-owned container (HeroScene.dialog) so the scene keeps
// ownership of visibility/lifecycle — mirrors renderItemTooltip's contract.
import type Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { compareItems, type ItemRef, type CompareRow } from "../data/itemCompare.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addGatedButton } from "./gatedButton.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { instanceReqLevel } from "../data/items.ts";
import type { Rarity, ItemSlot } from "../data/schema.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc",
  Magic: "#5fa8ff",
  Rare: "#c98bff",
  Legendary: "#ffb74d",
  Unique: "#ff7a7a",
};
const DELTA_COLOR = { "1": "#6ee06e", "-1": "#ff7a7a", "0": "#8aa0bb" } as const;

const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  BodyArmor: "Body",
  Gloves: "Gloves",
  Boots: "Boots",
  Amulet: "Amulet",
  Ring1: "Ring",
  Ring2: "Ring",
  Pet: "Pet",
  Wing: "Wing",
};

/** One equipped item the bag item could replace, with the swap wired in. */
export interface CompareTarget {
  ref: ItemRef; // the equipped item in this slot
  slot: ItemSlot; // Ring1 / Ring2 / Weapon / …
  onReplace: () => void; // swap THIS slot for the bag item
}

export interface CompareCallbacks {
  onEnhance: () => void; // open the enhance dialog for the bag item
  onClose: () => void; // dismiss the modal
}

const COL_W = 188; // per-item column width
const COL_GAP = 14;
const PAD = 14;
const ROW_H = 19;
const HEADER_H = 74; // icon + name + section divider
const SECTION_H = 22;
const FOOTER_H = 64;

type Comparison = ReturnType<typeof compareItems>;

/** Render the compare-and-replace modal into `dialog` and make it visible. */
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  targets: CompareTarget[],
  heroLevel: number,
  cb: CompareCallbacks,
): void {
  dialog.removeAll(true);

  // Per-target comparisons, then the union of row labels so every column lines
  // up row-for-row. compareItems stays the per-pair source of truth.
  const cmps = targets.map((t) => compareItems(bag, t.ref));
  const statLabels = unionLabels(cmps.map((c) => c.stats));
  const affixLabels = unionLabels(cmps.map((c) => c.affixes));

  // Body height = stats block (+ header) plus the affix block when present.
  let bodyRows = SECTION_H + Math.max(1, statLabels.length) * ROW_H;
  if (affixLabels.length) bodyRows += SECTION_H + affixLabels.length * ROW_H;
  const H = HEADER_H + bodyRows + FOOTER_H;

  const cols = targets.length + 1; // SELECTED + one per target
  const W = PAD * 2 + cols * COL_W + (cols - 1) * COL_GAP;
  const dx = (scene.scale.width - W) / 2;
  const dy = Math.max(20, (scene.scale.height - H) / 2 - 6);

  // x origin (relative to dx) of column i: 0 = SELECTED, 1.. = targets.
  const colX = (i: number) => PAD + i * (COL_W + COL_GAP);

  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[bag.def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  for (let i = 1; i < cols; i++) {
    const mid = colX(i) - COL_GAP / 2;
    g.lineStyle(1, 0x2a3650, 0.8).lineBetween(dx + mid, dy + 10, dx + mid, dy + H - FOOTER_H + 2);
  }
  const scrim = scene.add
    .zone(0, 0, scene.scale.width, scene.scale.height)
    .setOrigin(0)
    .setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g);
  dialog.add(scrim);

  const txt = (
    xx: number,
    yy: number,
    s: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) => {
    const t = crispText(scene, dx + xx, dy + yy, s, {
      fontSize: "12px",
      color: "#dfe8f3",
      ...style,
    });
    dialog.add(t);
    return t;
  };
  const enh = (r: ItemRef) => (r.inst.enhanceLevel ? ` +${r.inst.enhanceLevel}` : "");

  // Column header: icon + role tag + item name in its rarity colour.
  const header = (originX: number, tag: string, ref: ItemRef) => {
    const icon = makeFitIcon(scene, dx + originX + 16, dy + 26, itemTex(ref.def.id), 30, "❔");
    dialog.add(icon);
    txt(originX + 36, 10, tag, { fontSize: "9px", color: "#7e8ea3" });
    txt(originX + 36, 22, `${ref.def.name}${enh(ref)}`, {
      fontSize: "12px",
      color: RARITY_HEX[ref.def.rarity],
      fontStyle: "bold",
      wordWrap: { width: COL_W - 40 },
    });
  };
  header(colX(0), "SELECTED", bag);
  targets.forEach((t, i) => header(colX(i + 1), `EQUIPPED · ${SLOT_LABEL[t.slot]}`, t.ref));
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(
    dx + PAD,
    dy + HEADER_H - 6,
    dx + W - PAD,
    dy + HEADER_H - 6,
  );

  // Rows: same label at the same y across all columns.
  let y = HEADER_H;
  const section = (title: string) => {
    for (let i = 0; i < cols; i++) {
      txt(colX(i) + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    }
    y += SECTION_H;
  };
  const rowAt = (rows: CompareRow[], label: string) => rows.find((r) => r.label === label);
  // SELECTED cell: bag's own value, plain. Equipped cell: equipped value + delta.
  const renderRow = (label: string, pick: (c: Comparison) => CompareRow[]) => {
    // SELECTED column — the bag value (same across pairs); fall back to "—".
    const sample = cmps
      .map(pick)
      .map((rows) => rowAt(rows, label))
      .find(Boolean);
    txt(colX(0) + 6, y, label, { fontSize: "12px", color: "#cdd9ea" });
    txt(colX(0) + COL_W - 6, y, sample?.bag ?? "—", {
      fontSize: "12px",
      color: "#dfe8f3",
    }).setOrigin(1, 0);
    // One equipped column per target.
    targets.forEach((_t, i) => {
      const r = rowAt(pick(cmps[i]), label);
      const ox = colX(i + 1);
      txt(ox + 6, y, label, { fontSize: "12px", color: "#cdd9ea" });
      txt(ox + COL_W - 52, y, r?.equipped ?? "—", {
        fontSize: "12px",
        color: "#dfe8f3",
      }).setOrigin(1, 0);
      if (r) {
        txt(ox + COL_W - 2, y, `(${r.delta})`, {
          fontSize: "11px",
          color: DELTA_COLOR[String(r.dir) as "0"],
          fontStyle: "bold",
        }).setOrigin(1, 0);
      }
    });
    y += ROW_H;
  };

  section("Stats");
  if (statLabels.length) statLabels.forEach((l) => renderRow(l, (c) => c.stats));
  else {
    txt(colX(0) + 6, y, "No base stats.", { fontSize: "11px", color: "#7c8aa0" });
    y += ROW_H;
  }
  if (affixLabels.length) {
    section("Affixes");
    affixLabels.forEach((l) => renderRow(l, (c) => c.affixes));
  }

  // Footer: Enhance under SELECTED; one gated Replace under each target column.
  const btnY = dy + H - 46;
  const enhance = crispText(scene, dx + colX(0) + COL_W / 2, btnY, "⚒  Enhance", {
    fontSize: "14px",
    color: "#dfe8f3",
    backgroundColor: "#26344a",
  })
    .setOrigin(0.5, 0)
    .setPadding(14, 8, 14, 8)
    .setInteractive({ useHandCursor: true });
  enhance.on("pointerup", cb.onEnhance);
  dialog.add(enhance);

  const gate = equipLevelGate(heroLevel, instanceReqLevel(bag.inst, bag.def));
  targets.forEach((t, i) => {
    addGatedButton(scene, dialog, {
      x: dx + colX(i + 1) + COL_W / 2,
      y: btnY,
      label: "⇄  Replace",
      bg: "#1565c0",
      gate,
      onClick: t.onReplace,
    });
  });

  const close = crispText(scene, dx + W - 14, dy + 8, "✕", { fontSize: "16px", color: "#ef9a9a" })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", cb.onClose);
  dialog.add(close);

  dialog.add(
    panelText(scene, dx + PAD, dy + H - 16, "Bracket = change vs equipped · Green up · Red down", {
      fontSize: "9px",
      color: "#6c7c93",
    }),
  );

  dialog.setVisible(true);
}

/** Ordered union of row labels across several comparison row-lists. */
function unionLabels(lists: CompareRow[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rows of lists) {
    for (const r of rows) {
      if (!seen.has(r.label)) {
        seen.add(r.label);
        out.push(r.label);
      }
    }
  }
  return out;
}
