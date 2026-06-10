// src/data/itemArchetype.ts
// Pure (Phaser-free) build-archetype taxonomy for items. An archetype is the
// build a piece pushes you toward — physical carry, magic caster, defensive
// tank, or utility (economy/mobility) — plus "hybrid" for deliberately mixed
// signature gear. It is a LABEL over the existing 24-stat system, derived from an
// item's primary affix (no stat is re-modelled), with an optional authored
// override for hybrids. Kept separate from any Phaser UI so the bucketing can be
// unit-tested without pulling in Phaser's device init (mirrors itemCategory.ts).

export type ItemArchetype = "physical" | "magic" | "defense" | "utility" | "hybrid";

/** Display metadata — label + tag color, reused by the tooltip tag row. */
export const ARCHETYPES: { id: ItemArchetype; label: string; color: string }[] = [
  { id: "physical", label: "Physical", color: "#ff8a5c" },
  { id: "magic", label: "Magic", color: "#5fa8ff" },
  { id: "defense", label: "Defense", color: "#6ee06e" },
  { id: "utility", label: "Utility", color: "#e8c34a" },
  { id: "hybrid", label: "Hybrid", color: "#c98bff" },
];

export const ARCHETYPE_COLOR: Record<ItemArchetype, string> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a.color]),
) as Record<ItemArchetype, string>;

export const ARCHETYPE_LABEL: Record<ItemArchetype, string> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a.label]),
) as Record<ItemArchetype, string>;

/**
 * Primary-affix type → default archetype. Every affix the catalog uses as a
 * primary maps here; anything unmapped falls back to "hybrid".
 */
const PRIMARY_ARCHETYPE: Record<string, ItemArchetype> = {
  // physical — attack / crit / pen carry
  physicalDamage: "physical", atk: "physical", critRate: "physical",
  critDamage: "physical", armorPen: "physical", attackSpeed: "physical",
  omnivamp: "physical",
  // magic — skill burst / mana / magic pen
  magicDamage: "magic", skillPower: "magic", magicPen: "magic",
  manaOnHit: "magic", manaOnKill: "magic",
  // defense — survive / tank / sustain
  maxHp: "defense", armor: "defense", magicResist: "defense",
  damageReduction: "defense", critDefense: "defense", tenacity: "defense",
  hpRegen: "defense",
  // utility — economy / mobility / reach
  goldFind: "utility", moveSpeed: "utility", range: "utility",
};

/** The build archetype of an item — authored override, else derived from primary. */
export function archetypeFor(
  def: { primaryAffix: { type: string }; archetype?: ItemArchetype },
): ItemArchetype {
  return def.archetype ?? PRIMARY_ARCHETYPE[def.primaryAffix.type] ?? "hybrid";
}

/** Default archetype for a bare primary-affix type (no override). Exposed for tests. */
export function archetypeForPrimary(primaryType: string): ItemArchetype {
  return PRIMARY_ARCHETYPE[primaryType] ?? "hybrid";
}
