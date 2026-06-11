// src/scenes/rewardPanel.ts
//
// The post-battle reward display: everything looted in a cleared (or lost!)
// run shown as an icon tile — gold, diamonds, gear, jewels, skills, characters,
// loot boxes, materials and hero XP. Hovering a tile reveals its detail:
// equipment uses the full stat tooltip, everything else a titled info card.
// The icons carry the meaning; names live in the hover, per design. The pure
// tile mapping lives in data/rewardTiles.ts.
//
// The grid lives inside a fixed, masked viewport and SCROLLS (wheel + drag) when
// a long run produces more loot than fits — so a big haul never spills off the
// screen or over the Return-to-Menu button (the old bug). The hover tooltip is
// drawn OUTSIDE the mask and tracks the scrolled tile, so it is never clipped.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { renderItemTooltip } from "./itemTooltip.ts";
import { renderInfoTooltip } from "./infoTooltip.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { battleLootTiles, type BattleLootSummary, type RewardTileSpec } from "../data/rewardTiles.ts";
import { makeFitIcon } from "./itemIcon.ts";

const TILE = 56, GAP = 8, PER_ROW = 8;
const ROW_H = TILE + 22;     // tile + room for the count/rarity label
const MAX_VISIBLE_ROWS = 3;  // rows shown before the grid starts scrolling

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

const TITLE_H = 40;       // headroom reserved above the grid for the result title
const PANEL_PAD = 18;     // inset between the backing panel edge and its contents

/**
 * Build the post-battle loot panel at (centerX, topY): a result title
 * (VICTORY / DEFEATED) over a centred grid of icon tiles with hover tooltips,
 * shown on win OR loss, all sitting on a dark backing panel so the loot reads
 * clearly against the battlefield behind it. Tiles beyond MAX_VISIBLE_ROWS
 * scroll within a masked viewport. Returns the root container (already added to
 * the scene at depth 25). The caller owns its lifetime.
 */
export function showBattleLootPanel(
  scene: Phaser.Scene, summary: BattleLootSummary, centerX: number, topY: number,
): Phaser.GameObjects.Container {
  const specs = battleLootTiles(summary);
  const root = scene.add.container(0, 0).setDepth(25);
  const tooltip = scene.add.container(0, 0).setDepth(120).setVisible(false);
  const won = summary.outcome === "won";

  // The result title owns the top strip; the grid (and caption) sit below it.
  const titleY = topY;
  let gridTop = topY + TITLE_H;

  const caption = summary.isFirstClear
    ? "★ First Clear bonus!"
    : specs.length === 0
      ? "No loot this run."
      : "";

  // Grid metrics up front so the backing panel can be sized to wrap everything.
  const cols = specs.length ? Math.min(PER_ROW, specs.length) : 0;
  const rows = Math.ceil(specs.length / PER_ROW);
  const visRows = Math.min(rows, MAX_VISIBLE_ROWS);
  const gridW = cols ? cols * (TILE + GAP) - GAP : 0;
  const gridH = visRows * ROW_H;
  const scrollable = rows * ROW_H > gridH;

  // Backing panel: tinted by outcome, drawn first so it sits behind everything.
  const captionH = caption ? 20 : 0;
  const contentBottom = gridTop + captionH + gridH + (scrollable ? 16 : 0);
  const panelW = Math.max(gridW, 240) + PANEL_PAD * 2;
  const panelTop = topY - 12;
  const panelH = contentBottom - panelTop + PANEL_PAD;
  const panelLeft = Math.round(centerX - panelW / 2);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1018, 0.88).fillRoundedRect(panelLeft, panelTop, panelW, panelH, 14);
  bg.lineStyle(2, won ? 0x6fbf73 : 0xc16b6b, 0.9).strokeRoundedRect(panelLeft, panelTop, panelW, panelH, 14);
  root.add(bg);

  // Result title — the clear WIN/DEFEAT verdict, above the looted items.
  root.add(crispText(scene, centerX, titleY, won ? "VICTORY" : "DEFEATED", {
    fontSize: "30px", color: won ? "#a5d6a7" : "#ef9a9a", fontStyle: "bold", stroke: "#0a1420", strokeThickness: 6,
  }).setOrigin(0.5, 0));

  if (caption) {
    root.add(crispText(scene, centerX, gridTop, caption, {
      fontSize: "13px", color: summary.isFirstClear ? "#ffe07a" : "#9fb0c0", fontStyle: "bold", stroke: "#0a1420", strokeThickness: 4,
    }).setOrigin(0.5, 0));
    gridTop += captionH;
  }

  if (specs.length > 0) {
    buildScrollableGrid(scene, root, tooltip, specs, centerX, gridTop);
  }

  // Tooltip drawn last so it layers above every tile.
  root.add(tooltip);
  return root;
}

