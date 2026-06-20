import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { PASSIVE_NODES, getReachableNodes } from "../data/passiveGrid.ts";
import type { PassiveNodeDef } from "../data/schema.ts";
import { drawNodeIcon } from "./passiveGridGlyphs.ts";
import { PassiveGridPanel, PANEL_X } from "./passiveGridPanel.ts";
import { TAP_SLOP_PX } from "../core/gesture.ts";
import {
  clampZoom,
  clampScroll,
  treeBounds,
  frontierCenter,
  type Bounds,
} from "./passiveTreeCamera.ts";
import { buildPassiveTreeAtmosphere, type RegionCenter } from "./passiveTreeAtmosphere.ts";
import { PassiveTreeFx } from "./passiveTreeFx.ts";

// ── Layout constants ─────────────────────────────────────────────────────────
const MIN_X = 4;
const MIN_Y = -1;
const CELL = 28; // px per grid unit
const GRID_LEFT = 18;
const GRID_TOP = 40;

function toPixel(gridX: number, gridY: number): { x: number; y: number } {
  return { x: GRID_LEFT + (gridX - MIN_X) * CELL, y: GRID_TOP + (gridY - MIN_Y) * CELL };
}

const REGION_COLOR: Record<string, number> = {
  brawler: 0xff7043,
  arcane: 0xce93d8,
  warden: 0x66bb6a,
  predator: 0x26c6da,
  tactician: 0xffd54f,
  phantom: 0x7986cb,
  conduit: 0xef5350,
  prestige: 0xffd700,
};

const NODE_RADIUS: Record<string, number> = {
  path: 7,
  notable: 11,
  mastery: 11,
  keystone: 14,
  "jewel-socket": 9,
};

