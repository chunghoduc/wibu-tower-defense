/**
 * forgeRecipeDialog — the focused "forge machine" modal for a station. Lays the
 * transformation out visually: a recipe selector (when a station has >1 option),
 * then INPUT slots → a forge arrow → OUTPUT slots, a note, and a Forge button
 * that lives inside the visual (not a bare text row). Generic over every
 * recipe-backed station (Awakening / Alchemy / Copy Exchange / Spark); Craft
 * Wings keeps its own drag machine. Returns { refresh, close } so the scene can
 * re-render in place after a successful craft.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { COLORS, dimBackdrop, closeModal, interactive } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import type { ForgeIngredient, ForgeRecipeVM, StationVM } from "../core/forgeStations.ts";

export interface ForgeDialogHandle {
  refresh(station: StationVM): void;
  close(): void;
}

export interface ForgeDialogOpts {
  station: StationVM;
  confirm(recipeId: string): void;
  onClose(): void;
  /** Optional secondary action (Spark's "Cycle Wishlist"). */
  secondary?: { label: string; run(): void };
}

const PANEL_W = 600;
const PANEL_H = 340;
const MAX_CHIPS = 8; // cap selector chips; surplus surfaced via a "+N more" note

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

function slot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ing: ForgeIngredient,
  showHave: boolean,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x121a28, 0.96).fillRoundedRect(-26, -26, 52, 52, 8);
  g.lineStyle(2, ing.color || 0x3a567f, 1).strokeRoundedRect(-26, -26, 52, 52, 8);
  c.add(g);
  c.add(makeFitIcon(scene, 0, -4, ing.iconKey, 38, ing.emoji));
  if (ing.qty > 0) {
    c.add(
      crispText(scene, 20, 16, `×${ing.qty}`, {
        fontSize: "12px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }
  if (ing.label) {
    c.add(
      crispText(scene, 0, 36, ing.label, { fontSize: "10px", color: "#aab8cc" }).setOrigin(0.5, 0),
    );
  }
  if (showHave && ing.have !== undefined) {
    const short = ing.have < ing.qty;
    c.add(
      crispText(scene, 0, 50, `have ${ing.have}`, {
        fontSize: "10px",
        color: short ? COLORS.bad : COLORS.good,
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );
  }
  return c;
}

export function openForgeDialog(scene: Phaser.Scene, opts: ForgeDialogOpts): ForgeDialogHandle {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const px = (W - PANEL_W) / 2;
  const py = (H - PANEL_H) / 2;

  const c = scene.add.container(0, 0).setDepth(320);
  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    closeModal(scene, c, opts.onClose);
  };
  dimBackdrop(scene, c, () => close());

  // Static panel shell (persists across refreshes).
  const shell = scene.add.graphics();
  shell.fillStyle(0x10131c, 0.99).fillRoundedRect(px, py, PANEL_W, PANEL_H, 14);
  shell.lineStyle(2, 0x3a567f, 1).strokeRoundedRect(px, py, PANEL_W, PANEL_H, 14);
  const shellZone = scene.add
    .zone(px + PANEL_W / 2, py + PANEL_H / 2, PANEL_W, PANEL_H)
    .setInteractive();
  c.add([shell, shellZone]);

  const content = scene.add.container(0, 0);
  c.add(content);

  let station = opts.station;
  let sel = 0;

  function render(): void {
    content.removeAll(true);
    const recipes = station.recipes;
    const recipe: ForgeRecipeVM | undefined = recipes[sel];

    // Header.
    content.add(
      crispText(scene, px + 18, py + 14, `${station.emoji}  ${station.title}`, {
        fontSize: "18px",
        color: hex(station.accent),
        fontStyle: "bold",
      }).setOrigin(0, 0),
    );
    if (opts.secondary) {
      const s = crispText(scene, px + PANEL_W - 18, py + 16, opts.secondary.label, {
        fontSize: "12px",
        color: "#fff",
        backgroundColor: "#3a567f",
        fontStyle: "bold",
      })
        .setOrigin(1, 0)
        .setPadding(10, 5, 10, 5)
        .setInteractive({ useHandCursor: true });
      s.on("pointerup", () => opts.secondary?.run());
      content.add(s);
    }

    // Recipe selector chips (only when there's a choice).
    let laneTop = py + 56;
    if (recipes.length > 1) {
      const shown = recipes.slice(0, MAX_CHIPS);
      let cx = px + 18;
      let cy = py + 52;
      shown.forEach((r, i) => {
        const label = r.label.length > 16 ? r.label.slice(0, 15) + "…" : r.label;
        const chip = crispText(scene, cx, cy, `${r.canCraft ? "●" : "○"} ${label}`, {
          fontSize: "12px",
          color: i === sel ? "#10131c" : r.canCraft ? "#dfe7f2" : "#8090a4",
          backgroundColor: i === sel ? "#ffd56a" : "#1b2436",
          fontStyle: "bold",
        })
          .setPadding(8, 4, 8, 4)
          .setInteractive({ useHandCursor: true });
        chip.on("pointerup", () => {
          sel = i;
          render();
        });
        content.add(chip);
        cx += chip.width + 8;
        if (cx > px + PANEL_W - 120) {
          cx = px + 18;
          cy += 28;
        }
      });
      if (recipes.length > MAX_CHIPS) {
        content.add(
          crispText(scene, px + 18, cy + 26, `+${recipes.length - MAX_CHIPS} more`, {
            fontSize: "10px",
            color: "#7f93a8",
          }),
        );
      }
      laneTop = cy + 40;
    }

    // Transformation lane: INPUTS  ⚒ ➜  OUTPUTS.
    const laneY = Math.max(laneTop, py + 150);
    const inputs = recipe?.inputs ?? [];
    const outputs = recipe?.outputs ?? [];
    const inStartX = px + 70;
    const outStartX = px + PANEL_W - 70 - (outputs.length - 1) * 70;
    inputs.forEach((ing, i) => content.add(slot(scene, inStartX + i * 70, laneY, ing, true)));
    outputs.forEach((ing, i) => content.add(slot(scene, outStartX + i * 70, laneY, ing, false)));
    content.add(
      crispText(scene, px + PANEL_W / 2, laneY - 6, "⚒", {
        fontSize: "30px",
        color: "#ffd56a",
      }).setOrigin(0.5),
    );
    content.add(
      crispText(scene, px + PANEL_W / 2, laneY + 20, "➜", {
        fontSize: "20px",
        color: "#cdd6e6",
      }).setOrigin(0.5),
    );

    // Note.
    if (recipe?.note) {
      content.add(
        crispText(scene, px + PANEL_W / 2, laneY + 56, recipe.note, {
          fontSize: "12px",
          color: "#cdd6e6",
        }).setOrigin(0.5, 0),
      );
    }

    // Forge button (inside the visual).
    const can = recipe?.canCraft ?? false;
    const btn = crispText(
      scene,
      px + PANEL_W / 2,
      py + PANEL_H - 26,
      can ? "⚒  Forge" : "Cannot forge",
      {
        fontSize: "16px",
        color: can ? "#fff" : "#8a7a9a",
        backgroundColor: can ? hex(station.accent) : "#262c3a",
        fontStyle: "bold",
        fixedWidth: 200,
        align: "center",
      },
    )
      .setOrigin(0.5)
      .setPadding(0, 10, 0, 10)
      .setInteractive({ useHandCursor: true });
    interactive(scene, btn, () => {
      if (recipe && recipe.canCraft) opts.confirm(recipe.id);
    });
    content.add(btn);

    // Close.
    const x = crispText(scene, px + PANEL_W - 16, py + PANEL_H - 26, "Close", {
      fontSize: "13px",
      color: "#9fb0c4",
    })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    x.on("pointerup", () => close());
    content.add(x);
  }

  render();
  return {
    refresh(next: StationVM): void {
      station = next;
      sel = Math.min(sel, Math.max(0, next.recipes.length - 1));
      render();
    },
    close,
  };
}
