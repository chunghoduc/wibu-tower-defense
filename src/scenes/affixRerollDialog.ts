/**
 * affixRerollDialog — the Forge "Reroll Affixes" modal. Two columns: a scrollable
 * list of reroll-eligible items on the left (each with its own escalating entropy
 * cost + a reroll-count badge), and a detail panel on the right that shows the
 * selected item's current affixes, the cost to re-roll it, a big REROLL button, and
 * — after a reroll — a Previous → New comparison so the player sees exactly what
 * changed. The dialog stays open for chain-rerolling.
 *
 * Pure data comes from rerollView (the VM list + affix rows); this file only
 * presents it and wires the reroll callback back to the scene. All scene listeners
 * (drag-scroll) are torn down on close.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { dimBackdrop } from "./uiKit.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import { SOURCE_COLOR, type ItemStatRow } from "../data/itemDisplay.ts";
import { renderAffixRows, renderComparison } from "./rerollAffixRender.ts";
import type { RerollItemVM } from "../data/rerollView.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import { materialTex, itemTex } from "../data/assetKeys.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { Rarity } from "../data/schema.ts";

/** Resolve an item's texture key from its def id (empty → emoji fallback). */
function itemTexFor(defId: string): string {
  const def = ITEM_CATALOG_MAP.get(defId);
  return def ? itemTex(def.id) : "";
}

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc",
  Magic: "#5fa8ff",
  Rare: "#c98bff",
  Legendary: "#ffb74d",
  Unique: "#ff7a7a",
};
const ENTROPY_HEX = "#ff9db0";
const GOLD_HEX = "#ffd24a";

export interface RerollState {
  items: RerollItemVM[];
  entropy: number;
  gold: number;
}
export interface RerollOutcome {
  ok: boolean;
  before: ItemStatRow[];
  after: ItemStatRow[];
}
export interface AffixRerollDialogOpts {
  state: () => RerollState;
  /** Current secondary-affix rows for the item id (before any reroll this session). */
  affixRows: (id: string) => ItemStatRow[];
  reroll: (id: string) => RerollOutcome;
  onClose: () => void;
}
export interface AffixRerollHandle {
  destroy: () => void;
}

// Layout (960×540 canvas).
const PX = 40,
  PY = 34,
  PW = 880,
  PH = 472;
const LIST_X = PX + 16,
  LIST_Y = PY + 78,
  LIST_W = 300,
  ROW_H = 54,
  VISIBLE = 6;
const DET_X = LIST_X + LIST_W + 16,
  DET_W = PX + PW - 16 - (LIST_X + LIST_W + 16);

