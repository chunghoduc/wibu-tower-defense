/**
 * Catalog loader. Validates every content entry against the schema and
 * cross-checks references (wave/summon/split enemy ids must exist), then exposes
 * lookup maps the battle simulation consumes. Fails loud on bad content.
 */
import {
  SchemaError,
  validateCharacter,
  validateEnemy,
  validateStage,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
} from "./schema.ts";
import { ENEMIES } from "./enemies.ts";
import { TOWERS } from "./towers.ts";
import { STAGES } from "./stage.ts";

export interface Catalog {
  enemies: Map<string, EnemyDef>;
  characters: Map<string, CharacterDef>;
  stages: Map<string, StageDef>;
}

function indexById<T extends { id: string }>(items: T[], validate: (item: T) => T): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const ok = validate(item);
    if (map.has(ok.id)) throw new Error(`duplicate id in catalog: ${ok.id}`);
    map.set(ok.id, ok);
  }
  return map;
}

/** Verify every enemy id an enemy/stage references actually exists. */
function checkReferences(enemies: Map<string, EnemyDef>, stages: Map<string, StageDef>): void {
  const need = (id: string, where: string) => {
    if (!enemies.has(id)) throw new SchemaError(`${where} references unknown enemy "${id}"`);
  };
  for (const e of enemies.values()) {
    if (e.special?.splitInto) need(e.special.splitInto.enemyId, `enemy ${e.id} splitInto`);
    if (e.special?.summon) need(e.special.summon.enemyId, `enemy ${e.id} summon`);
    if (e.boss?.summon) need(e.boss.summon.enemyId, `enemy ${e.id} boss.summon`);
  }
  for (const s of stages.values()) {
    for (const wave of s.waves) {
      for (const grp of wave.spawns) need(grp.enemyId, `stage ${s.id}`);
    }
  }
}

export function loadCatalog(): Catalog {
  const enemies = indexById(ENEMIES, validateEnemy);
  const characters = indexById(TOWERS, validateCharacter);
  const stages = indexById(STAGES, validateStage);
  checkReferences(enemies, stages);
  return { enemies, characters, stages };
}
