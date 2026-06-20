import type Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import type { PassiveNodeDef } from "../data/schema.ts";
import { canForgetNode } from "../data/passiveGrid.ts";
import { formatStatBonuses } from "./passiveGridFormat.ts";
import { JewelOverlay } from "./jewelOverlay.ts";
import { JEWEL_CATALOG_MAP } from "../data/jewels.ts";
import { OBLIVION_ORB } from "../data/materials.ts";
import { RESPEC_DIAMOND_COST } from "../core/saveManager.ts";
import { MasteryChoicePanel } from "./masteryChoicePanel.ts";

export const PANEL_X = 545;
const PANEL_W = 400;

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

/**
 * The fixed right-hand side panel of the passive tree: node details, unlock/forget/
 * reset/socket buttons, and the mastery choice picker. Lives on the scene's UI camera
 * (objects collected in {@link objects}) so it never scrolls with the tree itself.
 */
export class PassiveGridPanel {
  readonly objects: Phaser.GameObjects.GameObject[] = [];

  private panelName!: Phaser.GameObjects.Text;
  private panelType!: Phaser.GameObjects.Text;
  private panelDesc!: Phaser.GameObjects.Text;
  private panelStats!: Phaser.GameObjects.Text;
  private panelPoints!: Phaser.GameObjects.Text;
  private panelLevelReq!: Phaser.GameObjects.Text;
  private unlockBtn!: Phaser.GameObjects.Text;
  private forgetBtn!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;
  private socketBtn!: Phaser.GameObjects.Text;
  private removeBtn!: Phaser.GameObjects.Text;
  private jewelOverlay!: JewelOverlay;
  private choicePanel!: MasteryChoicePanel;
  private resetArmed = false;

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private getSelected: () => PassiveNodeDef | null,
    private setSelected: (n: PassiveNodeDef | null) => void,
    private redraw: () => void,
  ) {}

  isModalOpen(): boolean {
    return this.jewelOverlay.isOpen();
  }

  create(): void {
    const add = (o: Phaser.GameObjects.Text) => {
      this.objects.push(o);
      return o;
    };

    this.objects.push(
      this.scene.add
        .text(PANEL_X + PANEL_W / 2, 10, "Passive Tree", {
          fontSize: "18px",
          color: "#ffd700",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0),
    );

    this.panelPoints = add(
      this.scene.add.text(PANEL_X, 38, "", {
        fontSize: "16px",
        color: "#90caf9",
        fontStyle: "bold",
      }),
    );
    this.panelName = add(
      this.scene.add.text(PANEL_X, 70, "", {
        fontSize: "16px",
        color: "#ffd700",
        fontStyle: "bold",
      }),
    );
    this.panelType = add(this.scene.add.text(PANEL_X, 94, "", { fontSize: "12px", color: "#aaaaaa" }));
    this.panelDesc = add(
      this.scene.add.text(PANEL_X, 116, "", {
        fontSize: "12px",
        color: "#dddddd",
        wordWrap: { width: PANEL_W - 10 },
      }),
    );
    this.panelStats = add(
      this.scene.add.text(PANEL_X, 176, "", {
        fontSize: "12px",
        color: "#a5d6a7",
        wordWrap: { width: PANEL_W - 10 },
      }),
    );
    this.panelLevelReq = add(
      this.scene.add.text(PANEL_X, 260, "", { fontSize: "12px", color: "#ffb74d" }),
    );

    this.unlockBtn = this.mkButton(310, "Unlock  (1 pt)", "#1a5276", "#2e86c1", () =>
      this.tryUnlock(),
    );
    this.forgetBtn = this.mkButton(310, "Forget", "#7b241c", "#a93226", () => this.tryForget());
    this.resetBtn = this.mkButton(365, "Reset all points", "#4a235a", "#6c3483", () =>
      this.tryResetAll(),
    );
    this.resetBtn.setFontSize(14).setPadding(14, 7, 14, 7);
    this.resetBtn.on("pointerout", () =>
      this.resetBtn.setBackgroundColor(this.resetArmed ? "#922b21" : "#4a235a"),
    );
    this.socketBtn = this.mkButton(310, "Socket Jewel", "#1e6f50", "#27946a", () =>
      this.openSocketPicker(),
    );
    this.removeBtn = this.mkButton(310, "Remove — destroy", "#7b241c", "#a93226", () =>
      this.confirmRemoveSocket(),
    );

    this.jewelOverlay = new JewelOverlay(this.scene, this.mgr, () => this.redraw());
    this.choicePanel = new MasteryChoicePanel(this.scene, this.mgr, () => this.redraw());
  }

  private mkButton(
    y: number,
    label: string,
    bg: string,
    hover: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(PANEL_X + PANEL_W / 2, y, label, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: bg,
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setBackgroundColor(hover));
    btn.on("pointerout", () => btn.setBackgroundColor(bg));
    btn.on("pointerdown", onClick);
    this.objects.push(btn);
    return btn;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  private tryUnlock(): void {
    const node = this.getSelected();
    if (!node) return;
    const choiceId = node.choices ? this.choicePanel.getPending() : undefined;
    if (this.mgr.unlockPassiveNode(node.id, choiceId ?? undefined)) this.redraw();
  }

  private tryForget(): void {
    const node = this.getSelected();
    if (node && this.mgr.forgetPassiveNode(node.id)) this.redraw();
  }

  private tryResetAll(): void {
    if (this.mgr.getSave().currency.diamonds < RESPEC_DIAMOND_COST) return;
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.setText(`Confirm — spend ${RESPEC_DIAMOND_COST}💎?`).setBackgroundColor("#922b21");
      return;
    }
    this.disarmReset();
    this.mgr.respecWithDiamonds();
    this.setSelected(null);
    this.redraw();
  }

  private disarmReset(): void {
    if (!this.resetArmed) return;
    this.resetArmed = false;
    this.resetBtn.setText("Reset all points").setBackgroundColor("#4a235a");
  }

  private openSocketPicker(): void {
    const node = this.getSelected();
    if (node?.type === "jewel-socket") this.jewelOverlay.openPicker(node.id);
  }

  private confirmRemoveSocket(): void {
    const node = this.getSelected();
    if (node?.type !== "jewel-socket") return;
    const instId = this.mgr.getSave().hero.socketedJewels[node.id];
    if (!instId) return;
    const inst = this.mgr.getSave().hero.jewels.find((j) => j.id === instId);
    const def = inst ? JEWEL_CATALOG_MAP.get(inst.defId) : undefined;
    this.jewelOverlay.confirmDestroy(instId, def?.name ?? "this jewel");
  }

  private socketedJewelDef(nodeId: string) {
    const instId = this.mgr.getSave().hero.socketedJewels[nodeId];
    if (!instId) return null;
    const inst = this.mgr.getSave().hero.jewels.find((j) => j.id === instId);
    return inst ? (JEWEL_CATALOG_MAP.get(inst.defId) ?? null) : null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  refresh(
    unlockedSet: Set<string>,
    reachableSet: Set<string>,
    heroLevel: number,
    skillPoints: number,
  ): void {
    this.panelPoints.setText(`Skill points: ${skillPoints}`);

    this.resetBtn.setVisible(unlockedSet.size > 0);
    if (unlockedSet.size === 0) this.disarmReset();
    if (!this.resetArmed) {
      const afford = this.mgr.getSave().currency.diamonds >= RESPEC_DIAMOND_COST;
      this.resetBtn.setText(
        afford ? `Reset all  (${RESPEC_DIAMOND_COST}💎)` : `Reset all — need ${RESPEC_DIAMOND_COST}💎`,
      );
      this.resetBtn.setAlpha(afford ? 1 : 0.45);
    }

    const node = this.getSelected();
    if (!node) {
      this.panelName.setText("Select a node");
      this.panelType.setText("");
      this.panelDesc.setText("");
      this.panelStats.setText("");
      this.panelLevelReq.setText("");
      this.unlockBtn.setVisible(false);
      this.forgetBtn.setVisible(false);
      this.socketBtn.setVisible(false);
      this.removeBtn.setVisible(false);
      this.choicePanel.clear();
      return;
    }

    const isUnlocked = unlockedSet.has(node.id);
    const isReachable = reachableSet.has(node.id);
    const levelLocked = (node.unlockAtLevel ?? 0) > heroLevel;
    const regionColor = "#" + (REGION_COLOR[node.region] ?? 0x888888).toString(16).padStart(6, "0");

    this.panelName.setText(node.name).setColor(regionColor);
    this.panelType.setText(`${node.type.toUpperCase()}  ·  ${node.region}`);
    this.panelDesc.setText(node.description);
    this.panelStats.setText(formatStatBonuses(node)).setColor("#a5d6a7");

    if (node.choices && node.choices.length > 0) {
      this.panelStats.setText("");
      this.choicePanel.render(node, isUnlocked);
    } else {
      this.choicePanel.clear();
    }

    this.panelLevelReq.setText(levelLocked ? `Requires level ${node.unlockAtLevel}` : "");

    const isJewel = node.type === "jewel-socket";
    const canUnlock = !isUnlocked && isReachable && !levelLocked && skillPoints > 0;
    this.unlockBtn.setVisible(!isUnlocked && (isReachable || levelLocked));
    this.unlockBtn.setAlpha(canUnlock ? 1 : 0.4);

    const orbs = this.mgr.getMaterial(OBLIVION_ORB);
    const forgettable =
      isUnlocked && !isJewel && orbs > 0 && canForgetNode([...unlockedSet], node.id);
    this.forgetBtn.setVisible(isUnlocked && !isJewel);
    this.forgetBtn.setText(orbs > 0 ? `Forget  (Orb ×${orbs})` : "Forget — need Oblivion Orb");
    this.forgetBtn.setAlpha(forgettable ? 1 : 0.4);

    const jewelDef = isJewel && isUnlocked ? this.socketedJewelDef(node.id) : null;
    this.socketBtn.setVisible(isJewel && isUnlocked && !jewelDef);
    this.removeBtn.setVisible(isJewel && isUnlocked && !!jewelDef);
    if (isJewel && isUnlocked) {
      this.panelStats
        .setText(
          jewelDef
            ? `Socketed: ${jewelDef.name}\n${jewelDef.description}`
            : "Empty socket — socket a jewel to empower your hero and towers.",
        )
        .setColor(jewelDef ? "#80d8ff" : "#a5d6a7");
    }

    if (isUnlocked && !node.choices) {
      this.panelLevelReq.setText("✓ Unlocked").setColor("#a5d6a7");
    }
  }
}
