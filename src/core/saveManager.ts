import { checkAndGrantAchievements } from "./achievements.ts";
import { processStageClear, type DropResult } from "./drops.ts";
import { performMultiSummon, performSummon, type SummonResult } from "./gacha.ts";
import { awardHeroXp } from "./hero.ts";
import { equipItem, equipSkill, unequipSkill, unequipSlot } from "./loadout.ts";
import { ensureShopStock, refreshShop, shopRefreshCost, buyShopSlot, sellItem, type PurchaseResult } from "./shop.ts";
import { SUMMON_SCROLL, OBLIVION_ORB } from "../data/materials.ts";
import type { ShopStockEntry } from "./save.ts";
import { attemptEnhance, type EnhanceResult } from "./enhance.ts";
import { openBox, type BoxReward } from "./boxes.ts";
import type { ItemSlot } from "../data/schema.ts";
import { Rng } from "./rng.ts";
import type { Difficulty } from "../data/schema.ts";
import { createFreshSave, type GameSettings, type HeroSave, type SaveProvider } from "./save.ts";
import { rolloverQuests } from "./questTracker.ts";
import { SINGLE_PULL_COST } from "./gacha.ts";
import { STARTER_SKILL_IDS } from "../data/skills.ts";
import { addTowerToCollection, upgradeTowerStar, type StarUpResult } from "./collection.ts";
import { canForgetNode, PASSIVE_NODES_MAP } from "../data/passiveGrid.ts";
import { JEWEL_CATALOG_MAP } from "../data/jewels.ts";
import type { JewelInstanceSave } from "./save.ts";

const DAILY_LOGIN_GOLD = 50;
const DAILY_LOGIN_DIAMONDS = 5;
const STARTER_DIAMONDS = SINGLE_PULL_COST * 10; // 10 summons of diamonds to start
const STARTER_GOLD = 2000; // enough to enhance a few items

/** A common-rarity character per role, granted to new players so they can play immediately. */
const STARTER_SQUAD = [
  "yamo-desert-bandit",   // damage
  "pip-powderkeg",        // splash
  "tobi-skipstone",       // chain
  "bram-thornling",       // dot
  "doro-mire-spirit",     // debuff
  "mochi-morale-sprite",  // support
];

const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  Normal: 50,
  Hard: 80,
  Nightmare: 120,
};

export class SaveManager {
  private save: HeroSave;

  constructor(private readonly provider: SaveProvider) {
    const loaded = provider.load();
    this.save = loaded ?? SaveManager.freshWithStarters();
    this.persist();
  }

  /** A brand-new save seeded with starter crystals + a starter squad so a player
   * can place towers and play immediately (placement is ownership-gated). */
  private static freshWithStarters(): HeroSave {
    const save = createFreshSave();
    save.currency.gold = STARTER_GOLD;
    save.currency.diamonds = STARTER_DIAMONDS;
    for (const id of STARTER_SQUAD) addTowerToCollection(save, id);
    // Every hero starts with two weapon-free active skills (one Physical, one Magic).
    for (const id of STARTER_SKILL_IDS) save.hero.obtainedSkills.push({ skillId: id, level: 1, useXp: 0 });
    save.hero.equippedSkillIds = [...STARTER_SKILL_IDS];
    return save;
  }

  getSave(): HeroSave {
    return this.save;
  }

  /** Read player settings (audio/etc.). */
  getSettings(): GameSettings {
    return this.save.settings;
  }

  /** Merge a settings change and persist. */
  setSettings(partial: Partial<GameSettings>): GameSettings {
    this.save.settings = { ...this.save.settings, ...partial };
    this.persist();
    return this.save.settings;
  }

  /** Wipe ALL progress back to a brand-new game (keeps the chosen audio settings). */
  resetProgress(): void {
    const keepSettings = this.save.settings;
    this.save = SaveManager.freshWithStarters();
    this.save.settings = keepSettings;
    this.persist();
  }

  /** Persist immediately — used for mid-battle rewards (kill XP/loot) that the
   * BattleState has already written into the save object. */
  flush(): void {
    this.persist();
  }

  afterBattle(
    stageId: string,
    outcome: "won" | "lost",
    difficulty: Difficulty,
    rng: Rng,
  ): DropResult | null {
    if (outcome !== "won") return null;
    const result = processStageClear(this.save, stageId, difficulty, rng);
    awardHeroXp(this.save, XP_BY_DIFFICULTY[difficulty]);
    checkAndGrantAchievements(this.save);
    this.persist();
    return result;
  }

