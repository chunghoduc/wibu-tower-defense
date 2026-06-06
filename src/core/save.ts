import type { ItemSlot, TowerCollectionEntry } from "../data/schema.ts";

export const CURRENT_SAVE_VERSION = 2;

export type TowerCollection = Record<string, TowerCollectionEntry>;

export interface RolledAffix {
  type: string;
  value: number;
}

export interface ItemInstanceSave {
  id: string;
  defId: string;
  acquiredLevel: number;
  rolledStats: Record<string, number>;
  rolledPrimaryAffix: number;
  rolledAffixes: RolledAffix[];
}

export interface HeroSkillEntry {
  skillId: string;
  level: number;
  useXp: number;
}

export interface HeroProgressSave {
  level: number;
  totalXp: number;
  skillPoints: number;
  unlockedNodes: string[];
  obtainedSkills: HeroSkillEntry[];
  equippedSkillId: string | null;
}

export interface InventorySave {
  items: ItemInstanceSave[];
  equipped: Partial<Record<ItemSlot, string>>;
}

export interface HeroSave {
  version: number;
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  collection: TowerCollection;
  lastSavedAt: number;
}

let _heroIdCounter = 0;

export function createFreshSave(): HeroSave {
  return {
    version: CURRENT_SAVE_VERSION,
    heroId: `hero-${Date.now()}-${++_heroIdCounter}`,
    hero: {
      level: 1,
      totalXp: 0,
      skillPoints: 0,
      unlockedNodes: [],
      obtainedSkills: [],
      equippedSkillId: null,
    },
    inventory: {
      items: [],
      equipped: {},
    },
    collection: {},
    lastSavedAt: 0,
  };
}

export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  if ((save.version ?? 0) < 2) save = { ...save, collection: {}, version: 2 };
  save.version = CURRENT_SAVE_VERSION;
  return save;
}

export interface SaveProvider {
  load(): HeroSave | null;
  persist(data: HeroSave): void;
  clear(): void;
}

const SAVE_KEY = "wibu-td-save";

export class LocalSaveProvider implements SaveProvider {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): HeroSave | null {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return null;
      return loadAndMigrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  persist(data: HeroSave): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}
