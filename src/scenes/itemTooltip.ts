// src/scenes/itemTooltip.ts
//
// Shared item-stat tooltip used by the Inventory (HeroScene) and the Shop. Given
// a target container, it clears it and renders a rarity-bordered card: name +
// rarity/slot/enhance header, colour-coded stat rows (source: white base / blue
// primary affix / purple extra affix; quality: green better / red worse) grouped
// under Base / Primary / Extra section headers, and a required-level footer.
import Phaser from "phaser";
import { panelText } from "./ui.ts";
import { itemStatRows, SOURCE_COLOR, QUALITY_COLOR } from "../data/itemDisplay.ts";
import { archetypeFor, ARCHETYPE_COLOR, ARCHETYPE_LABEL } from "../data/itemArchetype.ts";
import type { ItemDef, Rarity } from "../data/schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc", Magic: "#5fa8ff", Rare: "#c98bff", Legendary: "#ffb74d", Unique: "#ff7a7a",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};

/** Render the item's full stat tooltip into `c` near (x, y) and show it. */
export function renderItemTooltip(
  scene: Phaser.Scene, c: Phaser.GameObjects.Container,
  inst: ItemInstanceSave, def: ItemDef, x: number, y: number,
  heroLevel?: number,
): void {
  c.removeAll(true);
  const rows = itemStatRows(inst, def);

  // Group the rows into Base / Primary / Extra sections (the row's `source`); each
  // non-empty group gets a colour-coded header. Replaces the old flat list whose
  // sources were only distinguishable via a bottom legend.
  const SECTIONS = [
    { key: "base", label: "Base" },
    { key: "primary", label: "Primary" },
    { key: "affix", label: "Extra" },
  ] as const;
  const groups = SECTIONS
    .map((s) => ({ ...s, rows: rows.filter((r) => r.source === s.key) }))
    .filter((grp) => grp.rows.length > 0);

  // Vertical rhythm: each value below is the rendered line height (font + stroke),
  // not the bare font size — small fonts with an outline render noticeably taller,
  // so undersized row heights used to make every line overlap the next.
  const w = 250, padX = 10, indent = 12, headerH = 46, rowH = 17, sectionH = 16;
  const footerH = inst.apex ? 42 : 24;
  const bodyH = groups.reduce((sum, grp) => sum + sectionH + grp.rows.length * rowH, 0);
  const h = headerH + bodyH + footerH;
  const tx = Phaser.Math.Clamp(x + 30, 0, scene.scale.width - w);
  const ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
  const g = scene.add.graphics();
  g.fillStyle(0x10141c, 0.98).fillRoundedRect(tx, ty, w, h, 7);
  g.lineStyle(2, RARITY_INT[def.rarity], 1).strokeRoundedRect(tx, ty, w, h, 7);
  // Header divider so the name block reads apart from the stats.
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(tx + padX, ty + headerH - 5, tx + w - padX, ty + headerH - 5);
  c.add(g);

  // Header: name (rarity colour) + rarity/slot/enhance line.
  const enh = inst.enhanceLevel ? `  +${inst.enhanceLevel}` : "";
  c.add(panelText(scene, tx + padX, ty + 8, def.name, { fontSize: "14px", color: RARITY_HEX[def.rarity], fontStyle: "bold", wordWrap: { width: w - padX * 2 } }));
  c.add(panelText(scene, tx + padX, ty + 27, `${def.rarity} ${def.slot}${def.weaponType ? ` (${def.weaponType})` : ""}${enh}`, { fontSize: "11px", color: "#aebfd4" }));
  // Build-archetype tag (right of the rarity/slot line) — makes the item's build
  // identity (physical / magic / defense / utility) legible at a glance.
  const arch = archetypeFor(def);
  c.add(panelText(scene, tx + w - padX, ty + 27, ARCHETYPE_LABEL[arch], { fontSize: "11px", color: ARCHETYPE_COLOR[arch], fontStyle: "bold" }).setOrigin(1, 0));

  // Sections. Each group gets a colour-coded header; its rows render indented
  // beneath it. Source colour marks where a stat comes from; value colour marks
  // roll quality. Base stats: label + right-aligned value (+ enhance bonus).
  // Affixes: a full sentence with the value tinted inline.
  let ry = ty + headerH;
  for (const grp of groups) {
    c.add(panelText(scene, tx + padX, ry, grp.label, { fontSize: "10px", color: SOURCE_COLOR[grp.key], fontStyle: "bold" }));
    ry += sectionH;
    const lx = tx + padX + indent;
    for (const r of grp.rows) {
      const vstyle = { fontSize: "11px", color: QUALITY_COLOR[r.quality], fontStyle: "bold" };
      if (r.source === "base") {
        c.add(panelText(scene, lx, ry, r.before, { fontSize: "11px", color: SOURCE_COLOR.base }));
        if (r.bonus) {
          const bt = panelText(scene, tx + w - padX, ry, r.bonus, { fontSize: "11px", color: "#7fdfff", fontStyle: "bold" }).setOrigin(1, 0);
          c.add(bt);
          c.add(panelText(scene, tx + w - padX - 4 - bt.width, ry, r.value, vstyle).setOrigin(1, 0));
        } else {
          c.add(panelText(scene, tx + w - padX, ry, r.value, vstyle).setOrigin(1, 0));
        }
      } else {
        const sc = { fontSize: "11px", color: SOURCE_COLOR[r.source] };
        let cx = lx;
        const b = panelText(scene, cx, ry, r.before, sc); c.add(b); cx += b.width;
        const v = panelText(scene, cx, ry, r.value, vstyle); c.add(v); cx += v.width;
        c.add(panelText(scene, cx, ry, r.after, sc));
      }
      ry += rowH;
    }
  }

  // Footer: required level (the grouped section headers above now serve as the
  // source-colour legend), separated by a divider.
  const fy = ry + 6;
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(tx + padX, fy - 4, tx + w - padX, fy - 4);
  const reqLv = inst.requiredLevel ?? def.requiredLevel;
  // Red when the hero can't yet equip it; apex gold / muted grey otherwise.
  const tooHigh = heroLevel !== undefined && heroLevel < reqLv;
  const reqColor = tooHigh ? "#ff5a5a" : inst.apex ? "#ffd24a" : "#8a99af";
  c.add(panelText(scene, tx + w - padX, fy, `Req.Lv ${reqLv}`, { fontSize: "10px", color: reqColor, fontStyle: tooHigh ? "bold" : "normal" }).setOrigin(1, 0));
  if (inst.apex) {
    c.add(panelText(scene, tx + padX, fy + 15, "✦ APEX  +25% stats", { fontSize: "10px", color: "#ffd24a", fontStyle: "bold" }));
  }
  c.setVisible(true);
}