  afterSummon(count: 1 | 10, rng: Rng): SummonResult[] {
    const results =
      count === 1
        ? [performSummon(this.save, rng)]
        : performMultiSummon(this.save, rng, 10);
    checkAndGrantAchievements(this.save);
    this.persist();
    return results;
  }

  /** Unlock a passive node. Returns false if not enough skill points or node unreachable. */
  unlockPassiveNode(nodeId: string): boolean {
    const save = this.save;
    if (save.hero.skillPoints <= 0) return false;
    if (save.hero.unlockedNodes.includes(nodeId)) return false;
    save.hero.unlockedNodes.push(nodeId);
    save.hero.skillPoints -= 1;
    this.persist();
    return true;
  }

  /**
   * Forget one unlocked passive node, refunding its skill point. Returns false
   * if the node isn't unlocked or if removing it would orphan the rest of the
   * tree (only safely-removable nodes can be refunded — see canForgetNode).
   */
  forgetPassiveNode(nodeId: string): boolean {
    const hero = this.save.hero;
    if (!canForgetNode(hero.unlockedNodes, nodeId)) return false;
    hero.unlockedNodes = hero.unlockedNodes.filter((id) => id !== nodeId);
    hero.skillPoints += 1;
    this.persist();
    return true;
  }

  /**
   * Forget the entire passive tree at once, refunding every spent point. Returns
   * the number of points refunded (0 if nothing was allocated). A full reset is
   * always safe — clearing all nodes leaves nothing to orphan.
   */
  resetPassiveTree(): number {
    const hero = this.save.hero;
    const refunded = hero.unlockedNodes.length;
    if (refunded === 0) return 0;
    hero.skillPoints += refunded;
    hero.unlockedNodes = [];
    this.persist();
    return refunded;
  }

  /**
   * Spend one Oblivion Orb (a rare loot drop) to refund the entire passive tree.
   * Returns the points refunded, -1 if the player owns no orb (nothing changes),
   * or 0 if nothing was allocated (the orb is kept, not wasted).
   */
  respecWithOrb(): number {
    if ((this.save.materials[OBLIVION_ORB] ?? 0) <= 0) return -1;
    const refunded = this.resetPassiveTree();
    if (refunded > 0) {
      this.save.materials[OBLIVION_ORB] -= 1;
      this.persist();
    }
    return refunded;
  }

  // ── Skill jewels ─────────────────────────────────────────────────────────

  /** Grant a new owned jewel instance (used by loot). Persists. */
  grantJewel(defId: string): JewelInstanceSave {
    const instance: JewelInstanceSave = { id: `jewel-${defId}-${++SaveManager.jewelSeq}-${this.save.lastSavedAt}`, defId };
    this.save.hero.jewels.push(instance);
    this.persist();
    return instance;
  }
  private static jewelSeq = 0;

  /**
   * Socket an owned jewel into an allocated jewel-socket node. Returns false if
   * the node isn't an unlocked jewel-socket, the jewel isn't owned, the jewel is
   * already socketed elsewhere, or the target socket already holds a jewel.
   */
  socketJewel(nodeId: string, jewelInstanceId: string): boolean {
    const hero = this.save.hero;
    const node = PASSIVE_NODES_MAP.get(nodeId);
    if (!node || node.type !== "jewel-socket") return false;
    if (!hero.unlockedNodes.includes(nodeId)) return false;
    if (hero.socketedJewels[nodeId]) return false; // already filled
    const owned = hero.jewels.some((j) => j.id === jewelInstanceId);
    if (!owned) return false;
    if (Object.values(hero.socketedJewels).includes(jewelInstanceId)) return false; // in another socket
    if (!JEWEL_CATALOG_MAP.has(hero.jewels.find((j) => j.id === jewelInstanceId)!.defId)) return false;
    hero.socketedJewels[nodeId] = jewelInstanceId;
    this.persist();
    return true;
  }

  /** Remove the jewel from a socket; it returns to the owned pool. Persists. */
  unsocketJewel(nodeId: string): boolean {
    const hero = this.save.hero;
    if (!hero.socketedJewels[nodeId]) return false;
    delete hero.socketedJewels[nodeId];
    this.persist();
    return true;
  }

  /**
   * Destroy a jewel FOREVER — remove it from the owned pool and from any socket
   * it occupies. There is no refund; the UI guards this behind a confirm. Persists.
   */
  discardJewel(jewelInstanceId: string): boolean {
    const hero = this.save.hero;
    const idx = hero.jewels.findIndex((j) => j.id === jewelInstanceId);
    if (idx === -1) return false;
    hero.jewels.splice(idx, 1);
    for (const [nodeId, id] of Object.entries(hero.socketedJewels)) {
      if (id === jewelInstanceId) delete hero.socketedJewels[nodeId];
    }
    this.persist();
    return true;
  }