export class PassiveGridScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private gfx!: Phaser.GameObjects.Graphics;
  private selectedNode: PassiveNodeDef | null = null;
  private panel!: PassiveGridPanel;

  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private bounds!: Bounds;
  private fx!: PassiveTreeFx;
  private uiOnlyObjects: Phaser.GameObjects.GameObject[] = [];

  private dragging = false;
  private dragStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
  private movedPx = 0;

  constructor() {
    super("PassiveGridScene");
  }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    this.selectedNode = null;
    this.dragging = false;
    this.uiOnlyObjects = [];

    const back = this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));
    this.uiOnlyObjects.push(back);

    // Cosmic backdrop + node glow sit on the main camera, beneath the tree.
    this.bounds = treeBounds(PASSIVE_NODES, toPixel);
    this.fx = new PassiveTreeFx(
      this,
      buildPassiveTreeAtmosphere(this.bounds, this.regionCenters(), 1337),
    );

    // Tree lives on the main (scrollable) camera; the side panel on a fixed UI camera.
    this.gfx = this.add.graphics();
    this.panel = new PassiveGridPanel(
      this,
      this.mgr,
      () => this.selectedNode,
      (n) => {
        this.selectedNode = n;
      },
      () => this.redraw(),
    );
    this.panel.create();

    this.makeZoomButtons();
    this.setupCameras();
    this.setupInput();
    this.redraw();
  }

  // ── Cameras ──────────────────────────────────────────────────────────────────

  private setupCameras(): void {
    const { width, height } = this.scale;
    // Near-black clear so off-bounds void reads as deep space; the gradient bands +
    // nebulae (on the main camera) supply the actual atmospheric backdrop.
    this.cameras.main.setBackgroundColor("#04060a");
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.uiCam.setScroll(0, 0);
    this.uiCam.transparent = true;

    // Partition rendering: tree + cosmos → main camera only; panel + chrome → UI camera.
    this.uiCam.ignore([this.gfx, ...this.fx.objects]);
    this.cameras.main.ignore([...this.panel.objects, ...this.uiOnlyObjects]);

    const save = this.mgr.getSave();
    const c = frontierCenter(PASSIVE_NODES, save.hero.unlockedNodes, toPixel);
    this.cameras.main.centerOn(c.x, c.y);
    this.applyScrollClamp();
  }

  /** Centroid (in pixels) of each region's nodes, paired with its color. */
  private regionCenters(): RegionCenter[] {
    const acc = new Map<string, { sx: number; sy: number; n: number }>();
    for (const node of PASSIVE_NODES) {
      const p = toPixel(node.gridX, node.gridY);
      const a = acc.get(node.region) ?? { sx: 0, sy: 0, n: 0 };
      a.sx += p.x;
      a.sy += p.y;
      a.n += 1;
      acc.set(node.region, a);
    }
    return [...acc.entries()].map(([region, a]) => ({
      region,
      x: a.sx / a.n,
      y: a.sy / a.n,
      color: REGION_COLOR[region] ?? 0x888888,
    }));
  }

  update(time: number): void {
    this.fx?.update(time);
  }

  private applyScrollClamp(): void {
    const cam = this.cameras.main;
    const s = clampScroll(cam.scrollX, cam.scrollY, this.bounds, this.scale.width, this.scale.height, cam.zoom);
    cam.setScroll(s.scrollX, s.scrollY);
  }

  private makeZoomButtons(): void {
    const mk = (label: string, x: number, factor: number) => {
      const btn = this.add
        .text(x, this.scale.height - 34, label, {
          fontSize: "20px",
          color: "#ffffff",
          backgroundColor: "#1a5276",
        })
        .setPadding(10, 4, 10, 4)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.cameras.main.zoom = clampZoom(this.cameras.main.zoom * factor);
        this.applyScrollClamp();
      });
      this.uiOnlyObjects.push(btn);
    };
    mk("－", 20, 0.85);
    mk("＋", 64, 1.18);
  }

  // ── Input (drag-pan / wheel-zoom / tap-select) ─────────────────────────────────

  private setupInput(): void {
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.panel.isModalOpen() || ptr.x > PANEL_X) return;
      this.dragging = true;
      this.movedPx = 0;
      this.dragStart = {
        x: ptr.x,
        y: ptr.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
      };
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dx = ptr.x - this.dragStart.x;
      const dy = ptr.y - this.dragStart.y;
      this.movedPx = Math.max(this.movedPx, Math.hypot(dx, dy));
      const zoom = this.cameras.main.zoom;
      const s = clampScroll(
        this.dragStart.scrollX - dx / zoom,
        this.dragStart.scrollY - dy / zoom,
        this.bounds,
        this.scale.width,
        this.scale.height,
        zoom,
      );
      this.cameras.main.setScroll(s.scrollX, s.scrollY);
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      const wasDrag = this.movedPx > TAP_SLOP_PX;
      this.dragging = false;
      if (this.panel.isModalOpen() || ptr.x > PANEL_X) return;
      if (!wasDrag) {
        const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
        this.handleGridClick(wp.x, wp.y);
      }
    });

    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.cameras.main.zoom = clampZoom(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1));
      this.applyScrollClamp();
    });
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  private redraw(): void {
    const save = this.mgr.getSave();
    const unlockedSet = new Set(save.hero.unlockedNodes);
    const reachableSet = new Set(
      getReachableNodes(save.hero.unlockedNodes, save.hero.level).map((n) => n.id),
    );

    this.gfx.clear();
    this.fx.drawGlow(PASSIVE_NODES, unlockedSet, toPixel, (region) => REGION_COLOR[region] ?? 0x888888);

    const drawn = new Set<string>();
    for (const node of PASSIVE_NODES) {
      const a = toPixel(node.gridX, node.gridY);
      for (const nbrId of node.neighbors) {
        const pairKey = [node.id, nbrId].sort().join("|");
        if (drawn.has(pairKey)) continue;
        drawn.add(pairKey);
        const nbr = PASSIVE_NODES.find((n) => n.id === nbrId);
        if (!nbr) continue;
        const b = toPixel(nbr.gridX, nbr.gridY);
        const bothUnlocked = unlockedSet.has(node.id) && unlockedSet.has(nbrId);
        const alpha = bothUnlocked ? 0.9 : 0.2;
        const color = bothUnlocked ? (REGION_COLOR[node.region] ?? 0x888888) : 0x445566;
        this.gfx.lineStyle(bothUnlocked ? 2 : 1, color, alpha);
        this.gfx.beginPath();
        this.gfx.moveTo(a.x, a.y);
        this.gfx.lineTo(b.x, b.y);
        this.gfx.strokePath();
      }
    }

    for (const node of PASSIVE_NODES) {
      this.drawNode(node, unlockedSet, reachableSet, save.hero.level);
    }

    this.panel.refresh(unlockedSet, reachableSet, save.hero.level, save.hero.skillPoints);
  }

  private drawNode(
    node: PassiveNodeDef,
    unlockedSet: Set<string>,
    reachableSet: Set<string>,
    heroLevel: number,
  ): void {
    const { x, y } = toPixel(node.gridX, node.gridY);
    const isUnlocked = unlockedSet.has(node.id);
    const isReachable = reachableSet.has(node.id);
    const isSelected = this.selectedNode?.id === node.id;
    const levelLocked = (node.unlockAtLevel ?? 0) > heroLevel;
    const r = NODE_RADIUS[node.type] ?? 8;
    const regionColor = REGION_COLOR[node.region] ?? 0x888888;

    let fillColor: number;
    let fillAlpha: number;
    let lineColor: number;
    let lineAlpha: number;
    let lineWidth: number;

    if (isUnlocked) {
      fillColor = regionColor;
      fillAlpha = 1;
      lineColor = 0xffffff;
      lineAlpha = 0.6;
      lineWidth = node.type === "keystone" ? 2.5 : 1.5;
    } else if (isReachable && !levelLocked) {
      fillColor = regionColor;
      fillAlpha = 0.2;
      lineColor = regionColor;
      lineAlpha = 0.8;
      lineWidth = 1.5;
    } else if (levelLocked) {
      fillColor = 0x222222;
      fillAlpha = 1;
      lineColor = 0x555555;
      lineAlpha = 0.6;
      lineWidth = 1;
    } else {
      fillColor = 0x1a2a3a;
      fillAlpha = 1;
      lineColor = 0x334455;
      lineAlpha = 0.5;
      lineWidth = 1;
    }

    if (isSelected) {
      lineColor = 0xffd700;
      lineAlpha = 1;
      lineWidth = 2.5;
    }

    if (node.type === "keystone" && (isUnlocked || isReachable)) {
      this.gfx.lineStyle(1, regionColor, 0.35);
      this.gfx.strokeCircle(x, y, r + 5);
    }

    if (node.type === "jewel-socket") {
      const pts = [
        new Phaser.Geom.Point(x, y - r),
        new Phaser.Geom.Point(x + r, y),
        new Phaser.Geom.Point(x, y + r),
        new Phaser.Geom.Point(x - r, y),
      ];
      this.gfx.fillStyle(fillColor, fillAlpha);
      this.gfx.fillPoints(pts, true);
      this.gfx.lineStyle(lineWidth, lineColor, lineAlpha);
      this.gfx.strokePoints(pts, true);
    } else {
      this.gfx.fillStyle(fillColor, fillAlpha);
      this.gfx.fillCircle(x, y, r);
      this.gfx.lineStyle(lineWidth, lineColor, lineAlpha);
      this.gfx.strokeCircle(x, y, r);
    }

    const iconAlpha = isUnlocked ? 0.92 : isReachable ? 0.55 : 0.22;
    if (!levelLocked) drawNodeIcon(this.gfx, node, x, y, r, iconAlpha);
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  private handleGridClick(px: number, py: number): void {
    let closest: PassiveNodeDef | null = null;
    let closestDist = Infinity;
    for (const node of PASSIVE_NODES) {
      const { x, y } = toPixel(node.gridX, node.gridY);
      const d = Math.hypot(px - x, py - y);
      const r = (NODE_RADIUS[node.type] ?? 8) + 4;
      if (d <= r && d < closestDist) {
        closest = node;
        closestDist = d;
      }
    }
    if (closest) {
      this.selectedNode = closest === this.selectedNode ? null : closest;
      this.redraw();
    }
  }
}
