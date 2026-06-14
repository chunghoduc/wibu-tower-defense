/**
 * Wing-craft result reveal — the payoff modal after a Craft Wings attempt.
 * Success: a rarity-tinted glow + open burst + framed card with the wing icon,
 * auto-fit name, rarity badge and rolled stat lines. Failure: an ashen card and
 * "dissolved into chaos…" beat. Mirrors summonResultOverlay's reveal idiom and
 * reuses uiKit scaffolding so it matches every other dialog. Presentation only.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { COLORS, DUR, dimBackdrop, closeModal, button, accentPanel } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addNamePlate } from "./namePlate.ts";
import { SOURCE_COLOR } from "../data/itemDisplay.ts";
import type { WingCraftResultVM } from "../core/wingCraftResultView.ts";

const OVERLAY_DEPTH = 380; // above forge FX (360)
const CARD_W = 300;
const MAX_ROWS = 8;
const FAIL_ACCENT = 0x8a8f99;

type Obj = Phaser.GameObjects.GameObject & {
  setScale(x: number): unknown;
  setAlpha(x: number): unknown;
};

export function openWingCraftResultOverlay(
  scene: Phaser.Scene,
  vm: WingCraftResultVM,
  onDone: () => void,
): Phaser.GameObjects.Container {
  const { width: W, height: H } = scene.scale;
  const cx = W / 2;
  const cy = H / 2;

  const root = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    closeModal(scene, root, onDone);
  };
  dimBackdrop(scene, root, finish, 0.72);

  const accent = vm.kind === "success" ? vm.color : FAIL_ACCENT;

  if (vm.kind === "success") buildGlow(scene, root, cx, cy, accent);

  // Card height scales with how many stat rows we show (success only).
  const rowCount = vm.kind === "success" ? Math.min(vm.statRows.length, MAX_ROWS) : 0;
  const cardH = vm.kind === "success" ? 276 + rowCount * 26 : 252;
  const cardTop = cy - cardH / 2;
  root.add(accentPanel(scene, cx - CARD_W / 2, cardTop, CARD_W, cardH, accent));

  if (vm.kind === "success") {
    buildSuccess(scene, root, vm, cx, cardTop);
    openBurst(scene, root, cx, cardTop + 78, accent);
  } else {
    buildFailure(scene, root, cx, cardTop);
  }

  const btn = button(scene, cx, cardTop + cardH - 30, vm.kind === "success" ? "Claim" : "Close", finish, {
    color: vm.kind === "success" ? COLORS.gold : COLORS.sub,
    width: 170,
  });
  btn.setAlpha(0);
  root.add(btn);
  scene.tweens.add({ targets: btn, alpha: 1, delay: 380, duration: DUR.fade });

  return root;
}

/** Scale-pop any object in (popIn in uiKit only accepts Container/Image). */
function pop(scene: Phaser.Scene, obj: Obj): void {
  obj.setScale(0);
  obj.setAlpha(0);
  scene.tweens.add({ targets: obj, scale: 1, alpha: 1, duration: DUR.pop, ease: "Back.easeOut" });
}

function buildGlow(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  color: number,
): void {
  const glow = scene.add.circle(cx, cy, 200, color, 0.16).setBlendMode(Phaser.BlendModes.ADD);
  root.add(glow);
  scene.tweens.add({
    targets: glow,
    scale: 1.18,
    alpha: 0.28,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });
  const rays = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  rays.fillStyle(color, 0.1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.slice(cx, cy, 230, a - 0.12, a + 0.12).fillPath();
  }
  root.add(rays);
  scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
}

function openBurst(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
): void {
  const flash = scene.add.circle(x, y, 50, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD);
  root.add(flash);
  scene.tweens.add({
    targets: flash,
    scale: 2.4,
    alpha: 0,
    duration: 420,
    ease: "Cubic.out",
    onComplete: () => flash.destroy(),
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spark = scene.add.circle(x, y, 3, color, 1).setBlendMode(Phaser.BlendModes.ADD);
    root.add(spark);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(a) * 90,
      y: y + Math.sin(a) * 90,
      alpha: 0,
      duration: 520,
      ease: "Cubic.out",
      onComplete: () => spark.destroy(),
    });
  }
}

function buildSuccess(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  vm: Extract<WingCraftResultVM, { kind: "success" }>,
  cx: number,
  cardTop: number,
): void {
  const icon = makeFitIcon(scene, cx, cardTop + 78, vm.iconKey, 92, vm.emoji);
  root.add(icon);
  pop(scene, icon as unknown as Obj);

  // Name plate centers on its container's local x=0 → place the container at cx.
  const plate = scene.add.container(cx, 0);
  root.add(plate);
  addNamePlate(scene, plate, vm.name, {
    width: CARD_W - 36,
    topY: cardTop + 132,
    height: 30,
    radius: 8,
    accent: vm.color,
    color: COLORS.text,
    basePx: 16,
    minPx: 11,
  });

  root.add(
    crispText(scene, cx, cardTop + 184, vm.rarity.toUpperCase(), {
      fontSize: "12px",
      color: hex(vm.color),
      fontStyle: "bold",
    }).setOrigin(0.5),
  );

  let y = cardTop + 216;
  for (const r of vm.statRows.slice(0, MAX_ROWS)) {
    const sep = r.before && !/\s$/.test(r.before) ? " " : "";
    const line = `${r.before}${sep}${r.value}${r.after}${r.bonus ? " " + r.bonus : ""}`;
    root.add(
      crispText(scene, cx - (CARD_W - 56) / 2, y, line, {
        fontSize: "13px",
        color: SOURCE_COLOR[r.source],
      }).setOrigin(0, 0.5),
    );
    y += 26;
  }
}

function buildFailure(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  cx: number,
  cardTop: number,
): void {
  const glyph = crispText(scene, cx, cardTop + 64, "💔", { fontSize: "52px" }).setOrigin(0.5);
  root.add(glyph);
  pop(scene, glyph as unknown as Obj);

  root.add(
    crispText(scene, cx, cardTop + 134, "The wings dissolved into chaos…", {
      fontSize: "14px",
      color: hex(0xd06a6f),
      align: "center",
      fontStyle: "bold",
    }).setOrigin(0.5),
  );
  root.add(
    crispText(scene, cx, cardTop + 168, "Your materials were consumed.", {
      fontSize: "12px",
      color: COLORS.sub,
      align: "center",
    }).setOrigin(0.5),
  );
}

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
