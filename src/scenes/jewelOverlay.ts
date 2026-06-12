import type Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { JEWEL_CATALOG_MAP } from "../data/jewels.ts";
import { jewelIconKey } from "../data/jewelIconManifest.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addNamePlate } from "./namePlate.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_TINT: Record<Rarity, number> = {
  Common: 0x9e9e9e,
  Magic: 0x4f8cff,
  Rare: 0xb066ff,
  Legendary: 0xffb04a,
  Unique: 0xff5252,
};

/**
 * Modal overlay for the jewel system: a picker (choose an owned jewel to socket
 * into an allocated socket) and a destroy-confirm (removing a jewel destroys it
 * forever). Built as a self-destructing container so it leaves no residue, and
 * its dim backdrop swallows clicks so the tree underneath stays inert while open.
 */
export class JewelOverlay {
  private root: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mgr: SaveManager,
    private readonly onChange: () => void,
  ) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  close(): void {
    this.root?.destroy(true);
    this.root = null;
  }

  /** Picker: list owned, un-socketed jewels; clicking one sockets it into nodeId. */
  openPicker(nodeId: string): void {
    this.close();
    const { cx, cy, panel } = this.frame("Socket a Jewel", 560, 380);

    const save = this.mgr.getSave();
    const socketed = new Set(Object.values(save.hero.socketedJewels));
    const owned = save.hero.jewels.filter((j) => !socketed.has(j.id));

    if (owned.length === 0) {
      panel.add(
        this.scene.add
          .text(cx, cy, "No spare jewels.\nWin battles to find more.", {
            fontSize: "14px",
            color: "#aaaaaa",
            align: "center",
          })
          .setOrigin(0.5),
      );
      return;
    }

    // A simple grid of jewel tiles (5 columns). Owned jewel counts stay modest.
    const cols = 5;
    const tileW = 100,
      tileH = 88;
    const startX = cx - ((Math.min(cols, owned.length) - 1) / 2) * tileW;
    const startY = cy - 120;
    owned.slice(0, 20).forEach((inst, i) => {
      const def = JEWEL_CATALOG_MAP.get(inst.defId);
      if (!def) return;
      const tx = startX + (i % cols) * tileW;
      const ty = startY + Math.floor(i / cols) * tileH;
      panel.add(
        this.jewelTile(
          tx,
          ty,
          inst.defId,
          def.name,
          def.rarity,
          () => {
            this.mgr.socketJewel(nodeId, inst.id);
            this.onChange();
            this.close();
          },
          () => this.confirmDestroy(inst.id, def.name),
        ),
      );
    });
    panel.add(
      this.scene.add
        .text(cx, cy + 150, "Click a jewel to socket it.  Click ✕ to destroy it forever.", {
          fontSize: "11px",
          color: "#888888",
        })
        .setOrigin(0.5),
    );
  }

  /** Destroy-confirm: removing a jewel discards it permanently — no refund. */
  confirmDestroy(jewelInstanceId: string, name: string): void {
    this.close();
    const { cx, cy, panel } = this.frame("Destroy Jewel", 460, 220);

    panel.add(
      this.scene.add
        .text(cx, cy - 40, `Destroy "${name}" forever?\nThis cannot be undone.`, {
          fontSize: "15px",
          color: "#ffcdd2",
          align: "center",
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );

    panel.add(
      this.button(cx - 90, cy + 40, "Destroy", "#922b21", "#c0392b", () => {
        this.mgr.discardJewel(jewelInstanceId);
        this.onChange();
        this.close();
      }),
    );
    panel.add(this.button(cx + 90, cy + 40, "Cancel", "#37474f", "#546e7a", () => this.close()));
  }

  // ── building blocks ─────────────────────────────────────────────────────────

  /** Dim backdrop + centered panel; returns the panel container + its centre. */
  private frame(
    title: string,
    w: number,
    h: number,
  ): { cx: number; cy: number; panel: Phaser.GameObjects.Container } {
    const W = this.scene.scale.width,
      H = this.scene.scale.height;
    const root = this.scene.add.container(0, 0).setDepth(1000);
    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive(); // swallow clicks to the tree
    dim.on("pointerdown", () => {
      /* click-off does nothing; use Cancel/socket */
    });
    const cx = W / 2,
      cy = H / 2;
    const bg = this.scene.add
      .rectangle(cx, cy, w, h, 0x14181f, 0.98)
      .setStrokeStyle(2, 0x80d8ff, 0.8);
    const titleText = this.scene.add
      .text(cx, cy - h / 2 + 18, title, {
        fontSize: "17px",
        color: "#80d8ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const closeX = this.scene.add
      .text(cx + w / 2 - 18, cy - h / 2 + 6, "✕", {
        fontSize: "16px",
        color: "#ff8a80",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeX.on("pointerdown", () => this.close());
    const panel = this.scene.add.container(0, 0);
    root.add([dim, bg, titleText, closeX, panel]);
    this.root = root;
    return { cx, cy, panel };
  }

  private jewelTile(
    x: number,
    y: number,
    defId: string,
    name: string,
    rarity: Rarity,
    onPick: () => void,
    onDestroy: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const tint = RARITY_TINT[rarity] ?? 0x9e9e9e;
    const cell = this.scene.add
      .rectangle(0, 0, 88, 84, 0x1d2330, 1)
      .setStrokeStyle(2, tint, 0.9)
      .setInteractive({ useHandCursor: true });
    cell.on("pointerover", () => cell.setFillStyle(0x2a3346));
    cell.on("pointerout", () => cell.setFillStyle(0x1d2330));
    cell.on("pointerdown", onPick);
    c.add(cell);

    // Shared scale-to-fill rule (matches bag/shop/loot) so a jewel reads the
    // same size everywhere; falls back to the emoji only if its art is missing.
    c.add(makeFitIcon(this.scene, 0, -18, jewelIconKey(defId), 46, "💠"));
    // Name lives in a reserved plate band so long jewel names never spill off.
    addNamePlate(this.scene, c, name, {
      width: 88,
      topY: 42 - 28,
      height: 28,
      radius: 3,
      accent: tint,
      color: "#e6e9ef",
      basePx: 10,
      minPx: 7,
      maxLines: 2,
    });

    // ✕ destroy affordance (top-right of the tile).
    const del = this.scene.add
      .text(36, -38, "✕", { fontSize: "12px", color: "#ff8a80" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    del.on("pointerdown", onDestroy);
    c.add(del);
    return c;
  }

  private button(
    x: number,
    y: number,
    label: string,
    bg: string,
    hover: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, label, {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: bg,
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setBackgroundColor(hover));
    t.on("pointerout", () => t.setBackgroundColor(bg));
    t.on("pointerdown", onClick);
    return t;
  }
}
