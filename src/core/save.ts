import type { ItemSlot, TowerCollectionEntry } from "../data/schema.ts";

export const CURRENT_SAVE_VERSION = 5;

export type TowerCollection = Record<string, TowerCollectionEntry>;

export interface CurrencySave {
  crystals: number;
  pityCount: number;
  lastDailyLoginDate: string;
  /** When true, the next pull draws from the 95% Legendary / 5% Unique insurance pool. */
  pityInsuranceActive: boolean;
}

export interface StageClearRecord {
  Normal: boolean;
  Hard: boolean;
  Nightmare: boolean;
}

export interface ProgressSave {
  stageClearMap: Record<string, StageClearRecord>;
  achievementFlags: Record<string, boolean>;
  totalTowersPlaced: number;
}

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
  /** Item enhancement level (+0..+15), see core/enhance.ts (T13). */
  enhanceLevel: number;
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

/** Player-configurable audio/game settings (T9). */
export interface GameSettings {
  /** Master audio volume, 0..1. */
  volume: number;
  /** Mute all sound effects + music. */
  muted: boolean;
  /** Play the ambient background music bed. */
  musicEnabled: boolean;
}

export function defaultSettings(): GameSettings {
  return { volume: 0.7, muted: false, musicEnabled: true };
}

export interface HeroSave {
  version: number;
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  collection: TowerCollection;
  currency: CurrencySave;
  progress: ProgressSave;
  /** Chosen battle squad (tower ids, up to 7). Empty = auto-pick. */
  squad: string[];
  /** Crafting materials & loot boxes, keyed by material id → count (T13/T15). */
  materials: Record<string, number>;
  /** Audio/game settings (T9). */
  settings: GameSettings;
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
    currency: { crystals: 0, pityCount: 0, lastDailyLoginDate: "", pityInsuranceActive: false },
    progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
    squad: [],
    materials: {},
    settings: defaultSettings(),
    lastSavedAt: 0,
  };
}

export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  if ((save.version ?? 0) < 2) save = { ...save, collection: {}, version: 2 };
  if ((save.version ?? 0) < 3) save = {
    ...save,
    currency: { crystals: 0, pityCount: 0, lastDailyLoginDate: "", pityInsuranceActive: false },
    progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
    version: 3,
  };
  if ((save.version ?? 0) < 4) save = { ...save, squad: [], version: 4 };
  if ((save.version ?? 0) < 5) {
    // Add materials + default every existing item to +0.
    const items = (save.inventory?.items ?? []).map((it) => ({ ...it, enhanceLevel: it.enhanceLevel ?? 0 }));
    save = { ...save, materials: save.materials ?? {}, inventory: { ...save.inventory, items }, version: 5 };
  }
  // Defensive backfill: a save persisted AT the current version but missing a
  // field (e.g. a dev save stamped v5 before `materials` was added) skips the
  // versioned hops above and would crash on first access. Ensure every required
  // top-level field exists regardless of version.
  save.collection ??= {};
  save.squad ??= [];
  save.materials ??= {};
  save.currency ??= { crystals: 0, pityCount: 0, lastDailyLoginDate: "", pityInsuranceActive: false };
  save.progress ??= { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 };
  save.settings = { ...defaultSettings(), ...(save.settings ?? {}) };
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
