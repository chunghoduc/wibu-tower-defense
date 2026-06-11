// src/scenes/itemEnhanceDialog.ts
//
// The MU-style item enhancement modal (T13). Shows the item's per-stat before →
// after for the next +level, the jewel cost / success chance, and an Enhance
// button. Re-renders in place after each attempt. Extracted from HeroScene so the
// scene stays focused (and under the file-size limit); renders into a caller-owned
// container, mirroring renderItemTooltip / renderCompareDialog.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { MATERIALS_MAP } from "../data/materials.ts";
import { enhanceChance, jewelForLevel, MAX_ENHANCE } from "../core/enhance.ts";
import { enhancePreviewRows } from "../data/itemDisplay.ts";
import { instanceReqLevel } from "../data/items.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { addGatedButton } from "./gatedButton.ts";
import type { SaveManager } from "../core/saveManager.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};

export interface EnhanceCallbacks {
  onChange: () => void;   // an enhance attempt landed — refresh the inventory
  onToast: (msg: string) => void;
  onClose: () => void;
  onEquip?: () => void;   // bag item with a free slot — show an Equip button
}

/** Render the enhance modal for `instanceId` into `dialog` and make it visible. */
export function renderEnhanceDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  mgr: SaveManager,
  instanceId: string,
  cb: EnhanceCallbacks,
): void {
  const save = mgr.getSave();
  const inst = save.inventory.items.find((it) => it.id === instanceId);
  const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
  if (!inst || !def) return;
  dialog.removeAll(true);

  const numStats = Object.values(inst.rolledStats).filter((v) => typeof v === "number").length;
  const ROW_H = 20, STATS_TOP = 44;
  const W = 360, dx = (scene.scale.width - W) / 2;
  // Height grows with the stat list so every stat's before/after is visible.
  const H = STATS_TOP + Math.max(1, numStats) * ROW_H + 96;
  const dy = Math.max(80, (scene.scale.height - H) / 2 - 20);
  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  const scrim = scene.add.zone(0, 0, scene.scale.width, scene.scale.height).setOrigin(0).setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g); dialog.add(scrim);

  const render = () => {
    // remove all but scrim+bg (first two)
    while (dialog.length > 2) dialog.removeAt(2, true);
    const cur = inst.enhanceLevel ?? 0;
    const jewel = jewelForLevel(cur);
    const have = save.materials[jewel] ?? 0;
    const chance = enhanceChance(cur);
    const maxed = cur >= MAX_ENHANCE;
    const next = Math.min(MAX_ENHANCE, cur + 1);
    const add = (xx: number, yy: number, txt: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
      dialog.add(crispText(scene, dx + xx, dy + yy, txt, { fontSize: "13px", color: "#dfe8f3", ...style }));
    add(16, 14, `${def.name}  +${cur}${maxed ? "" : `  →  +${next}`}`,
      { fontSize: "16px", color: RARITY_HEX[def.rarity], fontStyle: "bold" });

    // Per-stat before → after (no multiplier shown). Only base stats scale.
    const rows = enhancePreviewRows(inst, def, cur, next);
    rows.forEach((row, i) => {
      const ry = STATS_TOP + i * ROW_H;
      add(20, ry, row.label, { fontSize: "12px", color: "#9fb2c8" });
      add(150, ry, row.before, { fontSize: "13px", color: "#dfe8f3" });
      add(220, ry, "→", { fontSize: "12px", color: "#7e8ea3" });
      add(244, ry, row.after, { fontSize: "13px", color: maxed ? "#dfe8f3" : "#6ee06e", fontStyle: "bold" });
    });
    if (rows.length === 0) add(20, STATS_TOP, "No scaling stats.", { fontSize: "12px", color: "#9fb2c8" });

    const infoY = STATS_TOP + Math.max(1, rows.length) * ROW_H + 6;
    add(16, infoY, maxed ? "Maxed (+15)." : `Needs: ${MATERIALS_MAP.get(jewel)?.name} (you have ${have})`);
    add(16, infoY + 24, maxed ? "" : `Success: ${Math.round(chance * 100)}%${cur >= 6 ? "  ·  on failure the item loses 1–5 levels" : ""}`,
      { fontSize: "11px", color: cur >= 6 ? "#ffb38a" : "#a5d6a7" });

    // With a free slot the bag item can be equipped outright — Equip sits to the
    // left, Enhance to the right; otherwise Enhance is centered as before.
    const canDo = !maxed && have > 0;
    const enhX = cb.onEquip ? W * 0.66 : W / 2;
    const btn = crispText(scene, dx + enhX, dy + H - 50, maxed ? "MAX" : (canDo ? "⚒  Enhance" : "Need jewel"), {
      fontSize: "15px", color: "#fff", backgroundColor: canDo ? "#1565c0" : "#444",
    }).setOrigin(0.5, 0).setPadding(16, 8, 16, 8).setAlpha(canDo ? 1 : 0.6);
    if (canDo) {
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", () => {
        const r = mgr.enhanceItem(instanceId);
        if (r.ok) {
          cb.onToast(r.success ? `Success! +${r.to}` : `Failed… dropped to +${r.to}`);
          render(); cb.onChange();
        }
      });
    }
    dialog.add(btn);
    if (cb.onEquip) {
      addGatedButton(scene, dialog, {
        x: dx + W * 0.34, y: dy + H - 50, label: "✓  Equip", bg: "#2e7d32",
        gate: equipLevelGate(save.hero.level, instanceReqLevel(inst, def)),
        onClick: cb.onEquip,
      });
    }
    const close = crispText(scene, dx + W - 14, dy + 10, "✕", { fontSize: "16px", color: "#ef9a9a" })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on("pointerup", cb.onClose);
    dialog.add(close);
  };
  render();
  dialog.setVisible(true);
}
