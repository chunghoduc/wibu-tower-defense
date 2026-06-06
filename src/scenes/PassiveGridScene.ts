import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { PASSIVE_NODES, getReachableNodes } from "../data/passiveGrid.ts";
import type { PassiveNodeDef } from "../data/schema.ts";

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
  private panelLevelReq!: Phaser.GameObjects.Text;

  constructor() {
    super("PassiveGridScene");
  }

  create(): void {
    this.mgr = this.registry.get("saveManager");

    // Back button
    this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

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

    // Click detection on the grid area
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
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

  // ── Side panel ───────────────────────────────────────────────────────────────

  private refreshPanel(
    unlockedSet: Set<string>,
    reachableSet: Set<string>,
    heroLevel: number,
    skillPoints: number,
  ): void {
    this.panelPoints.setText(`Skill points: ${skillPoints}`);

    if (!this.selectedNode) {
      this.panelName.setText("Select a node");
      this.panelType.setText("");
      this.panelDesc.setText("");
      this.panelStats.setText("");
      this.panelLevelReq.setText("");
      this.unlockBtn.setVisible(false);
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
    this.panelStats.setText(formatStatBonuses(node));

    if (levelLocked) {
      this.panelLevelReq.setText(`Requires level ${node.unlockAtLevel}`);
    } else {
      this.panelLevelReq.setText("");
    }

    const canUnlock = !isUnlocked && isReachable && !levelLocked && skillPoints > 0;
    this.unlockBtn.setVisible(!isUnlocked && (isReachable || levelLocked));
    this.unlockBtn.setAlpha(canUnlock ? 1 : 0.4);

    if (isUnlocked) {
      this.unlockBtn.setVisible(false);
      // Show a small "Unlocked ✓" badge
      this.panelLevelReq.setText("✓ Unlocked").setColor("#a5d6a7");
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatStatBonuses(node: PassiveNodeDef): string {
  const lines: string[] = [];

  const fmt = (label: string, v: number, pct: boolean) => {
    const sign = v >= 0 ? "+" : "";
    const val = pct ? `${sign}${(v * 100).toFixed(0)}%` : `${sign}${v}`;
    lines.push(`${val} ${label}`);
  };

  if (node.flat) {
    for (const [k, v] of Object.entries(node.flat) as [string, number][]) {
      if (v) fmt(statLabel(k), v, false);
    }
  }
  if (node.increased) {
    for (const [k, v] of Object.entries(node.increased) as [string, number][]) {
      if (v) fmt(statLabel(k), v, true);
    }
  }
  if (node.more) {
    for (const [k, v] of Object.entries(node.more) as [string, number][]) {
      if (v) lines.push(`×${(1 + v).toFixed(2)} ${statLabel(k)} (more)`);
    }
  }

  return lines.join("\n") || (node.effectId ? `Effect: ${node.effectId}` : "");
}

const STAT_LABELS: Record<string, string> = {
  atk: "ATK", attackSpeed: "Atk Speed", range: "Range",
  critRate: "Crit Rate", critDamage: "Crit Dmg", armorPen: "Armor Pen",
  magicPen: "Magic Pen", skillPower: "Skill Power",
  maxHp: "Max HP", hpRegen: "HP Regen", armor: "Armor",
  magicResist: "Magic Resist", damageReduction: "Dmg Reduction",
  tenacity: "Tenacity", maxMana: "Max Mana", manaRegen: "Mana Regen",
  manaOnHit: "Mana/Hit", manaOnKill: "Mana/Kill",
  manaCostReduction: "Mana Cost Red.", omnivamp: "Omnivamp",
  moveSpeed: "Move Speed", goldFind: "Gold Find",
};

function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}
