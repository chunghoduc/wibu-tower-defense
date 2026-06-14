/**
 * forgeStationCard — renders one Forge station as a tappable card: accent panel
 * (hot when ready), emblem + title + readiness badge, and a mini INPUT → OUTPUT
 * strip built from the pure StationVM preview (real icons via makeFitIcon, emoji
 * fallback). The whole card has the standard button-feel and opens the station.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { accentPanel, interactive } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import type { ForgeIngredient, Rect, StationVM } from "../core/forgeStations.ts";

function miniIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ing: ForgeIngredient,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(makeFitIcon(scene, 0, 0, ing.iconKey, 26, ing.emoji));
  if (ing.qty > 1) {
    c.add(
      crispText(scene, 13, 9, `×${ing.qty}`, {
        fontSize: "10px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }
  return c;
}

/** Build a centered, interactive station card at `rect`; `onOpen` fires on tap. */
export function buildStationCard(
  scene: Phaser.Scene,
  rect: Rect,
  vm: StationVM,
  onOpen: (vm: StationVM) => void,
): Phaser.GameObjects.Container {
  const w = rect.w;
  const h = rect.h;
  const c = scene.add.container(rect.x + w / 2, rect.y + h / 2);

  c.add(accentPanel(scene, -w / 2, -h / 2, w, h, vm.accent, vm.ready));
  c.add(crispText(scene, -w / 2 + 14, -h / 2 + 10, vm.emoji, { fontSize: "26px" }).setOrigin(0, 0));
  c.add(
    crispText(scene, -w / 2 + 52, -h / 2 + 14, vm.title, {
      fontSize: "15px",
      color: "#ffe9b0",
      fontStyle: "bold",
    }).setOrigin(0, 0),
  );
  c.add(
    crispText(scene, w / 2 - 12, -h / 2 + 16, vm.badge, {
      fontSize: "11px",
      color: vm.ready ? "#a5f0b0" : "#8090a4",
      fontStyle: "bold",
    }).setOrigin(1, 0),
  );

  if (vm.preview) {
    const py = h / 2 - 22;
    c.add(miniIcon(scene, -w / 2 + 56, py, vm.preview.input));
    c.add(
      crispText(scene, -w / 2 + 92, py, "➜", { fontSize: "16px", color: "#cdd6e6" }).setOrigin(0.5),
    );
    c.add(miniIcon(scene, -w / 2 + 128, py, vm.preview.output));
    c.add(
      crispText(scene, w / 2 - 12, h / 2 - 14, "Tap to forge", {
        fontSize: "10px",
        color: "#7f93a8",
      }).setOrigin(1, 0.5),
    );
  }

  c.setSize(w, h).setInteractive({ useHandCursor: true });
  interactive(scene, c, () => onOpen(vm), { hoverScale: 1.03, pressScale: 0.98 });
  return c;
}