export function openAffixRerollDialog(
  scene: Phaser.Scene,
  opts: AffixRerollDialogOpts,
): AffixRerollHandle {
  const root = scene.add.container(0, 0).setDepth(320);
  dimBackdrop(scene, root, () => close());

  // Persistent frame.
  const frame = scene.add.graphics();
  frame.fillStyle(0x101521, 0.99).fillRoundedRect(PX, PY, PW, PH, 14);
  frame.lineStyle(2, 0xd64f6a, 1).strokeRoundedRect(PX, PY, PW, PH, 14);
  // List well + detail well backers.
  frame
    .fillStyle(0x0b101a, 0.9)
    .fillRoundedRect(LIST_X - 6, LIST_Y - 6, LIST_W + 12, ROW_H * VISIBLE + 12, 10);
  frame
    .fillStyle(0x131a27, 0.9)
    .fillRoundedRect(DET_X - 6, LIST_Y - 6, DET_W + 12, ROW_H * VISIBLE + 12, 10);
  root.add(frame);

  // Dynamic layers (rebuilt on every redraw).
  const listLayer = scene.add.container(0, 0);
  const detailLayer = scene.add.container(0, 0);
  const headerLayer = scene.add.container(0, 0);
  root.add([listLayer, detailLayer, headerLayer]);

  let offset = 0;
  let selectedId: string | null = null;
  // before/after of the most recent reroll on the currently-selected item
  let outcome: RerollOutcome | null = null;

  const maxOffset = () => Math.max(0, opts.state().items.length - VISIBLE);

  function close(): void {
    scroll.destroy();
    root.destroy(true);
    opts.onClose();
  }

  // ---- header (balances + close) -------------------------------------------
  function drawHeader(): void {
    headerLayer.removeAll(true);
    const st = opts.state();
    headerLayer.add(
      crispText(scene, PX + 16, PY + 14, "🎲 Reroll Affixes", {
        fontSize: "17px",
        color: "#ffe1a8",
        fontStyle: "bold",
      }),
    );
    headerLayer.add(
      crispText(scene, PX + 16, PY + 40, "Spend Jewel of Entropy to re-roll an item's affixes.", {
        fontSize: "11px",
        color: "#9fb0c4",
      }),
    );
    // balances, right-aligned
    const balX = PX + PW - 16;
    headerLayer.add(makeFitIcon(scene, balX - 150, PY + 22, materialTex(CHAOS_JEWEL), 20, "❖"));
    headerLayer.add(
      crispText(scene, balX - 134, PY + 22, `${st.entropy}`, {
        fontSize: "15px",
        color: ENTROPY_HEX,
        fontStyle: "bold",
      }).setOrigin(0, 0.5),
    );
    headerLayer.add(
      crispText(scene, balX - 56, PY + 22, `🪙 ${st.gold}`, {
        fontSize: "14px",
        color: GOLD_HEX,
        fontStyle: "bold",
      }).setOrigin(0, 0.5),
    );
    const x = crispText(scene, balX, PY + 44, "✕ Close", { fontSize: "13px", color: "#ff9db0" })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    x.on("pointerup", () => close());
    headerLayer.add(x);
  }

  // ---- left list -----------------------------------------------------------
  function drawList(): void {
    listLayer.removeAll(true);
    const items = opts.state().items;
    if (items.length === 0) {
      listLayer.add(
        crispText(
          scene,
          LIST_X + LIST_W / 2,
          LIST_Y + 60,
          "No Rare+ gear to reroll.\nFind or keep rarer gear.",
          {
            fontSize: "12px",
            color: "#7c8aa0",
            align: "center",
          },
        ).setOrigin(0.5),
      );
      return;
    }
    offset = Math.min(offset, maxOffset());
    const slice = items.slice(offset, offset + VISIBLE);
    slice.forEach((vm, i) => listLayer.add(buildRow(vm, LIST_Y + i * ROW_H)));
    // scroll affordance
    if (items.length > VISIBLE) {
      listLayer.add(
        crispText(
          scene,
          LIST_X + LIST_W - 4,
          LIST_Y - 20,
          `${offset + 1}–${Math.min(offset + VISIBLE, items.length)}/${items.length}  ⇕`,
          {
            fontSize: "10px",
            color: "#7c8aa0",
          },
        ).setOrigin(1, 0),
      );
    }
  }

  function buildRow(vm: RerollItemVM, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(0, 0);
    const selected = vm.id === selectedId;
    const g = scene.add.graphics();
    g.fillStyle(selected ? 0x26303f : 0x161d2a, 0.96).fillRoundedRect(
      LIST_X,
      y,
      LIST_W,
      ROW_H - 6,
      8,
    );
    g.lineStyle(
      selected ? 2 : 1,
      selected ? 0xffc94d : RARITY_INT[vm.rarity],
      selected ? 1 : 0.6,
    ).strokeRoundedRect(LIST_X, y, LIST_W, ROW_H - 6, 8);
    c.add(g);
    c.add(makeFitIcon(scene, LIST_X + 22, y + (ROW_H - 6) / 2, itemTexFor(vm.defId), 32, "▣"));
    c.add(
      crispText(scene, LIST_X + 44, y + 7, vm.name, {
        fontSize: "12px",
        color: RARITY_HEX[vm.rarity],
        fontStyle: "bold",
      }).setFixedSize(LIST_W - 52, 14),
    );
    c.add(
      crispText(
        scene,
        LIST_X + 44,
        y + 24,
        `${vm.slot}${vm.enhanceLevel ? ` +${vm.enhanceLevel}` : ""}  ·  ↻×${vm.rerollCount}`,
        {
          fontSize: "10px",
          color: "#9fb0c4",
        },
      ),
    );
    c.add(
      crispText(scene, LIST_X + LIST_W - 8, y + 24, `❖${vm.entropyCost}`, {
        fontSize: "11px",
        color: vm.affordable ? ENTROPY_HEX : "#7c8aa0",
        fontStyle: "bold",
      }).setOrigin(1, 0),
    );
    const zone = scene.add
      .zone(LIST_X + LIST_W / 2, y + (ROW_H - 6) / 2, LIST_W, ROW_H - 6)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => {
      if (scroll.didScroll()) return;
      if (selectedId !== vm.id) {
        selectedId = vm.id;
        outcome = null; // fresh selection clears the previous before/after
        redraw();
      }
    });
    c.add(zone);
    return c;
  }

  // ---- right detail --------------------------------------------------------
  function drawDetail(): void {
    detailLayer.removeAll(true);
    const st = opts.state();
    const vm = st.items.find((v) => v.id === selectedId) ?? null;
    if (!vm) {
      detailLayer.add(
        crispText(
          scene,
          DET_X + DET_W / 2,
          LIST_Y + (ROW_H * VISIBLE) / 2 - 10,
          "Select an item to reroll",
          {
            fontSize: "13px",
            color: "#7c8aa0",
          },
        ).setOrigin(0.5),
      );
      return;
    }
    let y = LIST_Y + 4;
    // title
    detailLayer.add(makeFitIcon(scene, DET_X + 22, y + 14, itemTexFor(vm.defId), 38, "▣"));
    detailLayer.add(
      crispText(scene, DET_X + 48, y, vm.name, {
        fontSize: "15px",
        color: RARITY_HEX[vm.rarity],
        fontStyle: "bold",
        wordWrap: { width: DET_W - 56 },
      }),
    );
    detailLayer.add(
      crispText(
        scene,
        DET_X + 48,
        y + 19,
        `${vm.rarity} ${vm.slot}${vm.weaponType ? ` (${vm.weaponType})` : ""}${vm.enhanceLevel ? `  +${vm.enhanceLevel}` : ""}  ·  Rerolled ×${vm.rerollCount}`,
        {
          fontSize: "10px",
          color: "#9fb0c4",
        },
      ),
    );
    y += 44;

    if (outcome && outcome.ok) {
      y = renderComparison(scene, detailLayer, DET_X, DET_W, y, outcome.before, outcome.after);
    } else {
      detailLayer.add(
        crispText(scene, DET_X, y, "Current Affixes", {
          fontSize: "11px",
          color: SOURCE_COLOR.affix,
          fontStyle: "bold",
        }),
      );
      y += 16;
      y = renderAffixRows(scene, detailLayer, opts.affixRows(vm.id), DET_X + 8, y);
    }

    // preservation note
    y += 4;
    detailLayer.add(
      crispText(
        scene,
        DET_X,
        y,
        "Only affixes change — primary affix, base stats, enhancement & level are kept.",
        {
          fontSize: "9px",
          color: "#7c8aa0",
          fontStyle: "italic",
          wordWrap: { width: DET_W },
        },
      ),
    );

    // cost + button pinned near the bottom of the detail well
    drawCostAndButton(vm, st);
  }

  function drawCostAndButton(vm: RerollItemVM, st: RerollState): void {
    const by = LIST_Y + ROW_H * VISIBLE - 52;
    const short = !vm.affordable;
    const costLine = `Cost:  ❖ ${vm.entropyCost}   +   🪙 ${vm.goldCost}`;
    detailLayer.add(
      crispText(scene, DET_X, by, costLine, {
        fontSize: "12px",
        color: short ? "#ff7a7a" : "#cfe0f4",
        fontStyle: "bold",
      }),
    );
    if (short) {
      const needE = Math.max(0, vm.entropyCost - st.entropy);
      const needG = Math.max(0, vm.goldCost - st.gold);
      const parts = [needE ? `❖ ${needE}` : "", needG ? `🪙 ${needG}` : ""]
        .filter(Boolean)
        .join(" + ");
      detailLayer.add(
        crispText(scene, DET_X, by + 16, `Need ${parts} more`, {
          fontSize: "10px",
          color: "#ff7a7a",
        }),
      );
    } else {
      detailLayer.add(
        crispText(scene, DET_X, by + 16, "Each reroll on this item raises its price.", {
          fontSize: "10px",
          color: "#7c8aa0",
        }),
      );
    }
    // big button, right-aligned
    const bw = 168,
      bh = 38,
      bx = DET_X + DET_W - bw,
      bby = by - 4;
    const g = scene.add.graphics();
    g.fillStyle(short ? 0x2a3142 : 0xb5384f, 1).fillRoundedRect(bx, bby, bw, bh, 9);
    g.lineStyle(2, short ? 0x3a4252 : 0xff9db0, 1).strokeRoundedRect(bx, bby, bw, bh, 9);
    detailLayer.add(g);
    detailLayer.add(
      crispText(
        scene,
        bx + bw / 2,
        bby + bh / 2,
        short ? "Reroll" : `🎲 REROLL  ❖${vm.entropyCost}`,
        {
          fontSize: "14px",
          color: short ? "#6b7a8d" : "#ffffff",
          fontStyle: "bold",
        },
      ).setOrigin(0.5),
    );
    if (!short) {
      const zone = scene.add
        .zone(bx + bw / 2, bby + bh / 2, bw, bh)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", () => {
        const res = opts.reroll(vm.id);
        if (res.ok) outcome = res;
        redraw();
      });
      detailLayer.add(zone);
    }
  }

  function redraw(): void {
    drawHeader();
    drawList();
    drawDetail();
  }

  // wheel scroll over the list
  const onWheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
    const next = Phaser.Math.Clamp(offset + (dy > 0 ? 1 : -1), 0, maxOffset());
    if (next !== offset) {
      offset = next;
      drawList();
    }
  };
  scene.input.on("wheel", onWheel);

  const scroll: DragScrollHandle = attachDragScroll(scene, {
    rect: () => ({ x: LIST_X, y: LIST_Y, w: LIST_W, h: ROW_H * VISIBLE }),
    rowH: ROW_H,
    maxOffset,
    getOffset: () => offset,
    setOffset: (n) => (offset = n),
    onChange: () => drawList(),
  });

  // auto-select the first item for an instant, friendly state
  const first = opts.state().items[0];
  if (first) selectedId = first.id;
  redraw();

  return {
    destroy: () => {
      scene.input.off("wheel", onWheel);
      close();
    },
  };
}
