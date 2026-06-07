import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { PASSIVE_NODES, getReachableNodes, canForgetNode } from "../data/passiveGrid.ts";
import type { PassiveNodeDef } from "../data/schema.ts";
import { drawNodeIcon } from "./passiveGridGlyphs.ts";
import { formatStatBonuses } from "./passiveGridFormat.ts";
import { JewelOverlay } from "./jewelOverlay.ts";
import { JEWEL_CATALOG_MAP } from "../data/jewels.ts";

// ── Layout constants ─────────────────────────────────────────────────────────
const MIN_X = 4;
const MIN_Y = -1;
const CELL = 28;           // px per grid unit
const GRID_LEFT = 18;      // left edge of grid area
const GRID_TOP = 40;       // top edge of grid area
const PANEL_X = 545;       // right info panel x start
const PANEL_W = 400;

function toPixel(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: GRID_LEFT + (gridX - MIN_X) * CELL,
    y: GRID_TOP + (gridY - MIN_Y) * CELL,
  };
}

// ── Visual config ─────────────────────────────────────────────────────────────
const REGION_COLOR: Record<string, number> = {
  brawler:   0xff7043,
  arcane:    0xce93d8,
  warden:    0x66bb6a,
  predator:  0x26c6da,
  tactician: 0xffd54f,
  phantom:   0x7986cb,
  conduit:   0xef5350,
  prestige:  0xffd700,
};

const NODE_RADIUS: Record<string, number> = {
  path:          7,
  notable:       11,
  mastery:       11,
  keystone:      14,
  "jewel-socket": 9,
};

