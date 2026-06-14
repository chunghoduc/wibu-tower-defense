/**
 * squadTiles — tile builders for SquadScene: the slotted-character tile (in a
 * squad slot) and the inventory grid character tile (with star/ascension bar).
 * Plain functions taking (scene, def, coords, callbacks); extracted verbatim
 * from SquadScene.ts.
 */
import type Phaser from "phaser";
import { starUpCost } from "../core/collection.ts";
import type { CharacterDef } from "../data/schema.ts";
import { crispText } from "./ui.ts";
import { towerTex } from "../data/assetKeys.ts";
import { roleBadgeTex } from "./roleBadge.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";

// Re-exported for SquadScene (historical import site); table lives in rarityColors.ts.
export { RARITY_HEX };

/** A slotted character: draggable (to swap/remove) + clickable (to inspect). */
export function makeSlotTile(
  scene: Phaser.Scene,
  def: CharacterDef,
  slot: number,
  x: number,
  y: number,
  w: number,
  h: number,
  onTap: (id: string) => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x + w / 2, y + h / 2).setSize(w, h);
  const key = towerTex(def.id);
  if (scene.textures.exists(key)) {
    const img = scene.add.image(-w / 2 + 22, 0, key).setOrigin(0.5);
    img.setScale(38 / img.height);
    c.add(img);
  }
  c.add(
    crispText(scene, -w / 2 + 44, -10, def.name, {
      fontSize: "8px",
      color: RARITY_HEX[def.rarity],
      wordWrap: { width: w - 48 },
    }),
  );
  c.setData("charId", def.id);
  c.setData("fromSlot", slot);
  c.setInteractive({ useHandCursor: true, draggable: true });
  c.on("pointerup", () => onTap(def.id));
  return c;
}

export function makeCharTile(
  scene: Phaser.Scene,
  t: CharacterDef,
  cx: number,
  cy: number,
  w: number,
  h: number,
  stars: number,
  copies: number,
  inSquad: boolean,
  selected: boolean,
  onTap: (id: string) => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
  const g = scene.add.graphics();
  g.fillStyle(inSquad ? 0x23344a : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  g.lineStyle(
    selected ? 3 : inSquad ? 2.5 : 1.5,
    selected ? 0x7ec8ff : inSquad ? 0xffd24a : RARITY_INT[t.rarity],
    selected || inSquad ? 1 : 0.85,
  ).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  c.add(g);
  const key = towerTex(t.id);
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, -8, key).setOrigin(0.5);
    img.setScale(40 / img.height);
    c.add(img);
  }
  // Role emblem on the portrait's lower-right so the role reads in the roster
  // grid, not just on the info panel. Guarded for headless/no-art runs.
  const rbKey = roleBadgeTex(t.role);
  if (scene.textures.exists(rbKey)) {
    const emblem = scene.add.image(14, 6, rbKey);
    emblem.setScale(15 / (emblem.height || 15));
    c.add(emblem);
  }
  c.add(
    crispText(scene, 0, h / 2 - 16, t.name, {
      fontSize: "8px",
      color: RARITY_HEX[t.rarity],
      align: "center",
      wordWrap: { width: w - 8 },
    }).setOrigin(0.5, 0),
  );
  if (stars > 0)
    c.add(
      crispText(scene, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), {
        fontSize: "9px",
        color: "#ffd24a",
      }),
    );
  if (inSquad)
    c.add(
      crispText(scene, w / 2 - 6, -h / 2 + 3, "✓", {
        fontSize: "12px",
        color: "#a5d6a7",
        fontStyle: "bold",
      }).setOrigin(1, 0),
    );

  // Ascension progress bar along the bottom edge: copies toward the next star,
  // gold when maxed, green when enough copies are banked to upgrade.
  const cost = starUpCost(stars);
  const bw = w - 10,
    bx = -bw / 2,
    by = h / 2 - 4;
  const bar = scene.add.graphics();
  bar.fillStyle(0x0b1018, 1).fillRoundedRect(bx, by, bw, 3, 1.5);
  if (!cost) {
    bar.fillStyle(0xffd24a, 1).fillRoundedRect(bx, by, bw, 3, 1.5); // maxed
  } else {
    const frac = Math.max(0, Math.min(1, copies / cost.copies));
    if (frac > 0)
      bar
        .fillStyle(copies >= cost.copies ? 0x52c878 : 0x4a78c8, 1)
        .fillRoundedRect(bx, by, bw * frac, 3, 1.5);
  }
  c.add(bar);

  c.setData("charId", t.id);
  c.setInteractive({ useHandCursor: true, draggable: true });
  c.on("pointerup", () => onTap(t.id));
  return c;
}
