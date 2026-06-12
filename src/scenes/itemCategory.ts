// src/scenes/itemCategory.ts
// Pure (Phaser-free) "category" taxonomy for item grids. Buckets the equipment
// slots into the three families a player thinks in — weapons, armour,
// accessories — plus an "All" passthrough. Kept separate from the chip-builder
// UI in itemFilter.ts so the bucketing can be unit-tested without pulling in
// Phaser's device init.
import type { ItemDefSlot } from "../data/schemaEnums.ts";

export type ItemCategory = "all" | "weapon" | "armor" | "accessory";

export const CATS: { id: ItemCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "weapon", label: "Weapon" },
  { id: "armor", label: "Armor" },
  { id: "accessory", label: "Accessory" },
];

const ARMOR_SLOTS: ItemDefSlot[] = ["Helmet", "BodyArmor", "Gloves", "Boots"];

/** Does an item with this def-slot belong to the given category? */
export function slotInCategory(slot: ItemDefSlot, cat: ItemCategory): boolean {
  switch (cat) {
    case "all":
      return true;
    case "weapon":
      return slot === "Weapon";
    case "armor":
      return ARMOR_SLOTS.includes(slot);
    case "accessory":
      return slot === "Amulet" || slot === "Ring" || slot === "Pet" || slot === "Wing";
  }
}
