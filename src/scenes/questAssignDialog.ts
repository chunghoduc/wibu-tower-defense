/**
 * questAssignDialog — modal tower picker for an Expedition quest. Shows the
 * quest's rarity slots and a grid of eligible spare towers (rarity ≥ each slot's
 * floor, not in the squad, not locked by another quest). The player taps to fill
 * slots; when the picked set satisfies every slot, Dispatch fires the onConfirm
 * callback with the chosen tower ids. Owns its own container; close() tears it
 * down. Kept separate so ExpeditionScene stays under the 500-line cap.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { addNamePlate } from "./namePlate.ts";
import { dimBackdrop } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import type { QuestInstance } from "../data/expeditionQuests.ts";
import { assignmentMeetsSlots } from "../core/expeditionBoard.ts";
import { TOWERS } from "../data/towers.ts";
import { getTowerStars } from "../core/collection.ts";
import { towerTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";
import type { Rarity } from "../data/schemaEnums.ts";

const W = 960;
const H = 540;

export class QuestAssignDialog {
  private root: Phaser.GameObjects.Container;
  private picked: string[] = [];

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private quest: QuestInstance,
    private onConfirm: (towerIds: string[]) => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(400);
    this.draw();
  }

  close(): void {
    this.root.destroy(true);
  }

  private toggle(id: string): void {
    const i = this.picked.indexOf(id);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length < this.quest.slots.length) this.picked.push(id);
    this.draw();
  }

  private draw(): void {
    this.root.removeAll(true);
    // Backdrop blocks clicks to the board behind.
    dimBackdrop(this.scene, this.root, undefined, 0.6);
    const px = 40,
      py = 40,
      pw = W - 80,
      ph = H - 80;
    const g = this.scene.add.graphics();
    g.fillStyle(0x121a26, 1).fillRoundedRect(px, py, pw, ph, 14);
    g.lineStyle(2, RARITY_INT[this.quest.rarity], 1).strokeRoundedRect(px, py, pw, ph, 14);
    this.root.add(g);

    this.root.add(
      crispText(this.scene, W / 2, py + 14, `Assign — ${this.quest.rarity} Expedition`, {
        fontSize: "20px",
        color: RARITY_HEX[this.quest.rarity],
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );

    // Slot requirement chips.
    const slotsLabel = this.quest.slots.map((s, i) => `${i + 1}: ≥${s}`).join("    ");
    this.root.add(
      crispText(this.scene, W / 2, py + 44, `Slots — ${slotsLabel}`, {
        fontSize: "13px",
        color: "#cfe0f5",
      }).setOrigin(0.5, 0),
    );

    this.drawGrid(px, py + 76, pw);

    // Footer: validity + Dispatch / Cancel.
    const valid = assignmentMeetsSlots(this.mgr.getSave(), this.quest, this.picked);
    const full = this.picked.length === this.quest.slots.length;
    this.root.add(
      crispText(
        this.scene,
        px + 20,
        py + ph - 30,
        `Picked ${this.picked.length}/${this.quest.slots.length}` +
          (full && !valid ? " — picks don't meet the rarity slots" : ""),
        { fontSize: "13px", color: valid ? "#9fe0b0" : "#ffd56a" },
      ),
    );
    this.dialogButton(px + pw - 230, py + ph - 34, "Cancel", "#5a3a3a", true, () => this.close());
    this.dialogButton(px + pw - 110, py + ph - 34, "Dispatch", "#1f8f43", valid, () => {
      this.onConfirm([...this.picked]);
      this.close();
    });
  }

  private drawGrid(x0: number, y0: number, areaW: number): void {
    const save = this.mgr.getSave();
    // Union of every tower eligible for ANY slot (so the player sees the full bench).
    const seen = new Set<string>();
    for (const slot of this.quest.slots)
      for (const id of this.mgr.expeditionEligibleForSlot(slot, [])) seen.add(id);
    const owned = TOWERS.filter((t) => seen.has(t.id)).sort(
      (a, b) => RARITY_INT[b.rarity] - RARITY_INT[a.rarity] || a.name.localeCompare(b.name),
    );
    if (owned.length === 0) {
      this.root.add(
        crispText(
          this.scene,
          x0 + 20,
          y0,
          "No spare heroes meet these slots — free up squad towers or summon more.",
          { fontSize: "13px", color: "#90a4bb", wordWrap: { width: areaW - 40 } },
        ),
      );
      return;
    }
    const COLS = 7,
      CW = 122,
      CH = 92,
      startX = x0 + 24,
      maxRows = 3;
    owned.slice(0, COLS * maxRows).forEach((t, idx) => {
      const cx = startX + (idx % COLS) * CW;
      const cy = y0 + Math.floor(idx / COLS) * CH;
      this.root.add(
        this.makeTile(t.id, t.name, t.rarity, cx, cy, CW - 12, CH - 12, getTowerStars(save, t.id)),
      );
    });
  }

  private makeTile(
    id: string,
    name: string,
    rarity: Rarity,
    cx: number,
    cy: number,
    w: number,
    h: number,
    stars: number,
  ): Phaser.GameObjects.Container {
    const order = this.picked.indexOf(id);
    const picked = order >= 0;
    const c = this.scene.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
    const g = this.scene.add.graphics();
    g.fillStyle(picked ? 0x1f3322 : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(
      picked ? 3 : 1.5,
      picked ? 0x52c878 : RARITY_INT[rarity],
      picked ? 1 : 0.85,
    ).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    c.add(g);
    const key = towerTex(id);
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(0, -10, key).setOrigin(0.5);
      img.setScale(44 / img.height);
      c.add(img);
    }
    addNamePlate(this.scene, c, name, {
      width: w,
      topY: h / 2 - 24,
      height: 24,
      radius: 6,
      accent: RARITY_INT[rarity],
      color: RARITY_HEX[rarity],
      basePx: 9,
      minPx: 7,
      maxLines: 2,
    });
    if (stars > 0)
      c.add(
        crispText(this.scene, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), {
          fontSize: "9px",
          color: "#ffd24a",
        }),
      );
    if (picked)
      c.add(
        crispText(this.scene, w / 2 - 6, -h / 2 + 3, `${order + 1}`, {
          fontSize: "12px",
          color: "#a5f0b8",
          fontStyle: "bold",
        }).setOrigin(1, 0),
      );
    c.setInteractive({ useHandCursor: true });
    c.on("pointerup", () => this.toggle(id));
    return c;
  }

  private dialogButton(
    x: number,
    y: number,
    label: string,
    color: string,
    enabled: boolean,
    cb: () => void,
  ): void {
    const t = crispText(this.scene, x, y, label, {
      fontSize: "15px",
      color: enabled ? "#ffffff" : "#7a8699",
      backgroundColor: enabled ? color : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(0, 0)
      .setPadding(14, 7, 14, 7);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
      t.on("pointerup", cb);
    }
    this.root.add(t);
  }
}
