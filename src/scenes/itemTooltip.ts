// src/scenes/itemTooltip.ts
//
// Shared item-stat tooltip used by the Inventory (HeroScene) and the Shop. Given
// a target container, it clears it and renders a rarity-bordered card: name +
// rarity/slot/enhance header, colour-coded stat rows (source: white base / blue
// primary affix / purple extra affix; quality: green better / red worse), and a
// legend + required-level footer.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemStatRows, SOURCE_COLOR, QUALITY_COLOR } from "../data/itemDisplay.ts";
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
): void {
  c.removeAll(true);
  const rows = itemStatRows(inst, def);

  const w = 234, headerH = 36, rowH = 13, footerH = 26;
  const h = headerH + rows.length * rowH + footerH;
  const tx = Phaser.Math.Clamp(x + 30, 0, scene.scale.width - w);
  const ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
  const g = scene.add.graphics();
  g.fillStyle(0x10141c, 0.97).fillRoundedRect(tx, ty, w, h, 6);
  g.lineStyle(1.5, RARITY_INT[def.rarity], 1).strokeRoundedRect(tx, ty, w, h, 6);
  c.add(g);

  // Header: name (rarity colour) + rarity/slot/enhance line.
  const enh = inst.enhanceLevel ? `  +${inst.enhanceLevel}` : "";
  c.add(crispText(scene, tx + 8, ty + 6, def.name, { fontSize: "11px", color: RARITY_HEX[def.rarity], fontStyle: "bold" }));
  c.add(crispText(scene, tx + 8, ty + 21, `${def.rarity} ${def.slot}${def.weaponType ? ` (${def.weaponType})` : ""}${enh}`, { fontSize: "9px", color: "#9fb0c4" }));

  // Stat rows. Source colour marks where the stat comes from; value colour marks
  // roll quality. Base stats: label + right-aligned value (+ enhance bonus).
  // Affixes: a full sentence with the value tinted inline.
  let ry = ty + headerH;
  for (const r of rows) {
    const vstyle = { fontSize: "9px", color: QUALITY_COLOR[r.quality], fontStyle: "bold" };
    if (r.source === "base") {
      c.add(crispText(scene, tx + 10, ry, r.before, { fontSize: "9px", color: SOURCE_COLOR.base }));
      if (r.bonus) {
        const bt = crispText(scene, tx + w - 8, ry, r.bonus, { fontSize: "9px", color: "#7fdfff", fontStyle: "bold" }).setOrigin(1, 0);
        c.add(bt);
        c.add(crispText(scene, tx + w - 10 - bt.width, ry, r.value, vstyle).setOrigin(1, 0));
      } else {
        c.add(crispText(scene, tx + w - 8, ry, r.value, vstyle).setOrigin(1, 0));
      }
    } else {
      const sc = { fontSize: "9px", color: SOURCE_COLOR[r.source] };
      let cx = tx + 10;
      const b = crispText(scene, cx, ry, r.before, sc); c.add(b); cx += b.width;
      const v = crispText(scene, cx, ry, r.value, vstyle); c.add(v); cx += v.width;
      c.add(crispText(scene, cx, ry, r.after, sc));
    }
    ry += rowH;
  }

  // Footer: a small colour legend + required level.
  c.add(crispText(scene, tx + 8, ry + 4, "Stat", { fontSize: "8px", color: SOURCE_COLOR.base }));
  c.add(crispText(scene, tx + 34, ry + 4, "Primary", { fontSize: "8px", color: SOURCE_COLOR.primary }));
  c.add(crispText(scene, tx + 78, ry + 4, "Extra", { fontSize: "8px", color: SOURCE_COLOR.affix }));
  c.add(crispText(scene, tx + w - 8, ry + 4, `Req.Lv ${def.requiredLevel}`, { fontSize: "8px", color: "#7c8aa0" }).setOrigin(1, 0));
  c.setVisible(true);
}
