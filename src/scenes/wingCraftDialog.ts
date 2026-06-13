/**
 * Craft Wings — a drag-and-drop craft machine. Drag inventory items and the two
 * materials (Jewel of Chaos, Feather) from the tray INTO the central machine; the
 * Forge button unlocks only when the gate passes (≥5 items + a jewel + the
 * feather). A live readout shows the success rate and a colored bar of the outcome
 * rarity odds. The caller owns inventory access, the preview math and the actual
 * craft (confirm); this module owns the machine UI only. Geometry + gating come
 * from the pure wingCraftMachine module.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex, materialTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { MAX_JEWELS } from "../core/wingCraft.ts";
import {
  wingCraftGate,
  wingMachineLayout,
  loadedSlotLayout,
  oddsBarSegments,
} from "../core/wingCraftMachine.ts";
import { makeDraggable, drawSocket, machineZoneHit } from "./wingCraftDrag.ts";
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
  preview(selectedIds: string[], jewels: number): WingCraftPreview;
  confirm(selectedIds: string[], jewels: number): void;
  onClose(): void;
}

const ACCENT = 0x9a59d6; // chaos violet
const CELL = 46;

export function openWingCraftDialog(
  scene: Phaser.Scene,
  opts: WingCraftOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const L = wingMachineLayout(W, H);

  // ---- mutable machine state -------------------------------------------------
  const selected = new Set<string>();
  const jewelCap = Math.min(MAX_JEWELS, Math.max(0, opts.jewelsOwned));
  let jewels = 0;
  let feather = false;

  const c = scene.add.container(0, 0).setDepth(320);

  // Dim + tap-out.
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78).fillRect(0, 0, W, H);
  const dimZone = scene.add
    .zone(W / 2, H / 2, W, H)
    .setInteractive()
    .on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  // Panel.
  const panel = scene.add.graphics();
  panel.fillStyle(0x141022, 0.99).fillRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12);
  panel.lineStyle(2, ACCENT, 1).strokeRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12);
  const panelZone = scene.add
    .zone(L.panel.x + L.panel.w / 2, L.panel.y + L.panel.h / 2, L.panel.w, L.panel.h)
    .setInteractive();
  c.add([panel, panelZone]);

  c.add(
    crispText(scene, W / 2, L.panel.y + 14, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );

  // ---- machine drop zone (border redrawn by render/hover) --------------------
  const machineGfx = scene.add.graphics();
  c.add(machineGfx);
  const drawMachine = (hot: boolean): void => {
    machineGfx.clear();
    machineGfx
      .fillStyle(0x1d1430, 0.95)
      .fillRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
    machineGfx
      .lineStyle(hot ? 3 : 2, hot ? 0xffffff : ACCENT, hot ? 1 : 0.7)
      .strokeRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
  };
  const machineZone = scene.add
    .zone(L.machine.x + L.machine.w / 2, L.machine.y + L.machine.h / 2, L.machine.w, L.machine.h)
    .setRectangleDropZone(L.machine.w, L.machine.h);
  c.add(machineZone);
  c.add(
    crispText(scene, L.machine.x + 12, L.machine.y + 8, "Drag items + materials here", {
      fontSize: "11px",
      color: "#8a7aa6",
    }),
  );

  // Layer that holds the loaded-item icons (re-rendered each change).
  const loadedLayer = scene.add.container(0, 0);
  c.add(loadedLayer);

  // ---- material sockets (jewel + feather) ------------------------------------
  const socketGfx = scene.add.graphics();
  c.add(socketGfx);
  const jewelCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(
    0.5,
  );
  const featherCountText = crispText(scene, 0, 0, "", {
    fontSize: "12px",
    color: "#fff",
  }).setOrigin(0.5);
  c.add([jewelCountText, featherCountText]);

  // ---- readout ----------------------------------------------------------------
  const statusText = crispText(scene, L.readout.x, L.readout.y, "", {
    fontSize: "13px",
    color: "#e9d5ff",
  });
  const successText = crispText(scene, L.readout.x, L.readout.y + 30, "", {
    fontSize: "15px",
    color: "#ffe6a0",
    fontStyle: "bold",
  });
  c.add([statusText, successText]);
  c.add(
    crispText(scene, L.readout.x + L.readout.w, L.readout.y + 44, "Wing odds:", {
      fontSize: "11px",
      color: "#9fb0c4",
    }).setOrigin(1, 0),
  );
  const oddsGfx = scene.add.graphics();
  const oddsLabels = scene.add.container(0, 0);
  c.add([oddsGfx, oddsLabels]);

  // ---- craft + close ----------------------------------------------------------
  const craftBtn = crispText(scene, L.craftBtn.x, L.craftBtn.y, "", {
    fontSize: "15px",
    color: "#fff",
    fixedWidth: L.craftBtn.w,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 9, 0, 9)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!wingCraftGate(gateInput()).canCraft) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const close = crispText(scene, L.panel.x + L.panel.w - 60, L.craftBtn.y + 8, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", () => opts.onClose());
  c.add(close);

  // ---- tray (draggable item + material tiles) --------------------------------
  // Returns true if the source was consumed (so the tray tile dims).
  const tryLoad = (kind: "item" | "jewel" | "feather", id?: string): boolean => {
    if (kind === "item" && id && !selected.has(id) && opts.items.some((i) => i.id === id)) {
      selected.add(id);
      return true;
    }
    if (kind === "jewel" && jewels < jewelCap) {
      jewels++;
      return true;
    }
    if (kind === "feather" && !feather && opts.feathersOwned >= 1) {
      feather = true;
      return true;
    }
    return false;
  };

  const tileRefs: {
    kind: "item" | "jewel" | "feather";
    id?: string;
    img: Phaser.GameObjects.Image | null;
    ring: Phaser.GameObjects.Graphics;
    x: number;
    y: number;
  }[] = [];

  const trayCols = Math.max(1, Math.floor(L.tray.w / CELL));
  let slot = 0;
  const placeTile = (kind: "item" | "jewel" | "feather", texKey: string, id?: string): void => {
    const cx = L.tray.x + (slot % trayCols) * CELL;
    const cy = L.tray.y + Math.floor(slot / trayCols) * CELL;
    slot++;
    const ring = scene.add.graphics();
    c.add(ring);
    let img: Phaser.GameObjects.Image | null = null;
    if (scene.textures.exists(texKey)) {
      img = scene.add.image(cx + 22, cy + 22, texKey).setDisplaySize(40, 40);
      c.add(img);
      makeDraggable(scene, img, cx + 22, cy + 22, () => {
        if (machineZoneHit(scene) && tryLoad(kind, id)) render();
      });
      img.on("pointerup", () => {
        if (tryLoad(kind, id)) render(); // tap-to-load fallback
      });
    }
    tileRefs.push({ kind, id, img, ring, x: cx, y: cy });
  };

  // Material tiles first (always visible), then items.
  placeTile("jewel", materialTex(JEWEL_OF_CHAOS));
  placeTile("feather", materialTex(FEATHER));
  for (const it of opts.items) placeTile("item", itemTex(it.defId), it.id);

  // ---- render -----------------------------------------------------------------
  function gateInput(): {
    itemCount: number;
    jewels: number;
    feather: boolean;
    jewelsOwned: number;
    feathersOwned: number;
  } {
    return {
      itemCount: selected.size,
      jewels,
      feather,
      jewelsOwned: opts.jewelsOwned,
      feathersOwned: opts.feathersOwned,
    };
  }

  function renderLoaded(): void {
    loadedLayer.removeAll(true);
    const pts = loadedSlotLayout(selected.size, L.machine, 34);
    [...selected].forEach((id, i) => {
      const it = opts.items.find((x) => x.id === id);
      const p = pts[i];
      if (!it || !p || !scene.textures.exists(itemTex(it.defId))) return;
      const im = scene.add.image(p.x, p.y, itemTex(it.defId)).setDisplaySize(30, 30);
      im.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        selected.delete(id); // tap a loaded icon to unload it
        render();
      });
      loadedLayer.add(im);
    });
  }

  function renderSockets(): void {
    socketGfx.clear();
    drawSocket(socketGfx, L.jewelSocket, jewels > 0);
    drawSocket(socketGfx, L.featherSocket, feather);
    jewelCountText
      .setText(`◈${jewels}`)
      .setPosition(L.jewelSocket.x + L.jewelSocket.w / 2, L.jewelSocket.y + L.jewelSocket.h / 2)
      .setColor(jewels > 0 ? "#e9d5ff" : "#6a5a86");
    featherCountText
      .setText(feather ? "✦" : "·")
      .setPosition(
        L.featherSocket.x + L.featherSocket.w / 2,
        L.featherSocket.y + L.featherSocket.h / 2,
      )
      .setColor(feather ? "#fff6c0" : "#6a5a86");
  }

  function renderTray(): void {
    for (const t of tileRefs) {
      const isLoaded =
        (t.kind === "item" && t.id && selected.has(t.id)) ||
        (t.kind === "jewel" && jewels >= jewelCap) ||
        (t.kind === "feather" && feather);
      const owned =
        t.kind === "item" ? true : t.kind === "jewel" ? jewelCap > 0 : opts.feathersOwned >= 1;
      if (t.img) t.img.setAlpha(isLoaded || !owned ? 0.35 : 1);
      const col =
        t.kind === "item"
          ? RARITY_INT[opts.items.find((i) => i.id === t.id)?.rarity ?? "Common"]
          : ACCENT;
      t.ring.clear();
      t.ring
        .lineStyle(1, col, owned ? 0.6 : 0.25)
        .strokeRoundedRect(t.x, t.y, CELL - 2, CELL - 2, 6);
    }
  }

  function renderReadout(): void {
    const gate = wingCraftGate(gateInput());
    statusText.setText(
      `Items ${selected.size}/5   ·   Jewels ${jewels}/${MAX_JEWELS}   ·   Feather ${feather ? "✓" : "✗"}`,
    );
    const p = opts.preview([...selected], jewels);
    successText.setText(gate.canCraft ? `Success ${Math.round(p.success * 100)}%` : "Success —");

    oddsGfx.clear();
    oddsLabels.removeAll(true);
    const segs = oddsBarSegments(
      p.odds.length ? p.odds : [{ rarity: "Common", chance: 1 }],
      L.oddsBar,
    );
    for (const s of segs) {
      oddsGfx
        .fillStyle(RARITY_INT[s.rarity], 0.9)
        .fillRect(s.x, L.oddsBar.y, Math.max(0, s.w - 1), L.oddsBar.h);
      if (s.w > 34) {
        oddsLabels.add(
          crispText(
            scene,
            s.x + s.w / 2,
            L.oddsBar.y + L.oddsBar.h / 2,
            `${Math.round(s.chance * 100)}%`,
            { fontSize: "10px", color: "#10121a", fontStyle: "bold" },
          ).setOrigin(0.5),
        );
      }
    }

    const hint = gate.needItems
      ? `Load ${gate.needItems} more item(s)`
      : !gate.hasJewel
        ? "Add a Jewel of Chaos"
        : !gate.hasFeather
          ? "Add a Feather"
          : "🔨 Forge Wings";
    craftBtn
      .setText(hint)
      .setColor(gate.canCraft ? "#fff" : "#8a7a9a")
      .setBackgroundColor(gate.canCraft ? "#6a2fa0" : "#2a2140");
  }

  function render(): void {
    drawMachine(false);
    renderLoaded();
    renderSockets();
    renderTray();
    renderReadout();
  }

  // Brighten the machine while a drag hovers it.
  scene.input.on("drag", () => drawMachine(machineZoneHit(scene)));

  render();
  return c;
}
