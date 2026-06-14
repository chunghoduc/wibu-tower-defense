import type Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import type { PassiveNodeDef } from "../data/schema.ts";

const CHIP_X = 545; // matches PANEL_X in PassiveGridScene
const CHIP_W = 400; // matches PANEL_W
const CHIP_TOP = 176; // sits where panelStats would be
const CHIP_H = 30;
const CHIP_GAP = 8;

const COL_SEL_BG = "#5d4037";
const COL_SEL_HOVER = "#6d4c41";
const COL_OFF_BG = "#2c3a47";
const COL_OFF_HOVER = "#37474f";

/**
 * Inline option-chip picker for "choose" mastery nodes, rendered into the passive
 * tree's right detail panel. For a locked node, tapping a chip sets a *pending*
 * pick (returned via getPending) that the scene's Unlock button consumes. For an
 * unlocked node, tapping a chip switches the active option immediately (free) via
 * SaveManager.setNodeChoice and triggers the scene to redraw.
 */
export class MasteryChoicePanel {
  private chips: Phaser.GameObjects.Text[] = [];
  private pendingId: string | null = null;

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private onChange: () => void,
  ) {}

  /** The chip the player has tentatively selected on a locked node (for Unlock). */
  getPending(): string | null {
    return this.pendingId;
  }

  /** Hide the picker (non-choice node or no selection). */
  clear(): void {
    for (const c of this.chips) c.destroy();
    this.chips = [];
    this.pendingId = null;
  }

  /**
   * Render chips for a choice node. `isUnlocked` drives behaviour: locked → pending
   * selection; unlocked → instant free switch. Returns true if it rendered (caller
   * should then hide the plain stat text).
   */
  render(node: PassiveNodeDef, isUnlocked: boolean): boolean {
    this.clear();
    if (!node.choices || node.choices.length === 0) return false;

    const activeId = isUnlocked
      ? (this.mgr.getSave().hero.nodeChoices[node.id] ?? node.choices[0].id)
      : null;
    // Default the pending pick to the first option so Unlock always has a value.
    if (!isUnlocked) this.pendingId = node.choices[0].id;

    node.choices.forEach((opt, i) => {
      const y = CHIP_TOP + i * (CHIP_H + CHIP_GAP);
      const selected = this.isSelected(opt.id, isUnlocked, activeId);
      const chip = this.scene.add
        .text(CHIP_X, y, (selected ? "● " : "○ ") + opt.label, {
          fontSize: "13px",
          color: selected ? "#fff8e1" : "#cfd8dc",
          backgroundColor: selected ? COL_SEL_BG : COL_OFF_BG,
          fixedWidth: CHIP_W,
          padding: { left: 10, right: 10, top: 8, bottom: 8 },
        })
        .setInteractive({ useHandCursor: true });

      chip.on("pointerover", () =>
        chip.setBackgroundColor(
          this.isSelected(opt.id, isUnlocked, activeId) ? COL_SEL_HOVER : COL_OFF_HOVER,
        ),
      );
      chip.on("pointerout", () =>
        chip.setBackgroundColor(
          this.isSelected(opt.id, isUnlocked, activeId) ? COL_SEL_BG : COL_OFF_BG,
        ),
      );
      chip.on("pointerdown", () => this.pick(node, opt.id, isUnlocked));
      this.chips.push(chip);
    });
    return true;
  }

  private isSelected(optId: string, isUnlocked: boolean, activeId: string | null): boolean {
    return isUnlocked ? optId === activeId : optId === this.pendingId;
  }

  private pick(node: PassiveNodeDef, optId: string, isUnlocked: boolean): void {
    if (isUnlocked) {
      if (this.mgr.setNodeChoice(node.id, optId)) this.onChange();
    } else {
      this.pendingId = optId;
      this.render(node, false); // re-render to move the highlight
    }
  }
}
