import { JEWEL_CATALOG_MAP, type JewelDef } from "../data/jewels.ts";
import type { HeroSave } from "./save.ts";

/**
 * The stat bags ({flat, increased, more}) of every jewel sitting in a jewel-socket
 * node the hero has ALLOCATED. A jewel in an un-allocated socket contributes
 * nothing — same rule as Path of Exile (the socket must be on your tree).
 *
 * The returned bags are shaped to drop straight into heroStatPipeline's
 * passiveNodes array, and their `more` bags into collectPassiveMore — so jewels
 * reuse the exact passive-node resolution path and reach towers via the 60% share.
 */
export function socketedJewelBags(save: HeroSave): Pick<JewelDef, "flat" | "increased" | "more">[] {
  const allocated = new Set(save.hero.unlockedNodes);
  const bags: Pick<JewelDef, "flat" | "increased" | "more">[] = [];
  for (const [nodeId, instanceId] of Object.entries(save.hero.socketedJewels ?? {})) {
    if (!allocated.has(nodeId)) continue;
    const instance = (save.hero.jewels ?? []).find((j) => j.id === instanceId);
    if (!instance) continue;
    const def = JEWEL_CATALOG_MAP.get(instance.defId);
    if (!def) continue;
    bags.push({ flat: def.flat, increased: def.increased, more: def.more });
  }
  return bags;
}
