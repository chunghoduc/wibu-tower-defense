/**
 * spinReel — the Lucky Spin animation.
 *
 * The wheel result is rolled instantly by the save layer; this module is the
 * *suspense*: a horizontal strip of prize cells (CS:GO-case style) that scrolls
 * fast, decelerates, and settles with the won prize under a centre pointer.
 * It dims the screen, blocks input while spinning, pops the winning cell, then
 * calls `onLand` so the caller can fire the reward-burst celebration.
 *
 * Fire-and-forget: everything lives in one overlay container on the scene root
 * at a high depth and tears itself down. Stays in the established tween +
 * graphics + crispText idiom (no particle system).
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { SPIN_WHEEL, type SpinPrize } from "../core/spin.ts";
import { rewardPrimaryIcon } from "../data/rewardIcon.ts";
import { makeFitIcon } from "./itemIcon.ts";

const DEPTH = 150;
const CELL_W = 132;
const PITCH = 144; // cell width + gap
const WIN_CELLS = 3; // visible cells across the window
const TARGET_INDEX = 46; // which strip cell the winner lands on (long scroll)
const STRIP_LEN = 54;

/** Build one prize cell (bg + real reward icon + label) into the strip container. */
function buildCell(
  scene: Phaser.Scene, strip: Phaser.GameObjects.Container,
  prize: SpinPrize, cx: number,
): Phaser.GameObjects.Container {
  // Same resolver the post-battle reward panel uses, so the wheel shows the real
  // gold/diamond/material/jewel texture (emoji fallback only when un-arted).
  const view = rewardPrimaryIcon(prize.reward);
  // Rare prizes keep the signature magenta glow; others use the reward's own accent.
  const accent = prize.rare ? 0xff5bd0 : view.color;
  const cell = scene.add.container(cx, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x10151f, 1).fillRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
  g.lineStyle(2, accent, prize.rare ? 1 : 0.6).strokeRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
  cell.add(g);
  cell.add(makeFitIcon(scene, 0, -14, view.iconKey, 56, view.emoji));
  cell.add(crispText(scene, 0, 30, prize.label, {
    fontSize: "12px", color: "#ffe9b0", fontStyle: "bold", align: "center",
    stroke: "#0a0d14", strokeThickness: 3, wordWrap: { width: CELL_W - 12 },
  }).setOrigin(0.5));
  strip.add(cell);
  return cell;
}

/**
 * Play the spin and reveal `winner`. Calls `onLand` once the reel settles on the
 * prize (and the celebration should fire). `rare` brightens the framing.
 */
export function playSpinReel(
  scene: Phaser.Scene, winner: SpinPrize, rare: boolean, onLand: () => void,
): void {
  const W = scene.scale.width, H = scene.scale.height;
  const cx = W / 2, cy = H / 2;
  const winW = WIN_CELLS * PITCH;
  const winLeft = Math.round(cx - winW / 2);
  const root = scene.add.container(0, 0).setDepth(DEPTH);

  // Dim backdrop that also swallows clicks while spinning.
  const dim = scene.add.rectangle(cx, cy, W, H, 0x05080e, 0.78).setInteractive();
  root.add(dim);
  scene.tweens.add({ targets: dim, alpha: 0.78, duration: 180 });

  root.add(crispText(scene, cx, cy - 96, "🎡 Spinning…", {
    fontSize: "22px", color: "#ffe9b0", fontStyle: "bold",
  }).setOrigin(0.5));

  // The scrolling strip, clipped to the window.
  const strip = scene.add.container(winLeft, cy);
  root.add(strip);
  const maskG = scene.make.graphics({}).fillRect(winLeft, cy - 60, winW, 120);
  const mask = maskG.createGeometryMask();
  strip.setMask(mask);

  // Populate cells: random prizes everywhere, the real winner at TARGET_INDEX.
  let winnerCell!: Phaser.GameObjects.Container;
  for (let i = 0; i < STRIP_LEN; i++) {
    const prize = i === TARGET_INDEX ? winner : SPIN_WHEEL[(i * 3 + 1) % SPIN_WHEEL.length];
    const c = buildCell(scene, strip, prize, i * PITCH + CELL_W / 2);
    if (i === TARGET_INDEX) winnerCell = c;
  }

  // Window frame + centre pointer.
  const frame = scene.add.graphics();
  frame.lineStyle(3, rare ? 0xff5bd0 : 0xffd24d, 1).strokeRoundedRect(winLeft - 6, cy - 66, winW + 12, 132, 14);
  frame.fillStyle(rare ? 0xff5bd0 : 0xffd24d, 0.08).fillRect(cx - 3, cy - 60, 6, 120);
  root.add(frame);
  const ptr = scene.add.graphics();
  ptr.fillStyle(0xfff4d0, 1);
  ptr.fillTriangle(cx - 12, cy - 78, cx + 12, cy - 78, cx, cy - 60);
  ptr.fillTriangle(cx - 12, cy + 78, cx + 12, cy + 78, cx, cy + 60);
  root.add(ptr);

  // Land the TARGET cell under the pointer, with a little jitter so it isn't
  // always dead-centre. strip-local x of the cell, mapped to window centre.
  const jitter = (((TARGET_INDEX * 7) % 11) - 5) / 5 * (CELL_W * 0.28);
  const finalX = winW / 2 - (TARGET_INDEX * PITCH + CELL_W / 2) + jitter;

  const proxy = { x: 0 };
  scene.tweens.add({
    targets: proxy, x: finalX, duration: 3000, ease: "Cubic.easeOut",
    onUpdate: () => { strip.x = winLeft + proxy.x; },
    onComplete: () => revealWinner(scene, root, winnerCell, winner, rare, cx, cy, onLand),
  });

  root.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
}

/** Pop the landed cell, swap the header to the prize, then hand off + fade out. */
function revealWinner(
  scene: Phaser.Scene, root: Phaser.GameObjects.Container,
  cell: Phaser.GameObjects.Container, winner: SpinPrize, rare: boolean,
  cx: number, cy: number, onLand: () => void,
): void {
  const accent = rare ? 0xff5bd0 : 0xffd24d;
  scene.tweens.add({ targets: cell, scale: 1.16, duration: 200, yoyo: true, repeat: 1, ease: "Sine.easeInOut" });

  // Bright ring blooming out of the window centre.
  const ring = scene.add.graphics().setDepth(DEPTH + 1);
  root.add(ring);
  const f = { r: 40, a: 0.9 };
  scene.tweens.add({
    targets: f, r: 130, a: 0, duration: 600, ease: "Cubic.easeOut",
    onUpdate: () => { ring.clear(); ring.lineStyle(4, accent, f.a).strokeCircle(cx, cy, f.r); },
    onComplete: () => ring.destroy(),
  });

  const head = crispText(scene, cx, cy - 96, `${rare ? "★ " : ""}${winner.label}!`, {
    fontSize: "22px", color: rare ? "#ff9be8" : "#ffe9b0", fontStyle: "bold",
  }).setOrigin(0.5).setDepth(DEPTH + 1);
  root.add(head);

  // Let the win read for a beat, hand off to the celebration, then dismiss.
  scene.time.delayedCall(620, onLand);
  scene.time.delayedCall(900, () => {
    scene.tweens.add({
      targets: root, alpha: 0, duration: 280, ease: "Cubic.easeIn",
      onComplete: () => root.destroy(),
    });
  });
}