  /** Set the chosen battle squad (owned tower ids, capped at 7). Persists. */
  setSquad(ids: string[]): void {
    const owned = ids.filter((id) => id in this.save.collection).slice(0, 7);
    this.save.squad = owned;
    this.persist();
  }

  /** Equip an owned item instance (optionally into a specific slot). Persists on success. */
  equipItem(instanceId: string, targetSlot?: ItemSlot): boolean {
    const ok = equipItem(this.save, instanceId, targetSlot);
    if (ok) this.persist();
    return ok;
  }

  /** Clear an equipment slot and persist. */
  unequipSlot(slot: ItemSlot): void {
    unequipSlot(this.save, slot);
    this.persist();
  }

  /** Equip an owned active skill. Returns false if not owned. Persists on success. */
  equipSkill(skillId: string): boolean {
    const ok = equipSkill(this.save, skillId);
    if (ok) this.persist();
    return ok;
  }

  /** Unequip one active skill (or all if no id), then persist. */
  unequipSkill(skillId?: string): void {
    unequipSkill(this.save, skillId);
    this.persist();
  }

  /** Attempt to enhance an inventory item one level (T13). Persists on a real attempt. */
  enhanceItem(instanceId: string, rng: Rng = new Rng((Math.random() * 1e9) | 0)): EnhanceResult {
    const result = attemptEnhance(this.save, instanceId, rng);
    if (result.ok) this.persist();
    return result;
  }

  /** Open a boss loot box, granting its rewards. Persists when actually opened (T15). */
  openBox(boxId: string, rng: Rng = new Rng((Math.random() * 1e9) | 0)): BoxReward {
    const reward = openBox(this.save, boxId, rng);
    if (reward.opened) this.persist();
    return reward;
  }

  /** Material count by id (jewels, boxes). */
  getMaterial(id: string): number {
    return this.save.materials[id] ?? 0;
  }

  /** Grant materials and persist. */
  addMaterial(id: string, n: number): void {
    this.save.materials[id] = Math.max(0, (this.save.materials[id] ?? 0) + n);
    this.persist();
  }

  /** Current shop stock (rolled + persisted on first access). */
  getShopStock(): ShopStockEntry[] {
    ensureShopStock(this.save, new Rng((Math.random() * 1e9) | 0));
    return this.save.shop.stock;
  }

  /** Crystals the next shop reroll will cost (0 while today's free refreshes remain). */
  shopRefreshCost(): number {
    return shopRefreshCost(this.save);
  }

  /** Reroll the shop for crystals. */
  refreshShop(): PurchaseResult {
    const r = refreshShop(this.save, new Rng((Math.random() * 1e9) | 0));
    if (r.success) this.persist();
    return r;
  }

  /** Ascend a collected tower one star (spends banked copies + crystals). */
  upgradeTowerStar(towerId: string): StarUpResult {
    const r = upgradeTowerStar(this.save, towerId);
    if (r.success) this.persist();
    return r;
  }

  /** Buy a shop stock slot (item → inventory, scroll → materials). */
  buyShopSlot(slotId: string): PurchaseResult {
    const r = buyShopSlot(this.save, slotId);
    if (r.success) this.persist();
    return r;
  }

  /** Sell an inventory item for 75% of its value. */
  sellItem(instanceId: string): PurchaseResult & { refund: number } {
    const r = sellItem(this.save, instanceId);
    if (r.success) this.persist();
    return r;
  }

  /** Spend one Summoning Scroll on a free single summon. Null if none held. */
  useSummonScroll(rng: Rng = new Rng((Math.random() * 1e9) | 0)): SummonResult | null {
    if ((this.save.materials[SUMMON_SCROLL] ?? 0) <= 0) return null;
    this.save.materials[SUMMON_SCROLL] -= 1;
    this.save.currency.diamonds += SINGLE_PULL_COST; // pre-credit so the pull nets free
    const result = performSummon(this.save, rng);
    checkAndGrantAchievements(this.save);
    this.persist();
    return result;
  }

  grantDailyLogin(todayIso: string): number {
    rolloverQuests(this.save, todayIso);
    if (this.save.currency.lastDailyLoginDate === todayIso) return 0;
    this.save.currency.lastDailyLoginDate = todayIso;
    this.save.currency.gold += DAILY_LOGIN_GOLD;
    this.save.currency.diamonds += DAILY_LOGIN_DIAMONDS;
    this.persist();
    return DAILY_LOGIN_GOLD;
  }

  private persist(): void {
    this.save.lastSavedAt = Date.now();
    this.provider.persist(this.save);
  }
}