export class PassiveGridScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private gfx!: Phaser.GameObjects.Graphics;
  private selectedNode: PassiveNodeDef | null = null;

  // Side-panel text objects (created once, updated on selection)
  private panelName!: Phaser.GameObjects.Text;
  private panelType!: Phaser.GameObjects.Text;
  private panelDesc!: Phaser.GameObjects.Text;
  private panelStats!: Phaser.GameObjects.Text;
  private panelPoints!: Phaser.GameObjects.Text;
  private unlockBtn!: Phaser.GameObjects.Text;
  private forgetBtn!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;
  private socketBtn!: Phaser.GameObjects.Text;
  private removeBtn!: Phaser.GameObjects.Text;
  private jewelOverlay!: JewelOverlay;
  private resetArmed = false;
  private panelLevelReq!: Phaser.GameObjects.Text;

  constructor() {
    super("PassiveGridScene");
  }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    // Phaser reuses scene instances — clear per-visit UI state so a stale armed
    // reset or selection can't carry over into the next visit.
    this.resetArmed = false;
    this.selectedNode = null;

    // Back button
    this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

    this.add
      .text(PANEL_X + PANEL_W / 2, 10, "Passive Tree", {
        fontSize: "18px", color: "#ffd700", fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    // Graphics layer for the tree
    this.gfx = this.add.graphics();

    // Side panel text objects
    this.panelPoints = this.add.text(PANEL_X, 38, "", {
      fontSize: "16px", color: "#90caf9", fontStyle: "bold",
    });

    this.panelName = this.add.text(PANEL_X, 70, "", {
      fontSize: "16px", color: "#ffd700", fontStyle: "bold",
    });

    this.panelType = this.add.text(PANEL_X, 94, "", {
      fontSize: "12px", color: "#aaaaaa",
    });

    this.panelDesc = this.add.text(PANEL_X, 116, "", {
      fontSize: "12px", color: "#dddddd",
      wordWrap: { width: PANEL_W - 10 },
    });

    this.panelStats = this.add.text(PANEL_X, 176, "", {
      fontSize: "12px", color: "#a5d6a7",
      wordWrap: { width: PANEL_W - 10 },
    });

    this.panelLevelReq = this.add.text(PANEL_X, 260, "", {
      fontSize: "12px", color: "#ffb74d",
    });

    this.unlockBtn = this.add
      .text(PANEL_X + PANEL_W / 2, 310, "Unlock  (1 pt)", {
        fontSize: "16px", color: "#ffffff", backgroundColor: "#1a5276",
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.unlockBtn.on("pointerover", () => this.unlockBtn.setBackgroundColor("#2e86c1"));
    this.unlockBtn.on("pointerout",  () => this.unlockBtn.setBackgroundColor("#1a5276"));
    this.unlockBtn.on("pointerdown", () => this.tryUnlock());

    // Forget the selected (already-unlocked) node, refunding its point. Shares the
    // unlock button's slot — the two are mutually exclusive per node.
    this.forgetBtn = this.add
      .text(PANEL_X + PANEL_W / 2, 310, "Forget  (+1 pt)", {
        fontSize: "16px", color: "#ffffff", backgroundColor: "#7b241c",
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.forgetBtn.on("pointerover", () => this.forgetBtn.setBackgroundColor("#a93226"));
    this.forgetBtn.on("pointerout",  () => this.forgetBtn.setBackgroundColor("#7b241c"));
    this.forgetBtn.on("pointerdown", () => this.tryForget());

    // Reset the whole tree, refunding every point. Two-click confirm so a stray
    // tap can't wipe a carefully-built path.
    this.resetBtn = this.add
      .text(PANEL_X + PANEL_W / 2, 365, "Reset all points", {
        fontSize: "14px", color: "#ffcdd2", backgroundColor: "#4a235a",
      })
      .setOrigin(0.5)
      .setPadding(14, 7, 14, 7)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.resetBtn.on("pointerover", () => this.resetBtn.setBackgroundColor("#6c3483"));
    this.resetBtn.on("pointerout",  () => this.resetBtn.setBackgroundColor(this.resetArmed ? "#922b21" : "#4a235a"));
    this.resetBtn.on("pointerdown", () => this.tryResetAll());

    // Jewel-socket actions (share the y310 slot; only one shows per node state).
    this.socketBtn = this.add
      .text(PANEL_X + PANEL_W / 2, 310, "Socket Jewel", {
        fontSize: "16px", color: "#ffffff", backgroundColor: "#1e6f50",
      })
      .setOrigin(0.5).setPadding(16, 8, 16, 8).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.socketBtn.on("pointerover", () => this.socketBtn.setBackgroundColor("#27946a"));
    this.socketBtn.on("pointerout",  () => this.socketBtn.setBackgroundColor("#1e6f50"));
    this.socketBtn.on("pointerdown", () => this.openSocketPicker());

    this.removeBtn = this.add
      .text(PANEL_X + PANEL_W / 2, 310, "Remove — destroy", {
        fontSize: "15px", color: "#ffffff", backgroundColor: "#7b241c",
      })
      .setOrigin(0.5).setPadding(14, 8, 14, 8).setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.removeBtn.on("pointerover", () => this.removeBtn.setBackgroundColor("#a93226"));
    this.removeBtn.on("pointerout",  () => this.removeBtn.setBackgroundColor("#7b241c"));
    this.removeBtn.on("pointerdown", () => this.confirmRemoveSocket());

    this.jewelOverlay = new JewelOverlay(this, this.mgr, () => this.redraw());

    // Click detection on the grid area
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.jewelOverlay.isOpen()) return; // modal open — tree is inert
      if (ptr.x > PANEL_X) return; // clicks in right panel handled by buttons
      this.handleGridClick(ptr.x, ptr.y);
    });

    this.redraw();
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  private redraw(): void {
    const save = this.mgr.getSave();
    const unlockedSet = new Set(save.hero.unlockedNodes);
    const reachableSet = new Set(
      getReachableNodes(save.hero.unlockedNodes, save.hero.level).map((n) => n.id),
    );

    this.gfx.clear();

    // Connection lines first (drawn under nodes)
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
        const color = bothUnlocked
          ? (REGION_COLOR[node.region] ?? 0x888888)
          : 0x445566;
        this.gfx.lineStyle(bothUnlocked ? 2 : 1, color, alpha);
        this.gfx.beginPath();
        this.gfx.moveTo(a.x, a.y);
        this.gfx.lineTo(b.x, b.y);
        this.gfx.strokePath();
      }
    }

    // Nodes
    for (const node of PASSIVE_NODES) {
      this.drawNode(node, unlockedSet, reachableSet, save.hero.level);
    }

    this.refreshPanel(unlockedSet, reachableSet, save.hero.level, save.hero.skillPoints);
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

    // Keystone: outer ring
    if (node.type === "keystone" && (isUnlocked || isReachable)) {
      this.gfx.lineStyle(1, regionColor, 0.35);
      this.gfx.strokeCircle(x, y, r + 5);
    }

    // Fill
    if (node.type === "jewel-socket") {
      // Diamond
      this.gfx.fillStyle(fillColor, fillAlpha);
      this.gfx.fillPoints([
        new Phaser.Geom.Point(x, y - r),
        new Phaser.Geom.Point(x + r, y),
        new Phaser.Geom.Point(x, y + r),
        new Phaser.Geom.Point(x - r, y),
      ], true);
      this.gfx.lineStyle(lineWidth, lineColor, lineAlpha);
      this.gfx.strokePoints([
        new Phaser.Geom.Point(x, y - r),
        new Phaser.Geom.Point(x + r, y),
        new Phaser.Geom.Point(x, y + r),
        new Phaser.Geom.Point(x - r, y),
      ], true);
    } else {
      this.gfx.fillStyle(fillColor, fillAlpha);
      this.gfx.fillCircle(x, y, r);
      this.gfx.lineStyle(lineWidth, lineColor, lineAlpha);
      this.gfx.strokeCircle(x, y, r);
    }

    // Region/type glyph icon drawn on top of the fill (T1 / T18).
    // Visible for unlocked and reachable nodes; dim for others.
    const iconAlpha = isUnlocked ? 0.92 : isReachable ? 0.55 : 0.22;
    if (!levelLocked) drawNodeIcon(this.gfx, node, x, y, r, iconAlpha);
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private handleGridClick(px: number, py: number): void {
    let closest: PassiveNodeDef | null = null;
    let closestDist = Infinity;

    for (const node of PASSIVE_NODES) {
      const { x, y } = toPixel(node.gridX, node.gridY);
      const d = Math.hypot(px - x, py - y);
      const r = (NODE_RADIUS[node.type] ?? 8) + 4; // generous hit area
      if (d <= r && d < closestDist) {
        closest = node;
        closestDist = d;
      }
    }

    if (closest) {
      this.disarmReset();
      this.selectedNode = closest === this.selectedNode ? null : closest;
      this.redraw();
    }
  }

  private tryUnlock(): void {
    if (!this.selectedNode) return;
    const ok = this.mgr.unlockPassiveNode(this.selectedNode.id);
    if (ok) {
      this.redraw();
    }
  }

  private tryForget(): void {
    if (!this.selectedNode) return;
    if (this.mgr.forgetPassiveNode(this.selectedNode.id)) {
      this.redraw();
    }
  }

  private tryResetAll(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.setText("Confirm reset?").setBackgroundColor("#922b21");
      return;
    }
    this.disarmReset();
    this.mgr.resetPassiveTree();
    this.selectedNode = null;
    this.redraw();
  }

  private disarmReset(): void {
    if (!this.resetArmed) return;
    this.resetArmed = false;
    this.resetBtn.setText("Reset all points").setBackgroundColor("#4a235a");
  }

  private openSocketPicker(): void {
    if (this.selectedNode?.type === "jewel-socket") this.jewelOverlay.openPicker(this.selectedNode.id);
  }

  private confirmRemoveSocket(): void {
    const node = this.selectedNode;
    if (node?.type !== "jewel-socket") return;
    const instId = this.mgr.getSave().hero.socketedJewels[node.id];
    if (!instId) return;
    const inst = this.mgr.getSave().hero.jewels.find((j) => j.id === instId);
    const def = inst ? JEWEL_CATALOG_MAP.get(inst.defId) : undefined;
    this.jewelOverlay.confirmDestroy(instId, def?.name ?? "this jewel");
  }

  /** The jewel def socketed in a node, or null. */
  private socketedJewelDef(nodeId: string) {
    const instId = this.mgr.getSave().hero.socketedJewels[nodeId];
    if (!instId) return null;
    const inst = this.mgr.getSave().hero.jewels.find((j) => j.id === instId);
    return inst ? JEWEL_CATALOG_MAP.get(inst.defId) ?? null : null;
  }

  // ── Side panel ───────────────────────────────────────────────────────────────

  private refreshPanel(
    unlockedSet: Set<string>,
    reachableSet: Set<string>,
    heroLevel: number,
    skillPoints: number,
  ): void {
    this.panelPoints.setText(`Skill points: ${skillPoints}`);

    // "Reset all" is offered whenever any point has been spent.
    this.resetBtn.setVisible(unlockedSet.size > 0);
    if (unlockedSet.size === 0) this.disarmReset();

    if (!this.selectedNode) {
      this.panelName.setText("Select a node");
      this.panelType.setText("");
      this.panelDesc.setText("");
      this.panelStats.setText("");
      this.panelLevelReq.setText("");
      this.unlockBtn.setVisible(false);
      this.forgetBtn.setVisible(false);
      this.socketBtn.setVisible(false);
      this.removeBtn.setVisible(false);
      return;
    }

    const node = this.selectedNode;
    const isUnlocked = unlockedSet.has(node.id);
    const isReachable = reachableSet.has(node.id);
    const levelLocked = (node.unlockAtLevel ?? 0) > heroLevel;
    const regionColor = "#" + (REGION_COLOR[node.region] ?? 0x888888).toString(16).padStart(6, "0");

    this.panelName.setText(node.name).setColor(regionColor);
    this.panelType.setText(`${node.type.toUpperCase()}  ·  ${node.region}`);
    this.panelDesc.setText(node.description);
    this.panelStats.setText(formatStatBonuses(node)).setColor("#a5d6a7");

    if (levelLocked) {
      this.panelLevelReq.setText(`Requires level ${node.unlockAtLevel}`);
    } else {
      this.panelLevelReq.setText("");
    }

    const isJewel = node.type === "jewel-socket";

    const canUnlock = !isUnlocked && isReachable && !levelLocked && skillPoints > 0;
    this.unlockBtn.setVisible(!isUnlocked && (isReachable || levelLocked));
    this.unlockBtn.setAlpha(canUnlock ? 1 : 0.4);

    // Forget is offered for any unlocked NON-jewel node; it's only actionable
    // (full alpha) when removing it won't orphan the rest of the tree. Jewel
    // sockets show socket/remove instead to keep the panel uncluttered.
    const forgettable = isUnlocked && !isJewel && canForgetNode([...unlockedSet], node.id);
    this.forgetBtn.setVisible(isUnlocked && !isJewel);
    this.forgetBtn.setAlpha(forgettable ? 1 : 0.4);

    // Jewel-socket actions, only once the socket node itself is allocated.
    const jewelDef = isJewel && isUnlocked ? this.socketedJewelDef(node.id) : null;
    this.socketBtn.setVisible(isJewel && isUnlocked && !jewelDef);
    this.removeBtn.setVisible(isJewel && isUnlocked && !!jewelDef);
    if (isJewel && isUnlocked) {
      this.panelStats.setText(
        jewelDef
          ? `Socketed: ${jewelDef.name}\n${jewelDef.description}`
          : "Empty socket — socket a jewel to empower your hero and towers.",
      ).setColor(jewelDef ? "#80d8ff" : "#a5d6a7");
    }

    if (isUnlocked) {
      // Show a small "Unlocked ✓" badge
      this.panelLevelReq.setText("✓ Unlocked").setColor("#a5d6a7");
    }
  }
}
