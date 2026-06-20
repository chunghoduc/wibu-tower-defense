import type { ItemSlot, TowerCollectionEntry } from "../data/schema.ts";
import { STARTER_SKILL_IDS, MAX_ACTIVE_SKILLS } from "../data/skills.ts";
import { type MetaSave, defaultMeta, backfillMeta } from "./meta.ts";

export const CURRENT_SAVE_VERSION = 15;

export type TowerCollection = Record<string, TowerCollectionEntry>;

export interface CurrencySave {
  /** Everyday currency — stage rewards, enemy drops, shop purchases, enhancements. */
  gold: number;
  /** Premium currency — small stage/boss rewards, used for summons and high-rarity shop. */
  diamonds: number;
  pityCount: number;
  lastDailyLoginDate: string;
  /** When true, the next pull draws from the 95% Legendary / 5% Unique insurance pool. */
  pityInsuranceActive: boolean;
  /**
   * Epoch ms at which the next FREE single summon becomes claimable. A free
   * summon is available whenever `Date.now() >= freeSummonReadyAt`. The 8-hour
   * timer only restarts when the free summon is actually claimed, so at most one
   * free summon is ever banked. `0` means "available now" (fresh/migrated saves).
   */
  freeSummonReadyAt: number;
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
  /** Rolled required level for this copy (>= def floor, <= 90). Optional for
   *  backward compat — fall back to the def's requiredLevel when absent. */
  requiredLevel?: number;
  /** True when this copy rolled the level-90 Apex effect. */
  apex?: boolean;
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

/** One owned skill jewel instance (no per-instance rolls — mods come from the def). */
export interface JewelInstanceSave {
  id: string;
  defId: string;
}

export interface HeroProgressSave {
  level: number;
  totalXp: number;
  skillPoints: number;
  unlockedNodes: string[];
  /** nodeId → chosen PassiveChoiceOption.id, for unlocked "choose" nodes. */
  nodeChoices: Record<string, string>;
  obtainedSkills: HeroSkillEntry[];
  /** Active skills currently equipped (up to MAX_ACTIVE_SKILLS). */
  equippedSkillIds: string[];
  /** Owned skill jewels (socketed and un-socketed both live here). */
  jewels: JewelInstanceSave[];
  /** Which jewel instance sits in each jewel-socket node: nodeId → jewel instance id. */
  socketedJewels: Record<string, string>;
}

export interface InventorySave {
  items: ItemInstanceSave[];
  equipped: Partial<Record<ItemSlot, string>>;
}

/** Daily quest tracking — resets at midnight each day. */
export interface QuestsSave {
  /** YYYY-MM-DD of the current quest day; "" means not yet initialised. */
  date: string;
  /** questId → progress count (capped at the quest's target). */
  progress: Record<string, number>;
  /** questIds whose reward has been collected. */
  claimed: string[];
  /** true once the 50-diamond all-quests-complete bonus has been claimed. */
  allClaimed: boolean;
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

/** One slot of the rotating shop stock — a rolled item or a summoning scroll. */
export interface ShopStockEntry {
  slotId: string;
  kind: "item" | "scroll";
  cost: number;
  /** Present when kind === "item": the exact rolled instance you'll receive. */
  item?: ItemInstanceSave;
}
export interface ShopSave {
  stock: ShopStockEntry[];
  /** Manual rerolls used today; the first few each day are free, then they cost more. */
  refreshesToday: number;
  /** YYYY-MM-DD the refresh count applies to; rolls over (resets) daily. */
  refreshDate: string;
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
  /** Rotating shop stock (persisted so purchases stay sold). */
  shop: ShopSave;
  /** Daily quest state — progress, claims, and all-done bonus. */
  quests: QuestsSave;
  /** Addictive-features meta block (streak, mastery, banner, endless, …) — v10. */
  meta: MetaSave;
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
      nodeChoices: {},
      obtainedSkills: [],
      equippedSkillIds: [],
      jewels: [],
      socketedJewels: {},
    },
    inventory: {
      items: [],
      equipped: {},
    },
    collection: {},
    currency: {
      gold: 0,
      diamonds: 0,
      pityCount: 0,
      lastDailyLoginDate: "",
      pityInsuranceActive: false,
      freeSummonReadyAt: 0,
    },
    progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
    squad: [],
    materials: {},
    settings: defaultSettings(),
    shop: { stock: [], refreshesToday: 0, refreshDate: "" },
    quests: { date: "", progress: {}, claimed: [], allClaimed: false },
    meta: defaultMeta(),
    lastSavedAt: 0,
  };
}

