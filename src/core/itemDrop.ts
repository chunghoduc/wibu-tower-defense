import { ITEM_CATALOG, rollItem } from "../data/items.ts";
import type { Rng } from "./rng.ts";
import type { HeroSave, ItemInstanceSave } from "./save.ts";

/** Serialize a rolled ItemInstance into its persisted save shape. */
export function toItemInstanceSave(inst: ReturnType<typeof rollItem>): ItemInstanceSave {
  return {
    id: inst.id,
    defId: inst.defId,
    acquiredLevel: inst.acquiredLevel,
    rolledStats: Object.fromEntries(
      Object.entries(inst.rolledStats).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as number]),
    ),
    rolledPrimaryAffix: inst.rolledPrimaryAffix,
    rolledAffixes: inst.rolledAffixes,
    enhanceLevel: 0,
  };
}

/** Stage-derived item level: stages with a trailing number scale the drop tier. */
export function itemLevelForStage(stageId: string): number {
  const m = stageId.match(/(\d+)$/);
  const idx = m ? parseInt(m[1]) : 1;
  return Math.max(1, idx * 8 + 5);
}

/**
 * Roll a random eligible item at `itemLevel`, push it into the save inventory,
 * and return the persisted instance (or null if nothing is eligible). Shared by
 * stage-clear rewards and per-kill drops so the roll logic lives in one place.
 */
export function rollItemDrop(save: HeroSave, itemLevel: number, rng: Rng): ItemInstanceSave | null {
  const eligible = ITEM_CATALOG.filter((d) => d.requiredLevel <= itemLevel);
  if (eligible.length === 0) return null;
  const def = eligible[Math.floor(rng.next() * eligible.length)];
  const inst = rollItem(def, itemLevel, Math.floor(rng.next() * 999983));
  const instSave = toItemInstanceSave(inst);
  save.inventory.items.push(instSave);
  return instSave;
}
