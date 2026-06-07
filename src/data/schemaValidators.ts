/**
 * Runtime schema validators — split out of schema.ts to keep both files focused.
 * Each asserts the invariants the catalogs rely on and returns the value through,
 * so loaders can `indexById(DATA, validateX)`.
 */
import {
  ATTACK_DAMAGE_TYPES, DAMAGE_TYPES, ENEMY_ARCHETYPES, IMMUNITIES, ITEM_SLOTS,
  PASSIVE_NODE_TYPES, PASSIVE_REGIONS, RARITIES, TARGET_TYPES, TOWER_ROLES, WEAPON_TYPES,
  type ActiveSkillDef, type CharacterDef, type EnemyDef, type ItemDef, type PassiveNodeDef, type StageDef,
} from "./schema.ts";

export class SchemaError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SchemaError(message);
}

export function validateCharacter(c: CharacterDef): CharacterDef {
  assert(c.id, "character: missing id");
  assert(c.description.trim().length > 0, `character ${c.id}: missing description`);
  assert((RARITIES as readonly string[]).includes(c.rarity), `character ${c.id}: bad rarity`);
  assert((TOWER_ROLES as readonly string[]).includes(c.role), `character ${c.id}: bad role`);
  assert(
    (ATTACK_DAMAGE_TYPES as readonly string[]).includes(c.damageType),
    `character ${c.id}: basic-attack damageType must be Physical or Magic (True is skill-only)`,
  );
  assert((TARGET_TYPES as readonly string[]).includes(c.target), `character ${c.id}: bad target`);
  assert(c.cost >= 0, `character ${c.id}: cost must be >= 0`);
  assert(
    c.passives.length >= 1 && c.passives.length <= 3,
    `character ${c.id}: must have 1-3 passives`,
  );
  return c;
}

export function validateEnemy(e: EnemyDef): EnemyDef {
  assert(e.id, "enemy: missing id");
  assert(
    (ENEMY_ARCHETYPES as readonly string[]).includes(e.archetype),
    `enemy ${e.id}: bad archetype`,
  );
  assert(
    e.immunity === null || (IMMUNITIES as readonly string[]).includes(e.immunity),
    `enemy ${e.id}: bad immunity (must be one of ${IMMUNITIES.join(", ")} or null)`,
  );
  assert(e.baseStats.maxHp > 0, `enemy ${e.id}: maxHp must be > 0`);
  assert(e.bounty >= 0, `enemy ${e.id}: bounty must be >= 0`);
  return e;
}

export function validateStage(s: StageDef): StageDef {
  assert(s.id, "stage: missing id");
  assert(s.path.length >= 2, `stage ${s.id}: path needs >= 2 waypoints`);
  assert(s.castleHp > 0, `stage ${s.id}: castleHp must be > 0`);
  assert(s.waves.length >= 1, `stage ${s.id}: needs >= 1 wave`);
  return s;
}

export function validateActiveSkill(s: ActiveSkillDef): ActiveSkillDef {
  assert(s.id.trim().length > 0, "activeSkill: missing id");
  assert(s.name.trim().length > 0, `activeSkill ${s.id}: missing name`);
  assert(s.description.trim().length > 0, `activeSkill ${s.id}: missing description`);
  assert((RARITIES as readonly string[]).includes(s.rarity), `activeSkill ${s.id}: bad rarity`);
  assert((DAMAGE_TYPES as readonly string[]).includes(s.damageType), `activeSkill ${s.id}: bad damageType`);
  assert(s.basePower > 0, `activeSkill ${s.id}: basePower must be > 0`);
  if (s.requiresWeapon !== undefined) {
    assert((WEAPON_TYPES as readonly string[]).includes(s.requiresWeapon), `activeSkill ${s.id}: bad requiresWeapon`);
  }
  return s;
}

export function validatePassiveNode(n: PassiveNodeDef): PassiveNodeDef {
  assert(n.id.trim().length > 0, "passiveNode: missing id");
  assert(n.name.trim().length > 0, `passiveNode ${n.id}: missing name`);
  assert(n.description.trim().length > 0, `passiveNode ${n.id}: missing description`);
  assert((PASSIVE_NODE_TYPES as readonly string[]).includes(n.type), `passiveNode ${n.id}: bad type`);
  assert((PASSIVE_REGIONS as readonly string[]).includes(n.region), `passiveNode ${n.id}: bad region`);
  assert(n.neighbors.length >= 1, `passiveNode ${n.id}: must have at least 1 neighbor`);
  return n;
}

export function validateItemDef(item: ItemDef): ItemDef {
  assert(item.id.trim().length > 0, "item: missing id");
  assert(item.name.trim().length > 0, `item ${item.id}: missing name`);
  // Items use category slots: any equip slot EXCEPT the two ring slots, or "Ring".
  const s = item.slot as string;
  assert(
    s === "Ring" || ((ITEM_SLOTS as readonly string[]).includes(s) && s !== "Ring1" && s !== "Ring2"),
    `item ${item.id}: bad slot (rings must use "Ring", not Ring1/Ring2)`,
  );
  assert((RARITIES as readonly string[]).includes(item.rarity), `item ${item.id}: bad rarity`);
  assert(item.requiredLevel >= 1, `item ${item.id}: requiredLevel must be >= 1`);
  if (item.slot === "Weapon") {
    assert(item.weaponType !== undefined, `item ${item.id}: Weapon slot requires weaponType`);
    assert((WEAPON_TYPES as readonly string[]).includes(item.weaponType!), `item ${item.id}: invalid weaponType`);
  }
  assert(item.primaryAffix.baseValue > 0, `item ${item.id}: primaryAffix.baseValue must be > 0`);
  return item;
}
