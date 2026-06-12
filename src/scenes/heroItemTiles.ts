/**
 * heroItemTiles — inventory tile builders for the Hero loadout screen: the
 * draggable item tile (rarity frame, art, +N enhance badge, hover glow), the
 * material/box tile (count, rarity tier, opening odds), and the plain text
 * tooltip card the material tiles use. HeroScene owns drag/drop and dialogs;
 * these only build the tiles and report interactions through callbacks.
 */
import Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { ItemSlot } from "../data/schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import { MATERIALS_MAP, BOX_RARITY_COLOR, boxRarityName } from "../data/materials.ts";
import { boxOddsText } from "../core/boxes.ts";
import { materialTex, boxTex, itemTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";

export const TILE = 52;

export interface ItemTileCallbacks {
  showTooltip(inst: ItemInstanceSave, x: number, y: number): void;
  hideTooltip(): void;
  /** True while a tile drag or grid scroll is in flight (suppresses the tap action). */
  tapBlocked(): boolean;
  /** Tap (not drag) = compare-to-replace or enhance. */
  onTap(inst: ItemInstanceSave, fromSlot: ItemSlot | null): void;
}

/** A draggable item tile centered at (x,y). `size` lets doll slots be smaller. */
export function makeItemTile(
  scene: Phaser.Scene,
  inst: ItemInstanceSave,
  x: number,
  y: number,
  fromSlot: ItemSlot | null,
  cb: ItemTileCallbacks,
  size = TILE,
): Phaser.GameObjects.Container {
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  const c = scene.add.container(x, y).setSize(size, size).setDepth(8);
  const g = scene.add.graphics();
  g.fillStyle(0x1c2636, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 5);
  g.lineStyle(2, RARITY_INT[rarity], 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
  c.add(g);
  const key = itemTex(inst.defId);
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, -2, key).setOrigin(0.5);
    img.setScale((size - 12) / img.height);
    c.add(img);
  } else {
    c.add(
      scene.add
        .text(0, -4, (def?.name ?? "?").slice(0, 6), {
          fontSize: "8px",
          color: RARITY_HEX[rarity],
          align: "center",
          wordWrap: { width: size - 6 },
        })
        .setOrigin(0.5),
    );
  }
  if (size >= TILE) {
    c.add(
      scene.add
        .text(
          0,
          size / 2 - 8,
          def?.slot === "Weapon"
            ? (def.weaponType ?? "")
            : (def?.slot.replace(/Ring[12]/, "Ring") ?? ""),
          { fontSize: "7px", color: "#8aa0bb" },
        )
        .setOrigin(0.5),
    );
  }

  // Enhancement level badge (+N) — top-right (T13).
  if ((inst.enhanceLevel ?? 0) > 0) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a1206, 0.9).fillCircle(size / 2 - 8, -size / 2 + 8, 9);
    bg.lineStyle(1.5, 0xffd34d, 1).strokeCircle(size / 2 - 8, -size / 2 + 8, 9);
    c.add(bg);
    c.add(
      crispText(scene, size / 2 - 8, -size / 2 + 8, `+${inst.enhanceLevel}`, {
        fontSize: "10px",
        color: "#ffe07a",
        fontStyle: "bold",
      }).setOrigin(0.5),
    );
  }

  c.setData("instanceId", inst.id).setData("fromSlot", fromSlot);
  c.setInteractive({ useHandCursor: true, draggable: true });
  // Hover feedback: a bright glow border over the tile + a gentle scale pop.
  const glow = scene.add.graphics().setVisible(false);
  glow.fillStyle(0xfff0bf, 0.1).fillRoundedRect(-size / 2, -size / 2, size, size, 5);
  glow.lineStyle(2.5, 0xfff0bf, 0.95).strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
  c.add(glow);
  c.on("pointerover", () => {
    cb.showTooltip(inst, x, y);
    glow.setVisible(true);
    c.setDepth(30);
    scene.tweens.add({
      targets: c,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 90,
      ease: "Back.easeOut",
    });
  });
  c.on("pointerout", () => {
    cb.hideTooltip();
    glow.setVisible(false);
    c.setDepth(8);
    scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120, ease: "Quad.easeOut" });
  });
  c.on("pointerup", () => {
    if (!cb.tapBlocked()) cb.onTap(inst, fromSlot);
  }); // tap = compare-to-replace or enhance
  return c;
}

