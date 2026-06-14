/**
 * Craft Wings — load gear + materials into the machine, then Forge. The tray (gear
 * picker) is a scrollable, rarity-filterable, tap-to-load grid (wingCraftTray). Gear
 * loads by tapping a tray tile; the two materials load by tapping their machine
 * socket (jewel cycles 0..cap, feather toggles). Auto fills the cheapest valid craft;
 * Clear empties the machine. A live readout shows success % + outcome odds. The
 * caller owns inventory access, the preview math and the craft (confirm).
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { itemTex, materialTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { MAX_JEWELS, MIN_ITEMS } from "../core/wingCraft.ts";
import {
  wingCraftGate,
  wingMachineLayout,
  loadedSlotLayout,
  oddsBarSegments,
} from "../core/wingCraftMachine.ts";
import { autoWingSelection } from "../core/wingTray.ts";
import { drawSocket } from "./wingCraftDrag.ts";
import { createWingTray, type WingTrayHandle } from "./wingCraftTray.ts";
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

  // Dim + tap-out (no drag any more, so a plain tap-out close is safe).
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
    crispText(scene, W / 2, L.panel.y + 12, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );

  // ---- machine ---------------------------------------------------------------
  const machineGfx = scene.add.graphics();
  c.add(machineGfx);
  const drawMachine = (): void => {
    machineGfx.clear();
    machineGfx
      .fillStyle(0x1d1430, 0.95)
      .fillRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
    machineGfx
      .lineStyle(2, ACCENT, 0.7)
      .strokeRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
  };
  c.add(
    crispText(scene, L.machine.x + 12, L.machine.y + 8, "Tap gear below + the sockets →", {
      fontSize: "11px",
      color: "#8a7aa6",
    }),
  );

  const loadedLayer = scene.add.container(0, 0);
  c.add(loadedLayer);

  // ---- material sockets (tap to load) ----------------------------------------
  const socketGfx = scene.add.graphics();
  c.add(socketGfx);
  // Real material icons fill each socket; their alpha tracks the loaded state in
  // renderSockets(). When a texture is missing we fall back to the ◈/✦ glyph in
  // the count text below, so a socket is never blank.
  const mkMatIcon = (
    key: string,
    sock: { x: number; y: number; w: number; h: number },
  ): Phaser.GameObjects.Image | null => {
    if (!scene.textures.exists(key)) return null;
    const img = scene.add
      .image(sock.x + sock.w / 2, sock.y + sock.h / 2 - 4, key)
      .setDisplaySize(30, 30);
    c.add(img);
    return img;
  };
  const jewelIcon = mkMatIcon(materialTex(JEWEL_OF_CHAOS), L.jewelSocket);
  const featherIcon = mkMatIcon(materialTex(FEATHER), L.featherSocket);
  // Count / state badges sit on top of the icons (added after → drawn above).
  const jewelCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(
    0.5,
  );
  const featherCountText = crispText(scene, 0, 0, "", {
    fontSize: "12px",
    color: "#fff",
  }).setOrigin(0.5);
  c.add([jewelCountText, featherCountText]);
  const jewelZone = scene.add
    .zone(
      L.jewelSocket.x + L.jewelSocket.w / 2,
      L.jewelSocket.y + L.jewelSocket.h / 2,
      L.jewelSocket.w,
      L.jewelSocket.h,
    )
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => {
      if (jewelCap <= 0) return;
      jewels = jewels >= jewelCap ? 0 : jewels + 1; // cycle 0..cap
      render();
    });
  const featherZone = scene.add
    .zone(
      L.featherSocket.x + L.featherSocket.w / 2,
      L.featherSocket.y + L.featherSocket.h / 2,
      L.featherSocket.w,
      L.featherSocket.h,
    )
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => {
      if (opts.feathersOwned < 1) return;
      feather = !feather;
      render();
    });
  c.add([jewelZone, featherZone]);

  // ---- readout ----------------------------------------------------------------
  const statusText = crispText(scene, L.readout.x, L.readout.y, "", {
    fontSize: "13px",
    color: "#e9d5ff",
  });
  const successText = crispText(scene, L.readout.x, L.readout.y + 26, "", {
    fontSize: "15px",
    color: "#ffe6a0",
    fontStyle: "bold",
  });
  c.add([statusText, successText]);
  c.add(
    crispText(scene, L.readout.x + L.readout.w, L.readout.y + 40, "Wing odds:", {
      fontSize: "11px",
      color: "#9fb0c4",
    }).setOrigin(1, 0),
  );
  const oddsGfx = scene.add.graphics();
  const oddsLabels = scene.add.container(0, 0);
  c.add([oddsGfx, oddsLabels]);

  // ---- Auto / Clear -----------------------------------------------------------
  const mkBtn = (
    rect: { x: number; y: number; w: number; h: number },
    label: string,
    fill: number,
    onTap: () => void,
  ): void => {
    const g = scene.add.graphics();
    g.fillStyle(fill, 0.9).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    g.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    const t = crispText(scene, rect.x + rect.w / 2, rect.y + rect.h / 2, label, {
      fontSize: "12px",
      color: "#fff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const z = scene.add
      .zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", onTap);
    c.add([g, t, z]);
  };
  mkBtn(L.autoBtn, "Auto", 0x2f7a4a, () => {
    const sel = autoWingSelection(opts.items, {
      need: Math.max(0, MIN_ITEMS - selected.size),
      jewelCap,
      feathersOwned: opts.feathersOwned,
      selected,
    });
    for (const id of sel.ids) selected.add(id);
    if (jewels === 0) jewels = sel.jewels;
    feather = feather || sel.feather;
    render();
  });
  mkBtn(L.clearBtn, "Clear", 0x6a2f2f, () => {
    selected.clear();
    jewels = 0;
    feather = false;
    render();
  });

  // ---- craft + close ----------------------------------------------------------
  const craftBtn = crispText(scene, L.craftBtn.x, L.craftBtn.y, "", {
    fontSize: "15px",
    color: "#fff",
    fixedWidth: L.craftBtn.w,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 8, 0, 8)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!wingCraftGate(gateInput()).canCraft) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const close = crispText(scene, L.panel.x + L.panel.w - 56, L.craftBtn.y + 6, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", () => opts.onClose());
  c.add(close);

  // ---- tray (delegated) -------------------------------------------------------
  const tray: WingTrayHandle = createWingTray({
    scene,
    parent: c,
    layout: L,
    items: opts.items,
    isLoaded: (id) => selected.has(id),
    onLoad: (id) => {
      selected.add(id);
      render();
    },
  });

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
    const pts = loadedSlotLayout(selected.size, L.machine, 30);
    [...selected].forEach((id, i) => {
      const it = opts.items.find((x) => x.id === id);
      const p = pts[i];
      if (!it || !p) return;
      const col = RARITY_INT[it.rarity];
      // Rarity-tinted backing + ring so rarity reads even over the icon, then the
      // real item icon (makeFitIcon falls back to the first letter when art is
      // missing — same as before for art-less gear).
      const g = scene.add.graphics();
      g.fillStyle(col, 0.32).fillRoundedRect(p.x - 14, p.y - 14, 28, 28, 5);
      g.lineStyle(1.5, col, 0.95).strokeRoundedRect(p.x - 14, p.y - 14, 28, 28, 5);
      const icon = makeFitIcon(scene, p.x, p.y, itemTex(it.defId), 24, (it.name[0] ?? "?").toUpperCase());
      const z = scene.add
        .zone(p.x, p.y, 28, 28)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          selected.delete(id); // tap a loaded chip to unload it
          render();
        });
      loadedLayer.add([g, icon, z]);
    });
  }

  function renderSockets(): void {
    socketGfx.clear();
    drawSocket(socketGfx, L.jewelSocket, jewels > 0);
    drawSocket(socketGfx, L.featherSocket, feather);
    jewelIcon?.setAlpha(jewels > 0 ? 1 : 0.4);
    featherIcon?.setAlpha(feather ? 1 : 0.4);
    jewelCountText
      // icon shown → bare count; no icon → keep the ◈ glyph so it's not blank
      .setText(jewelIcon ? `${jewels}` : `◈${jewels}`)
      .setPosition(L.jewelSocket.x + L.jewelSocket.w / 2, L.jewelSocket.y + L.jewelSocket.h - 9)
      .setColor(jewels > 0 ? "#e9d5ff" : "#6a5a86");
    featherCountText
      .setText(feather ? (featherIcon ? "✓" : "✦") : "·")
      .setPosition(L.featherSocket.x + L.featherSocket.w / 2, L.featherSocket.y + L.featherSocket.h - 9)
      .setColor(feather ? "#fff6c0" : "#6a5a86");
  }

  function renderReadout(): void {
    const gate = wingCraftGate(gateInput());
    statusText.setText(
      `Items ${selected.size}/${MIN_ITEMS}   ·   Jewels ${jewels}/${jewelCap}   ·   Feather ${feather ? "✓" : "✗"}`,
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
        ? "Tap the ◈ socket"
        : !gate.hasFeather
          ? "Tap the ✦ socket"
          : "🔨 Forge Wings";
    craftBtn
      .setText(hint)
      .setColor(gate.canCraft ? "#fff" : "#8a7a9a")
      .setBackgroundColor(gate.canCraft ? "#6a2fa0" : "#2a2140");
  }

  function render(): void {
    drawMachine();
    renderLoaded();
    renderSockets();
    renderReadout();
    tray.render();
  }

  c.once("destroy", () => tray.destroy());

  render();
  return c;
}
