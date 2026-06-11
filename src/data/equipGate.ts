/**
 * Level gate for equipping an item — mirrors the `equipItem` rule
 * (`hero.level < instanceReqLevel(...)` blocks the equip). Pure / Phaser-free
 * so the Replace and Equip buttons can show an *advance* disabled state and a
 * hover hint instead of failing silently with a toast.
 */
export interface EquipLevelGate {
  /** Whether the hero may equip (heroLevel >= reqLevel). */
  met: boolean;
  /** The item's required level (resolve via instanceReqLevel at the call site). */
  reqLevel: number;
  /** The hero's current level. */
  heroLevel: number;
  /** "" when met, else "Requires level N · you are M" for the hover hint. */
  hint: string;
}

export function equipLevelGate(heroLevel: number, reqLevel: number): EquipLevelGate {
  const met = heroLevel >= reqLevel;
  return {
    met,
    reqLevel,
    heroLevel,
    hint: met ? "" : `Requires level ${reqLevel} · you are ${heroLevel}`,
  };
}