export interface MaterialTileCallbacks {
  showTextTooltip(title: string, desc: string, x: number, y: number): void;
  hideTooltip(): void;
  /** Open a chest (only wired when the tile is a box). */
  onOpen(id: string): void;
}

/** A material/box tile showing its count; boxes are clickable to open (T15). */
export function makeMaterialTile(
  scene: Phaser.Scene,
  id: string,
  count: number,
  x: number,
  y: number,
  openable: boolean,
  cb: MaterialTileCallbacks,
): Phaser.GameObjects.Container {
  const def = MATERIALS_MAP.get(id);
  const rarity = def?.rarity; // boxes carry a 1..5 rarity tier
  const border = rarity ? (BOX_RARITY_COLOR[rarity] ?? 0xffb74d) : openable ? 0xffb74d : 0x7ec8ff;
  const c = scene.add.container(x, y).setSize(TILE, TILE);
  const g = scene.add.graphics();
  g.fillStyle(0x1c2636, 1).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
  g.lineStyle(rarity ? 2.5 : 2, border, 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
  c.add(g);
  // Painted art per material: boxes use their chest art (box__<id>), other
  // materials (enhance jewels, scroll) use material__<id>. Fall back to an emoji.
  const spriteKey = scene.textures.exists(materialTex(id)) ? materialTex(id) : boxTex(id);
  if (scene.textures.exists(spriteKey)) {
    const img = scene.add.image(0, -4, spriteKey).setOrigin(0.5);
    img.setScale((TILE - 16) / img.height);
    c.add(img);
  } else {
    c.add(scene.add.text(0, -10, openable ? "🎁" : "💠", { fontSize: "20px" }).setOrigin(0.5));
  }
  if (rarity)
    c.add(
      crispText(scene, 0, TILE / 2 - 13, boxRarityName(rarity), {
        fontSize: "8px",
        color: Phaser.Display.Color.IntegerToColor(border).rgba,
        fontStyle: "bold",
      }).setOrigin(0.5),
    );
  c.add(
    crispText(scene, TILE / 2 - 4, -TILE / 2 + 4, `×${count}`, {
      fontSize: "11px",
      color: "#fff",
      fontStyle: "bold",
    }).setOrigin(1, 0),
  );
  c.setInteractive({ useHandCursor: true });
  // Boxes show their opening odds (drop rates) under the description so the
  // player can see what's inside before spending the chest.
  const desc = openable
    ? def?.description
      ? `${def.description}\n\n${boxOddsText(id)}`
      : boxOddsText(id)
    : (def?.description ?? "");
  c.on("pointerover", () => cb.showTextTooltip(def?.name ?? id, desc, x, y));
  c.on("pointerout", () => cb.hideTooltip());
  if (openable) c.on("pointerup", () => cb.onOpen(id));
  return c;
}

/** Render a plain title+body tooltip card into `tooltip` (cleared first) near (x,y). */
export function renderTextTooltip(
  scene: Phaser.Scene,
  tooltip: Phaser.GameObjects.Container,
  title: string,
  desc: string,
  x: number,
  y: number,
): void {
  tooltip.removeAll(true);
  const w = 200,
    padX = 10;
  // Measure the wrapped body so the card grows to fit instead of clipping it.
  const titleT = panelText(scene, 0, 0, title, {
    fontSize: "13px",
    color: "#cfe6ff",
    fontStyle: "bold",
    wordWrap: { width: w - padX * 2 },
  });
  const descT = desc
    ? panelText(scene, 0, 0, desc, {
        fontSize: "11px",
        color: "#cdd9ea",
        wordWrap: { width: w - padX * 2 },
        lineSpacing: 3,
      })
    : null;
  const h = 12 + titleT.height + (descT ? descT.height + 4 : 0);
  const tx = Phaser.Math.Clamp(x + 30, 0, scene.scale.width - w),
    ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
  const g = scene.add.graphics();
  g.fillStyle(0x10141c, 0.98).fillRoundedRect(tx, ty, w, h, 6);
  g.lineStyle(1.5, 0x7ec8ff, 1).strokeRoundedRect(tx, ty, w, h, 6);
  tooltip.add(g);
  titleT.setPosition(tx + padX, ty + 7);
  tooltip.add(titleT);
  if (descT) {
    descT.setPosition(tx + padX, ty + 9 + titleT.height);
    tooltip.add(descT);
  }
  tooltip.setVisible(true);
}
