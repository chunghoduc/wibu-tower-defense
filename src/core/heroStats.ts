/**
 * Resolve the hero's full battle stats from persistent sources — the single,
 * testable home for "items + passive tree + jewels + level all add up to the
 * hero's stats". BattleState calls this once at construction; the result also
 * feeds the 60% hero→tower share (see addHeroShare in stats.ts).
 *
 * Stacking follows heroStatPipeline's formula:
 *   final = (base + Σflat) × (1 + Σincreased%) × Π(1 + more%)
 * with item base stats + fractional affixes added flat, scalar affixes and
 * passive/jewel scalar mods added as increased%, and `more` (Unique jewels +
 * keystones) applied multiplicatively.
 */
import type { PassiveNodeDef, Stats, WeaponType } from "../data/schema.ts";
import { PASSIVE_NODES_MAP } from "../data/passiveGrid.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { heroRangeForWeapon } from "../data/weaponRange.ts";
import type { HeroSave } from "./save.ts";
import { collectPassiveMore, heroStatPipeline } from "./stats.ts";
import { buildAffixStats } from "./affixStats.ts";
import { buildUniquePowerStats } from "./uniquePowerStats.ts";
import { socketedJewelBags } from "./jewelStats.ts";
import { scaleStatsByEnhance } from "./enhance.ts";
import { effectiveNode } from "./passiveChoice.ts";

export interface ResolvedHeroStats {
  stats: Stats;
  /** Gold/sec from an equipped pet's utility (0 when none), surfaced for the battle. */
  petGoldPerSec: number;
  /** Equipped weapon family (null = unarmed) — drives attack style & reach. */
  weaponType: WeaponType | null;
}

export function resolveHeroBattleStats(save: HeroSave, base: Stats): ResolvedHeroStats {
  const unlockedNodes = save.hero.unlockedNodes
    .map((id) => PASSIVE_NODES_MAP.get(id))
    .filter((n): n is PassiveNodeDef => n !== undefined)
    .map((n) => effectiveNode(n, save.hero.nodeChoices ?? {}));

  // Item base stats (each scaled by its enhance level) add flat.
  const itemStats: Partial<Stats>[] = [];
  let petGoldPerSec = 0;
  let weaponType: WeaponType | null = null;
  for (const [slot, instanceId] of Object.entries(save.inventory.equipped)) {
    if (!instanceId) continue;
    const instance = save.inventory.items.find((it) => it.id === instanceId);
    if (!instance) continue;
    const def = ITEM_CATALOG_MAP.get(instance.defId);
    if (!def) continue;
    itemStats.push(
      scaleStatsByEnhance(instance.rolledStats as Partial<Stats>, instance.enhanceLevel ?? 0),
    );
    if (slot === "Pet" && def.petUtility?.goldPerSec) petGoldPerSec = def.petUtility.goldPerSec;
    if (slot === "Weapon") weaponType = def.weaponType ?? null;
  }

  // The equipped weapon family sets the hero's BASE reach (unarmed = boxing range);
  // `% range` affixes then scale on top of it through the pipeline below.
  base = { ...base, range: heroRangeForWeapon(weaponType) };

  // Jewels in allocated sockets empower the hero exactly like passive nodes.
  const jewelBags = socketedJewelBags(save);

  // Unique Powers — the signature effect every equipped Unique-rarity item
  // carries (data/uniquePowers.ts). They fold into the SAME three buckets as
  // affixes; the `more` bucket is what a Legendary structurally can't grant.
  const unique = buildUniquePowerStats(save);

  // more% from every allocated node/jewel that declares one (keystones, prestige
  // gates, Unique jewels) plus equipped Unique Powers — not gated on type, or a
  // notable's more% would be lost.
  const keystoneMore = [...collectPassiveMore([...unlockedNodes, ...jewelBags]), ...unique.more];

  // Item affixes + Unique Powers: fractional flat go straight in; scalar
  // increased% ride in as synthetic increased-only nodes alongside the passive
  // nodes.
  const affix = buildAffixStats(save);
  const increasedNodes = [...affix.increased, ...unique.increased].map((increased) => ({
    flat: {},
    increased,
    more: undefined,
  }));

  const stats = heroStatPipeline(
    base,
    save.hero.level,
    [...unlockedNodes, ...increasedNodes, ...jewelBags],
    itemStats,
    [...affix.flat, ...unique.flat],
    keystoneMore,
  );
  return { stats, petGoldPerSec, weaponType };
}
