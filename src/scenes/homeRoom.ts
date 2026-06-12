/**
 * homeRoom — pure layout + decision math for the throne-room home screen.
 * Phaser-free so it can be unit-tested. MainMenuScene is the presenter that
 * turns these into sprites/graphics.
 */
import type { HeroSave, InventorySave } from "../core/save.ts";
import type { ItemSlot } from "../data/schema.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { itemTex } from "../data/assetKeys.ts";

/** The 9 equipped slots shown on wall hangers (Pet is excluded — it flies). */
export const HANGER_SLOTS: ItemSlot[] = [
  "Weapon", "Helmet", "BodyArmor", "Gloves", "Boots",
  "Amulet", "Ring1", "Ring2", "Wing",
];
const LEFT_COUNT = 5; // 5 hangers on the left wall, the rest on the right wall

export interface HangerCell { slot: ItemSlot; x: number; y: number; }

/** Peg positions: two vertical wall columns just inside the edge menu buttons. */
export function hangerLayout(W: number, H: number): HangerCell[] {
  const leftX = W * 0.13, rightX = W * 0.87;
  const top = H * 0.20, bot = H * 0.64;
  return HANGER_SLOTS.map((slot, i) => {
    const onLeft = i < LEFT_COUNT;
    const col = onLeft ? leftX : rightX;
    const idx = onLeft ? i : i - LEFT_COUNT;
    const count = onLeft ? LEFT_COUNT : HANGER_SLOTS.length - LEFT_COUNT;
    const t = count > 1 ? idx / (count - 1) : 0.5;
    return { slot, x: col, y: top + t * (bot - top) };
  });
}

export interface HangerItem { slot: ItemSlot; defId: string; iconKey: string; }

/** Per HANGER_SLOTS index: the equipped item to hang, or null (empty peg). */
export function equippedHangers(inv: InventorySave): (HangerItem | null)[] {
  return HANGER_SLOTS.map((slot) => {
    const instId = inv.equipped[slot];
    if (!instId) return null;
    const inst = inv.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    if (!def) return null;
    const iconKey = slot === "Wing" && def.appearanceRef ? def.appearanceRef : itemTex(def.id);
    return { slot, defId: def.id, iconKey };
  });
}

export interface SquadStand { members: string[]; showSetSquad: boolean; }

/** The selected squad to stand on the stage. No owned-tower fallback. */
export function squadStand(save: HeroSave): SquadStand {
  const members = (save.squad ?? []).slice(0, 7);
  return { members, showSetSquad: members.length === 0 };
}

export interface StandPoint { x: number; y: number; }

/** Up to n arced standing positions on the lower stage. */
export function squadStandPoints(n: number, W: number, H: number): StandPoint[] {
  const out: StandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const tt = n > 1 ? i / (n - 1) : 0.5;
    out.push({ x: W * 0.16 + tt * W * 0.68, y: H * 0.74 + Math.sin(tt * Math.PI) * -10 });
  }
  return out;
}

/** Bounded lissajous wander for the pet, in a box above the throne. */
export function petWander(elapsedMs: number, W: number, H: number): {
  x: number; y: number; faceLeft: boolean;
} {
  const t = elapsedMs / 1000;
  const cx = W * 0.50, cy = H * 0.26;
  const ax = W * 0.10, ay = H * 0.08;
  const x = cx + Math.sin(t * 0.6) * ax;
  const y = cy + Math.sin(t * 0.9 + 1.3) * ay;
  return { x, y, faceLeft: Math.cos(t * 0.6) < 0 };
}