export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  if ((save.version ?? 0) < 2) save = { ...save, collection: {}, version: 2 };
  if ((save.version ?? 0) < 3)
    save = {
      ...save,
      currency: {
        gold: 0,
        diamonds: 0,
        pityCount: 0,
        lastDailyLoginDate: "",
        pityInsuranceActive: false,
        freeSummonReadyAt: 0,
      },
      progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
      version: 3,
    };
  if ((save.version ?? 0) < 4) save = { ...save, squad: [], version: 4 };
  if ((save.version ?? 0) < 5) {
    // Add materials + default every existing item to +0.
    const items = (save.inventory?.items ?? []).map((it) => ({
      ...it,
      enhanceLevel: it.enhanceLevel ?? 0,
    }));
    save = {
      ...save,
      materials: save.materials ?? {},
      inventory: { ...save.inventory, items },
      version: 5,
    };
  }
  if ((save.version ?? 0) < 6) {
    // Skill jewels: add the owned-jewel inventory + socket map.
    save = {
      ...save,
      hero: {
        ...save.hero,
        jewels: save.hero?.jewels ?? [],
        socketedJewels: save.hero?.socketedJewels ?? {},
      },
      version: 6,
    };
  }
  if ((save.version ?? 0) < 7) {
    // Currency redesign: crystals → gold (everyday), add diamonds (premium).
    const legacyCrystals = (save.currency as unknown as { crystals?: number }).crystals ?? 0;
    save = {
      ...save,
      currency: {
        gold: legacyCrystals,
        diamonds: 0,
        pityCount: save.currency?.pityCount ?? 0,
        lastDailyLoginDate: save.currency?.lastDailyLoginDate ?? "",
        pityInsuranceActive: save.currency?.pityInsuranceActive ?? false,
        freeSummonReadyAt: save.currency?.freeSummonReadyAt ?? 0,
      },
      version: 7,
    };
  }
  if ((save.version ?? 0) < 8) {
    // Daily quest system: stub in empty quest state.
    save = {
      ...save,
      quests: { date: "", progress: {}, claimed: [], allClaimed: false },
      version: 8,
    };
  }
  if ((save.version ?? 0) < 9) {
    // Free-summon timer: existing players start with one free summon ready.
    save = { ...save, currency: { ...save.currency, freeSummonReadyAt: 0 }, version: 9 };
  }
  if ((save.version ?? 0) < 10) {
    // Addictive-features suite: stub in the meta block (all features start empty).
    save = { ...save, meta: defaultMeta(), version: 10 };
  }
  if ((save.version ?? 0) < 11) {
    // Expedition redesign: the single idle run becomes a quest board. Any
    // in-flight idle accrual is forfeited (cosmetic) — reset to an empty board.
    save = {
      ...save,
      meta: {
        ...save.meta,
        expedition: {
          quests: [],
          lastRerollDay: "",
          nextQuestSeq: 0,
          freeRerollsLeft: 5,
          rerollDay: "",
          dispatchesLeft: 5,
          dispatchDay: "",
        },
      },
      version: 11,
    };
  }
  if ((save.version ?? 0) < 12) {
    // Mastery choice-pick: choose-nodes now persist which option is active.
    save = { ...save, version: 12 };
    if (save.hero) save.hero.nodeChoices ??= {};
  }
  if ((save.version ?? 0) < 13) {
    // Expedition free rerolls: existing boards start the day with a full 5.
    save = { ...save, version: 13 };
    if (save.meta?.expedition) {
      save.meta.expedition.freeRerollsLeft ??= 5;
      save.meta.expedition.rerollDay ??= "";
    }
  }
  if ((save.version ?? 0) < 14) {
    // Expedition daily dispatch cap: existing boards start the day with a full 5.
    save = { ...save, version: 14 };
    if (save.meta?.expedition) {
      save.meta.expedition.dispatchesLeft ??= 5;
      save.meta.expedition.dispatchDay ??= "";
    }
  }
  if ((save.version ?? 0) < 15) {
    // New "Pants" (leg-armour) equip slot. `equipped` is a Partial<Record> so no
    // backfill is needed — the slot simply starts empty until the player equips one.
    save = { ...save, version: 15 };
  }
  // Defensive backfill: a save persisted AT the current version but missing a
  // field (e.g. a dev save stamped v5 before `materials` was added) skips the
  // versioned hops above and would crash on first access. Ensure every required
  // top-level field exists regardless of version.
  save.collection ??= {};
  for (const id in save.collection) {
    const e = save.collection[id];
    if (e) e.copies ??= 0;
  }
  save.squad ??= [];
  save.materials ??= {};
  save.currency ??= {
    gold: 0,
    diamonds: 0,
    pityCount: 0,
    lastDailyLoginDate: "",
    pityInsuranceActive: false,
    freeSummonReadyAt: 0,
  };
  (save.currency as unknown as Record<string, unknown>).gold ??= 0;
  (save.currency as unknown as Record<string, unknown>).diamonds ??= 0;
  (save.currency as unknown as Record<string, unknown>).freeSummonReadyAt ??= 0;
  save.progress ??= { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 };
  save.settings = { ...defaultSettings(), ...(save.settings ?? {}) };
  save.shop ??= { stock: [], refreshesToday: 0, refreshDate: "" };
  save.shop.refreshesToday ??= 0;
  save.shop.refreshDate ??= "";
  save.quests ??= { date: "", progress: {}, claimed: [], allClaimed: false };
  save.quests.progress ??= {};
  save.quests.claimed ??= [];
  save.quests.allClaimed ??= false;
  // Meta block (v10): backfill every sub-object so a partial save never crashes.
  save.meta = backfillMeta(save.meta);
  // Hero active skills: migrate the old single equip slot to the multi-slot list
  // and grant the weapon-free starter skills so every hero has usable actives.
  if (save.hero) {
    save.hero.obtainedSkills ??= [];
    save.hero.jewels ??= [];
    save.hero.socketedJewels ??= {};
    save.hero.nodeChoices ??= {};
    const legacy = (save.hero as { equippedSkillId?: string | null }).equippedSkillId;
    save.hero.equippedSkillIds ??= legacy ? [legacy] : [];
    for (const id of STARTER_SKILL_IDS) {
      if (!save.hero.obtainedSkills.some((s) => s.skillId === id)) {
        save.hero.obtainedSkills.push({ skillId: id, level: 1, useXp: 0 });
      }
    }
    // Only one active skill may be equipped; seed the first starter, and clamp
    // any save that migrated in from the old multi-slot era down to a single slot.
    if (save.hero.equippedSkillIds.length === 0)
      save.hero.equippedSkillIds = [STARTER_SKILL_IDS[0]];
    if (save.hero.equippedSkillIds.length > MAX_ACTIVE_SKILLS) {
      save.hero.equippedSkillIds = save.hero.equippedSkillIds.slice(-MAX_ACTIVE_SKILLS);
    }
  }
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
