/**
 * squadControls — thin Phaser presenters for SquadScene's no-drag editing UI:
 * the info-panel Add/Remove action button and the Auto-fill / Clear control row.
 * Extracted from SquadScene to keep that scene under the 500-line cap. All squad
 * mutation lives in the pure squadEdit.ts; these only build interactive objects
 * and call back the supplied handlers (the scene applies its own didDrag guard).
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";

/** Info-panel Add/Remove action button. `onTap` fires only when enabled. */
export function renderActionButton(
  scene: Phaser.Scene,
  panel: Phaser.GameObjects.Container,
  o: { x: number; y: number; w: number; inSquad: boolean; full: boolean; onTap: () => void },
): void {
  const label = o.inSquad
    ? "✓ In Squad — tap to Remove"
    : o.full
      ? "Squad Full (7/7) — drag to swap"
      : "+ Add to Squad";
  const bg = o.inSquad ? "#5a2a3a" : o.full ? "#23303f" : "#2a5a3a";
  const btn = crispText(scene, o.x, o.y, label, {
    fontSize: "12px",
    color: o.full ? "#7c8aa0" : "#fff",
    backgroundColor: bg,
    fontStyle: "bold",
    align: "center",
    fixedWidth: o.w,
  })
    .setOrigin(0.5)
    .setPadding(0, 6, 0, 6);
  if (!o.full) btn.setInteractive({ useHandCursor: true }).on("pointerup", o.onTap);
  panel.add(btn);
}

/** Auto-fill + Clear control row beside the "n/7 chosen" label. */
export function renderControlRow(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  o: { onAuto: () => void; onClear: () => void },
): void {
  const mk = (x: number, text: string, color: string, onTap: () => void): void => {
    const b = crispText(scene, x, 94, text, {
      fontSize: "11px",
      color: "#fff",
      backgroundColor: color,
    })
      .setPadding(7, 3, 7, 3)
      .setInteractive({ useHandCursor: true });
    b.on("pointerup", onTap);
    layer.add(b);
  };
  mk(150, "⚡ Auto", "#2a5a3a", o.onAuto);
  mk(214, "Clear", "#5a2a3a", o.onClear);
}
