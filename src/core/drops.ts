import type { Difficulty } from "../data/schema.ts";
import { ITEM_CATALOG, rollItem } from "../data/items.ts";
import { ACTIVE_SKILLS } from "../data/skills.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { Rng } from "./rng.ts";
import { BLESS_JEWEL, SOUL_JEWEL } from "../data/materials.ts";
import type { HeroSave, ItemInstanceSave } from "./save.ts";

export const CRYSTAL_REWARD: Record<Difficulty, number> = {
  Normal: 20,
  Hard: 30,
  Nightmare: 50,
};
const FIRST_CLEAR_BONUS = 50;
const ITEM_DROP_CHANCE = 0.30;
const SKILL_DROP_CHANCE = 0.15;
const CHARACTER_DROP_CHANCE = 0.05;

export interface DropResult {
  crystalsAwarded: number;
  itemDropped: ItemInstanceSave | null;
  skillDropped: string | null;
  characterDropped: string | null;
  isFirstClear: boolean;
  /** Enhance jewels (+ later boxes) gained this clear, by material id (T13/T15). */
  materialsDropped: Record<string, number>;
}

// Every stage clear kills that stage's boss, so jewels drop from a win.
const BLESS_DROP_CHANCE = 0.5;   // a clear usually yields a Bless jewel
const SOUL_DROP_CHANCE = 0.15;   // Soul jewels are rarer (for high enhances)

export function processStageClear(
  save: HeroSave,
  stageId: string,
  difficulty: Difficulty,
  rng: Rng,
): DropResult {
  if (!save.progress.stageClearMap[stageId]) {
    save.progress.stageClearMap[stageId] = { Normal: false, Hard: false, Nightmare: false };
  }
  const isFirstClear = !save.progress.stageClearMap[stageId][difficulty];
  save.progress.stageClearMap[stageId][difficulty] = true;

  const crystalsAwarded = CRYSTAL_REWARD[difficulty] + (isFirstClear ? FIRST_CLEAR_BONUS : 0);
  save.currency.crystals += crystalsAwarded;

  const stageMatch = stageId.match(/(\d+)$/);
  const stageIndex = stageMatch ? parseInt(stageMatch[1]) : 1;
  const itemLevel = Math.max(1, stageIndex * 8 + 5);

  let itemDropped: ItemInstanceSave | null = null;
  if (rng.next() < ITEM_DROP_CHANCE) {
    const eligible = ITEM_CATALOG.filter((d) => d.requiredLevel <= itemLevel);
    if (eligible.length > 0) {
      const def = eligible[Math.floor(rng.next() * eligible.length)];
      const inst = rollItem(def, itemLevel, Math.floor(rng.next() * 999983));
      const instSave: ItemInstanceSave = {
        id: inst.id,
        defId: inst.defId,
        acquiredLevel: inst.acquiredLevel,
        rolledStats: Object.fromEntries(
          Object.entries(inst.rolledStats).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as number])
        ),
        rolledPrimaryAffix: inst.rolledPrimaryAffix,
        rolledAffixes: inst.rolledAffixes,
        enhanceLevel: 0,
      };
      save.inventory.items.push(instSave);
      itemDropped = instSave;
    }
  }

  let skillDropped: string | null = null;
  if (rng.next() < SKILL_DROP_CHANCE) {
    const ownedSkills = new Set(save.hero.obtainedSkills.map((s) => s.skillId));
    const available = ACTIVE_SKILLS.filter((s) => !ownedSkills.has(s.id));
    if (available.length > 0) {
      const skill = available[Math.floor(rng.next() * available.length)];
      save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
      skillDropped = skill.id;
    }
  }

  let characterDropped: string | null = null;
  if (rng.next() < CHARACTER_DROP_CHANCE) {
    const pool = TOWERS.filter(
      (t) => (t.rarity === "Common" || t.rarity === "Magic") && !(t.id in save.collection)
    );
    if (pool.length > 0) {
      const char = pool[Math.floor(rng.next() * pool.length)];
      addTowerToCollection(save, char.id);
      characterDropped = char.id;
    }
  }

  // Enhance jewels (T13). Scale a touch with difficulty.
  const materialsDropped: Record<string, number> = {};
  const giveMat = (id: string, n: number) => {
    save.materials[id] = (save.materials[id] ?? 0) + n;
    materialsDropped[id] = (materialsDropped[id] ?? 0) + n;
  };
  const diffBonus = difficulty === "Nightmare" ? 0.2 : difficulty === "Hard" ? 0.1 : 0;
  if (rng.next() < BLESS_DROP_CHANCE + diffBonus) giveMat(BLESS_JEWEL, 1);
  if (rng.next() < SOUL_DROP_CHANCE + diffBonus) giveMat(SOUL_JEWEL, 1);

  return { crystalsAwarded, itemDropped, skillDropped, characterDropped, isFirstClear, materialsDropped };
}
