// src/scenes/rewardPanel.ts
//
// The post-battle reward display: everything looted in a cleared (or lost!)
// run shown as an icon tile — gold, diamonds, gear, jewels, skills, characters,
// loot boxes, materials and hero XP. Hovering a tile reveals its detail:
// equipment uses the full stat tooltip, everything else a titled info card.
// The icons carry the meaning; names live in the hover, per design. The pure
// tile mapping lives in data/rewardTiles.ts.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { renderItemTooltip } from "./itemTooltip.ts";
import { renderInfoTooltip } from "./infoTooltip.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { battleLootTiles, type BattleLootSummary, type RewardTileSpec } from "../data/rewardTiles.ts";

const TILE = 64, GAP = 10, PER_ROW = 6;

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

/**
 * Build the post-battle loot panel at (centerX, topY): a centred, wrapping grid
 * of icon tiles with hover tooltips, shown on win OR loss. Returns the root
 * container (already added to the scene at depth 25). The caller owns its
 * lifetime.
 */
export function showBattleLootPanel(
  scene: Phaser.Scene, summary: BattleLootSummary, centerX: number, topY: number,
): Phaser.GameObjects.Container {
  const specs = battleLootTiles(summary);
  const root = scene.add.container(0, 0).setDepth(25);
  const tooltip = scene.add.container(0, 0).setDepth(120).setVisible(false);

  // The scene already shows a big VICTORY/DEFEAT banner above this; we add only
  // a small caption (first-clear flourish, or an empty-state on a barren loss).
  let gridTop = topY;
  const caption = summary.isFirstClear
    ? "★ First Clear bonus!"
    : specs.length === 0
      ? (summary.outcome === "lost" ? "No loot this run." : "")
      : "";
  if (caption) {
    root.add(crispText(scene, centerX, topY, caption, {
      fontSize: "13px", color: summary.isFirstClear ? "#ffe07a" : "#9fb0c0", fontStyle: "bold", stroke: "#0a1420", strokeThickness: 4,
    }).setOrigin(0.5, 0));
    gridTop = topY + 20;
  }

  specs.forEach((spec, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const rowCount = Math.min(PER_ROW, specs.length - row * PER_ROW);
    const rowW = rowCount * TILE + (rowCount - 1) * GAP;
    const x = centerX - rowW / 2 + col * (TILE + GAP) + TILE / 2;
    const y = gridTop + row * (TILE + 26) + TILE / 2;
    root.add(buildTile(scene, spec, x, y, tooltip));
  });

  // Tooltip drawn last so it layers above every tile.
  root.add(tooltip);
  return root;
}

function buildTile(
  scene: Phaser.Scene, spec: RewardTileSpec, x: number, y: number,
  tooltip: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);

  const bg = scene.add.graphics();
  bg.fillStyle(0x121a28, 0.96).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 8);
  bg.lineStyle(2, spec.color, 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 8);
  c.add(bg);

  if (scene.textures.exists(spec.iconKey)) {
    c.add(scene.add.image(0, -4, spec.iconKey).setDisplaySize(40, 40));
  } else {
    c.add(scene.add.text(0, -4, spec.emoji, { fontSize: "26px" }).setOrigin(0.5));
  }
  c.add(crispText(scene, 0, TILE / 2 - 14, spec.label, { fontSize: "10px", color: hex(spec.color), fontStyle: "bold" }).setOrigin(0.5, 0));

  c.setSize(TILE, TILE).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => {
    showTileTooltip(scene, tooltip, spec, x, y);
    scene.tweens.add({ targets: c, scale: 1.1, duration: 90, ease: "Back.easeOut" });
  });
  c.on("pointerout", () => {
    tooltip.setVisible(false);
    scene.tweens.add({ targets: c, scale: 1, duration: 120, ease: "Quad.easeOut" });
  });
  return c;
}

function showTileTooltip(
  scene: Phaser.Scene, tooltip: Phaser.GameObjects.Container,
  spec: RewardTileSpec, x: number, y: number,
): void {
  if (spec.tooltip.kind === "item") {
    const def = ITEM_CATALOG_MAP.get(spec.tooltip.inst.defId);
    if (!def) return;
    renderItemTooltip(scene, tooltip, spec.tooltip.inst, def, x, y);
  } else {
    renderInfoTooltip(scene, tooltip, spec.tooltip.data, x, y);
  }
  tooltip.parentContainer?.bringToTop(tooltip);
}
