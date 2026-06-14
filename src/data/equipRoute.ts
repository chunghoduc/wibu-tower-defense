// src/data/equipRoute.ts
//
// Decides what tapping a BAG item should do, given which concrete equip slots
// its category occupies. A category can map to several slots (a Ring fits Ring1
// AND Ring2). If any candidate slot is free we equip into it; if every candidate
// is full we compare the bag item against ALL of them at once (the modal then
// offers a per-slot Replace). Pure — no Phaser, no save mutation.
import { equipSlotsFor, type ItemDefSlot, type ItemSlot } from "./schemaEnums.ts";

export type EquipRoute =
  | { kind: "equip"; slot: ItemSlot } // a candidate slot is free → fill it
  | { kind: "compare"; slots: ItemSlot[] }; // all candidates full → compare these

export function equipRoute(
  defSlot: ItemDefSlot,
  equipped: Partial<Record<ItemSlot, string>>,
): EquipRoute {
  const candidates = equipSlotsFor(defSlot);
  const free = candidates.find((s) => !equipped[s]);
  if (free !== undefined) return { kind: "equip", slot: free };
  return { kind: "compare", slots: candidates };
}