/** Lay the tiles out in a masked, scrollable viewport centred on `centerX`. */
function buildScrollableGrid(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  tooltip: Phaser.GameObjects.Container,
  specs: RewardTileSpec[],
  centerX: number,
  vpTop: number,
): void {
  const cols = Math.min(PER_ROW, specs.length);
  const rows = Math.ceil(specs.length / PER_ROW);
  const visRows = Math.min(rows, MAX_VISIBLE_ROWS);
  const vpW = cols * (TILE + GAP) - GAP;
  const vpH = visRows * ROW_H;
  const vpLeft = Math.round(centerX - vpW / 2);
  const contentH = rows * ROW_H;
  const scrollable = contentH > vpH;

  // Tiles live in a scrolling list container; the mask clips it to the viewport.
  const list = scene.add.container(vpLeft, vpTop);
  root.add(list);
  const maskG = scene.make.graphics({}).fillRect(vpLeft, vpTop, vpW, vpH);
  const mask = maskG.createGeometryMask();
  list.setMask(mask);

  specs.forEach((spec, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = col * (TILE + GAP) + TILE / 2;
    const y = row * ROW_H + TILE / 2;
    list.add(buildTile(scene, spec, x, y, list, tooltip));
  });

  if (!scrollable) return;

  // Scroll affordance + wheel/drag handlers, clamped to the content range.
  const minY = vpTop - (contentH - vpH);
  const hint = crispText(scene, centerX, vpTop + vpH + 2, "⇕ scroll for more", {
    fontSize: "10px", color: "#7f93a8", fontStyle: "bold", stroke: "#0a1420", strokeThickness: 3,
  }).setOrigin(0.5, 0);
  root.add(hint);

  let dragging = false, dragStartY = 0, listStartY = 0;
  const clamp = (v: number) => Phaser.Math.Clamp(v, minY, vpTop);
  const inViewport = (p: Phaser.Input.Pointer) =>
    p.x >= vpLeft && p.x <= vpLeft + vpW && p.y >= vpTop && p.y <= vpTop + vpH;
  const wheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (!list.active || !inViewport(p)) return;
    list.y = clamp(list.y - dy * 0.5);
    tooltip.setVisible(false);
  };
  const down = (p: Phaser.Input.Pointer) => {
    if (list.active && inViewport(p)) { dragging = true; dragStartY = p.y; listStartY = list.y; }
  };
  const move = (p: Phaser.Input.Pointer) => {
    if (dragging && list.active) { list.y = clamp(listStartY + (p.y - dragStartY)); tooltip.setVisible(false); }
  };
  const up = () => { dragging = false; };
  scene.input.on("wheel", wheel);
  scene.input.on("pointerdown", down);
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", up);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("wheel", wheel);
    scene.input.off("pointerdown", down);
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", up);
    maskG.destroy();
  });
}

function buildTile(
  scene: Phaser.Scene, spec: RewardTileSpec, localX: number, localY: number,
  list: Phaser.GameObjects.Container, tooltip: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const c = scene.add.container(localX, localY);

  const bg = scene.add.graphics();
  bg.fillStyle(0x121a28, 0.96).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 8);
  bg.lineStyle(2, spec.color, 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 8);
  c.add(bg);

  // Scale-to-fill (TILE-aware) so a looted item reads the same size here as in
  // the bag/shop — not the old tiny fixed 36px that made fresh loot look "off".
  c.add(makeFitIcon(scene, 0, -4, spec.iconKey, TILE - 14, spec.emoji));
  c.add(crispText(scene, 0, TILE / 2 - 13, spec.label, { fontSize: "10px", color: hex(spec.color), fontStyle: "bold" }).setOrigin(0.5, 0));

  c.setSize(TILE, TILE).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => {
    // Tooltip lives outside the mask, so anchor it to the tile's CURRENT world
    // position (list scrolls, so read list.y live).
    showTileTooltip(scene, tooltip, spec, list.x + localX, list.y + localY);
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
    const heroLevel = scene.registry.get("saveManager")?.getSave()?.hero?.level;
    renderItemTooltip(scene, tooltip, spec.tooltip.inst, def, x, y, heroLevel);
  } else {
    renderInfoTooltip(scene, tooltip, spec.tooltip.data, x, y);
  }
  tooltip.setVisible(true);
  tooltip.parentContainer?.bringToTop(tooltip);
}
