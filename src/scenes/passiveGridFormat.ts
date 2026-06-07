import type { PassiveNodeDef } from "../data/schema.ts";

/** Human-readable bonus list for a node's flat / increased% / more% stat bags. */
export function formatStatBonuses(node: PassiveNodeDef): string {
  const lines: string[] = [];

  const fmt = (label: string, v: number, pct: boolean) => {
    const sign = v >= 0 ? "+" : "";
    const val = pct ? `${sign}${(v * 100).toFixed(0)}%` : `${sign}${v}`;
    lines.push(`${val} ${label}`);
  };

  if (node.flat) {
    for (const [k, v] of Object.entries(node.flat) as [string, number][]) {
      if (v) fmt(statLabel(k), v, false);
    }
  }
  if (node.increased) {
    for (const [k, v] of Object.entries(node.increased) as [string, number][]) {
      if (v) fmt(statLabel(k), v, true);
    }
  }
  if (node.more) {
    for (const [k, v] of Object.entries(node.more) as [string, number][]) {
      if (v) lines.push(`×${(1 + v).toFixed(2)} ${statLabel(k)} (more)`);
    }
  }

  return lines.join("\n") || (node.effectId ? `Effect: ${node.effectId}` : "");
}

const STAT_LABELS: Record<string, string> = {
  atk: "ATK", attackSpeed: "Atk Speed", range: "Range",
  critRate: "Crit Rate", critDamage: "Crit Dmg", armorPen: "Armor Pen",
  magicPen: "Magic Pen", skillPower: "Skill Power",
  maxHp: "Max HP", hpRegen: "HP Regen", armor: "Armor",
  magicResist: "Magic Resist", damageReduction: "Dmg Reduction",
  tenacity: "Tenacity", maxMana: "Max Mana", manaRegen: "Mana Regen",
  manaOnHit: "Mana/Hit", manaOnKill: "Mana/Kill",
  manaCostReduction: "Mana Cost Red.", omnivamp: "Omnivamp",
  moveSpeed: "Move Speed", goldFind: "Gold Find",
};

function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}
