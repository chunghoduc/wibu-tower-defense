// src/scenes/gatedButton.ts
//
// A button that renders an equip-action in one of two states from an
// EquipLevelGate: when the level requirement is met it's a normal interactive
// coloured button; when not, it's greyed, non-clickable, and reveals the
// requirement ("Requires level N · you are M") on hover. Shared by the compare
// (Replace) and enhance (Equip) dialogs so the disabled treatment is identical.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { EquipLevelGate } from "../data/equipGate.ts";

export interface GatedButtonOpts {
  x: number;            // absolute scene x (button is origin 0.5,0)
  y: number;            // absolute scene y
  label: string;        // e.g. "⇄  Replace"
  bg: string;           // background colour when enabled
  color?: string;       // text colour when enabled (default white)
  gate: EquipLevelGate;
  onClick: () => void;  // wired only when gate.met
}

/** Add a level-gated action button (and, when locked, its hover hint) to `container`. */
export function addGatedButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  opts: GatedButtonOpts,
): void {
  const { x, y, label, bg, gate, onClick } = opts;
  const met = gate.met;
  const btn = crispText(scene, x, y, met ? label : `${label} 🔒`, {
    fontSize: "14px",
    color: met ? (opts.color ?? "#fff") : "#c2c9d2",
    backgroundColor: met ? bg : "#3a3f48",
  }).setOrigin(0.5, 0).setPadding(14, 8, 14, 8).setAlpha(met ? 1 : 0.55);
  btn.setInteractive({ useHandCursor: met });
  container.add(btn);

  if (met) {
    btn.on("pointerup", onClick);
    return;
  }

  // Locked: no click handler (tapping is a no-op and shields the scrim, keeping
  // the dialog open). Reveal the requirement on hover, just under the button.
  const hint = crispText(scene, x, y + btn.height + 6, gate.hint, {
    fontSize: "11px", color: "#ffb38a", backgroundColor: "#1a1f29",
  }).setOrigin(0.5, 0).setPadding(6, 3, 6, 3).setVisible(false);
  container.add(hint);
  btn.on("pointerover", () => hint.setVisible(true));
  btn.on("pointerout", () => hint.setVisible(false));
}
