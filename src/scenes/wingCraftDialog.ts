/**
 * Craft Wings overlay — pick ≥5 component items, choose 1–4 Jewels of Chaos, see
 * the live success % + outcome odds, and forge. The caller owns inventory access,
 * the live preview math, and the actual craft (confirm); this module owns only the
 * selection UI + preview rendering. Visual language mirrors autoRecycleDialog.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import type { Rarity } from "../data/schema.ts";

export interface WingCraftItem {
  id: string;
  defId: string;
  name: string;
  rarity: Rarity;
}

export interface WingCraftPreview {
  success: number; // 0..1
  odds: { rarity: Rarity; chance: number }[];
}

export interface WingCraftOpts {
  items: WingCraftItem[];
  jewelsOwned: number;
  feathersOwned: number;
  /** success % + outcome odds for the current selection. */
  preview(selectedIds: string[], jewels: number): WingCraftPreview;
  /** perform the craft; the caller redraws/closes the dialog afterwards. */
  confirm(selectedIds: string[], jewels: number): void;
  onClose(): void;
}

const PANEL = 0x9a59d6; // chaos violet accent
const COLS = 11;
const CELL = 46;
const MAX_TILES = 44;

export function openWingCraftDialog(
  scene: Phaser.Scene,
  opts: WingCraftOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width,
    H = scene.scale.height;
  const selected = new Set<string>();
  const jewelCap = Math.min(4, Math.max(1, opts.jewelsOwned));
  let jewels = jewelCap;

  const c = scene.add.container(0, 0).setDepth(320);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78).fillRect(0, 0, W, H);
  const dimZone = scene.add
    .zone(W / 2, H / 2, W, H)
    .setInteractive()
    .on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  const bw = 560,
    bh = 420,
    bx = (W - bw) / 2,
    by = (H - bh) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(0x141022, 0.99).fillRoundedRect(bx, by, bw, bh, 12);
  panel.lineStyle(2, PANEL, 1).strokeRoundedRect(bx, by, bw, bh, 12);
  const panelZone = scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive();
  c.add([panel, panelZone]);

  c.add(
    crispText(scene, W / 2, by + 14, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );
  c.add(
    crispText(
      scene,
      W / 2,
      by + 38,
      `Jewel of Chaos: ${opts.jewelsOwned}   ·   Feather: ${opts.feathersOwned}`,
      { fontSize: "12px", color: "#c9b8e6" },
    ).setOrigin(0.5, 0),
  );

  // Item grid (tap to toggle). Shows up to MAX_TILES non-equipped items.
  const gridX = bx + 20,
    gridY = by + 64;
  const tiles: { it: WingCraftItem; ring: Phaser.GameObjects.Graphics; x: number; y: number }[] =
    [];
  opts.items.slice(0, MAX_TILES).forEach((it, n) => {
    const cxp = gridX + (n % COLS) * CELL,
      cyp = gridY + Math.floor(n / COLS) * CELL;
    if (scene.textures.exists(itemTex(it.defId))) {
      c.add(scene.add.image(cxp + 20, cyp + 20, itemTex(it.defId)).setDisplaySize(40, 40));
    }
    const ring = scene.add.graphics();
    c.add(ring);
    const z = scene.add
      .zone(cxp, cyp, CELL - 2, CELL - 2)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (selected.has(it.id)) selected.delete(it.id);
      else selected.add(it.id);
      render();
    });
    tiles.push({ it, ring, x: cxp, y: cyp });
  });

  if (opts.items.length > MAX_TILES) {
    c.add(
      crispText(scene, bx + 20, gridY + 4 * CELL + 2, `+${opts.items.length - MAX_TILES} more…`, {
        fontSize: "10px",
        color: "#8a7a9a",
      }),
    );
  }

  const jewelText = crispText(scene, bx + 20, by + bh - 96, "", {
    fontSize: "13px",
    color: "#e9d5ff",
  });
  c.add(jewelText);
  chip(scene, c, bx + 232, by + bh - 100, "−", () => {
    jewels = Math.max(1, jewels - 1);
    render();
  });
  chip(scene, c, bx + 272, by + bh - 100, "+", () => {
    jewels = Math.min(jewelCap, jewels + 1);
    render();
  });

  const previewText = crispText(scene, bx + 20, by + bh - 64, "", {
    fontSize: "13px",
    color: "#ffe6a0",
  });
  c.add(previewText);

  const craftBtn = crispText(scene, bx + 20, by + bh - 36, "🔨 Forge Wings", {
    fontSize: "15px",
    color: "#fff",
    backgroundColor: "#6a2fa0",
    fixedWidth: bw - 150,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 9, 0, 9)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!isValid()) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const cancel = crispText(scene, bx + bw - 64, by + bh - 32, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  cancel.on("pointerup", () => opts.onClose());
  c.add(cancel);

  function isValid(): boolean {
    return selected.size >= 5 && opts.feathersOwned >= 1 && opts.jewelsOwned >= jewels;
  }

  function render(): void {
    for (const t of tiles) {
      const on = selected.has(t.it.id);
      const col = RARITY_INT[t.it.rarity];
      t.ring.clear();
      t.ring.lineStyle(on ? 3 : 1, on ? 0xffffff : col, on ? 1 : 0.6);
      t.ring.strokeRoundedRect(t.x, t.y, CELL - 2, CELL - 2, 6);
    }
    jewelText.setText(`Jewels of Chaos: ${jewels}  (each extra +10% success)`);
    const p = opts.preview([...selected], jewels);
    const oddsLine = p.odds.map((o) => `${Math.round(o.chance * 100)}% ${o.rarity}`).join(" · ");
    previewText.setText(
      selected.size < 5
        ? `Select ${5 - selected.size} more item(s)  ·  min 5`
        : `Success ${Math.round(p.success * 100)}%   →   ${oddsLine}`,
    );
    const enabled = isValid();
    craftBtn
      .setColor(enabled ? "#fff" : "#8a7a9a")
      .setBackgroundColor(enabled ? "#6a2fa0" : "#2a2140");
  }

  render();
  return c;
}

function chip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  cb: () => void,
): void {
  const t = crispText(scene, x, y, label, {
    fontSize: "16px",
    color: "#fff",
    backgroundColor: "#3a2a55",
    fixedWidth: 32,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 5, 0, 5)
    .setInteractive({ useHandCursor: true });
  t.on("pointerup", cb);
  c.add(t);
}
