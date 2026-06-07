/**
 * Scrollable enemy-intel panel — a modal list of foes with their specialty and
 * threat tags. Shared by the stage-select global compendium ("? Enemies") and the
 * per-stage "Foes" button so both render identically. Bosses sort to the bottom
 * and are tinted so they read as the headline threat.
 */
import Phaser from "phaser";
import type { EnemyDef } from "../data/schema.ts";
import { ENEMIES } from "../data/enemies.ts";
import type { StageDef } from "../data/schema.ts";
import { enemySpecialty, enemyTags } from "../data/enemyInfo.ts";

const ENEMY_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

/** Unique enemies appearing in a stage's waves, rushers first and the boss last. */
export function enemiesForStage(stage: StageDef): EnemyDef[] {
  const ids = new Set<string>();
  for (const wave of stage.waves) for (const s of wave.spawns) ids.add(s.enemyId);
  const defs = [...ids].map((id) => ENEMY_BY_ID.get(id)).filter((e): e is EnemyDef => Boolean(e));
  return defs.sort((a, b) => Number(a.archetype === "Boss") - Number(b.archetype === "Boss"));
}

/**
 * Open a modal listing `enemies` with their specialties. Returns the root
 * container (already added to the scene) so callers can keep a handle if needed.
 */
export function openEnemyPanel(scene: Phaser.Scene, title: string, subtitle: string, enemies: EnemyDef[]): Phaser.GameObjects.Container {
  const W = scene.scale.width, H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(100);

  const overlay = scene.add.rectangle(0, 0, W, H, 0x05070c, 0.82).setOrigin(0).setInteractive();
  root.add(overlay);

  const PX = 80, PY = 40, PW = W - 160, PH = H - 80;
  const panel = scene.add.graphics();
  panel.fillStyle(0x141a26, 1).fillRoundedRect(PX, PY, PW, PH, 10);
  panel.lineStyle(2, 0x3a4a6a, 1).strokeRoundedRect(PX, PY, PW, PH, 10);
  root.add(panel);
  root.add(scene.add.text(PX + 16, PY + 12, title, { fontSize: "20px", color: "#ffd700", fontStyle: "bold" }));
  root.add(scene.add.text(PX + 16, PY + 38, subtitle, { fontSize: "11px", color: "#90a4bb" }));
  const close = scene.add.text(PX + PW - 14, PY + 12, "✕", { fontSize: "20px", color: "#ef9a9a" })
    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
  close.on("pointerdown", () => root.destroy(true));
  root.add(close);

  // Scrollable list viewport
  const vpX = PX + 14, vpY = PY + 64, vpW = PW - 28, vpH = PH - 78;
  const list = scene.add.container(vpX, vpY);
  root.add(list);
  const maskG = scene.make.graphics({}).fillRect(vpX, vpY, vpW, vpH);
  list.setMask(maskG.createGeometryMask());

  const ROW_H = 58;
  enemies.forEach((e, i) => {
    const y = i * ROW_H;
    const boss = e.archetype === "Boss";
    const card = scene.add.graphics();
    card.fillStyle(boss ? 0x2a1f2e : 0x1c2433, 1).fillRoundedRect(0, y, vpW, ROW_H - 6, 6);
    list.add(card);
    const key = `${boss ? "boss" : "enemy"}__${e.id}`;
    if (scene.textures.exists(key)) {
      const img = scene.add.image(28, y + (ROW_H - 6) / 2, key).setOrigin(0.5);
      const s = 40 / Math.max(img.width, img.height);
      img.setScale(s);
      list.add(img);
    }
    list.add(scene.add.text(56, y + 6, e.name, { fontSize: "13px", color: boss ? "#ff9a9a" : "#e6edf6", fontStyle: "bold" }));
    list.add(scene.add.text(56, y + 23, `${e.archetype}  ·  ${enemySpecialty(e)}`, { fontSize: "10px", color: "#aab8cc", wordWrap: { width: vpW - 220 } }));
    const tags = enemyTags(e);
    if (tags.length) {
      list.add(scene.add.text(vpW - 8, y + 8, tags.join("  ·  "), { fontSize: "9px", color: "#7fd0a0", align: "right", wordWrap: { width: 160 } }).setOrigin(1, 0));
    }
  });

  const contentH = enemies.length * ROW_H;
  const minY = vpY - Math.max(0, contentH - vpH);

  let dragging = false, dragStart = 0, listStart = 0;
  overlay.on("pointerdown", (p: Phaser.Input.Pointer) => {
    if (!root.active) return;
    const inPanel = p.x >= PX && p.x <= PX + PW && p.y >= PY && p.y <= PY + PH;
    if (!inPanel) { root.destroy(true); return; }
    dragging = true; dragStart = p.y; listStart = list.y;
  });
  const wheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (list.active) list.y = Phaser.Math.Clamp(list.y - dy * 0.5, minY, vpY);
  };
  const move = (p: Phaser.Input.Pointer) => {
    if (dragging && list.active) list.y = Phaser.Math.Clamp(listStart + (p.y - dragStart), minY, vpY);
  };
  const up = () => { dragging = false; };
  scene.input.on("wheel", wheel);
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", up);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off("wheel", wheel);
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", up);
  });
  return root;
}
