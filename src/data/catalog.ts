/**
 * Catalog loader. Validates every content entry against the schema (fail loud)
 * and exposes lookup maps the battle simulation consumes.
 */
import {
  validateCharacter,
  validateEnemy,
  validateStage,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
} from "./schema.ts";
import { ENEMIES } from "./enemies.ts";
import { TOWERS } from "./towers.ts";
import { STAGE_1 } from "./stage.ts";

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

export function loadCatalog(): Catalog {
  return {
    enemies: indexById(ENEMIES, validateEnemy),
    characters: indexById(TOWERS, validateCharacter),
    stages: indexById([STAGE_1], validateStage),
  };
}
