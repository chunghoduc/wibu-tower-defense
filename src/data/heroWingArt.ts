// src/data/heroWingArt.ts
//
// Which equipped wing items have dedicated battle-hero WING art, and the texture
// keys for their two flap frames. The battle hero (HeroWeaponSprite) prefers this
// purpose-drawn back-view wing pair over the flat front-facing inventory icon it
// used to stretch behind the hero. Two frames per wing share one SDXL seed so the
// pair is the same wings in two beats of a flap:
//   herowing__<id>      — swept-down / glide (rest)
//   herowing__<id>__up  — raised / top of the up-stroke
// Pure / Phaser-free. An id NOT listed here falls back to the legacy single-icon
// wing (resolveHeroLayers.wingKey), so adding art is purely additive.

import { heroWingTex, heroWingUpTex } from "./assetKeys.ts";

/** Wing item ids that ship purpose-drawn battle wing art (down + up frames). */
export const BATTLE_WING_IDS = [
  "fledgling-wings",
  "tempest-wings",
  "worn-skywings",
  "fine-skywings",
  "masterwork-skywings",
  "heroic-skywings",
  "mythic-skywings",
  "valkyrie-pinions",
  "phoenix-pinions",
] as const;

const _BATTLE_WING_SET = new Set<string>(BATTLE_WING_IDS);

/** The two flap-frame texture keys for a wing with battle art. */
export interface BattleWingKeys {
  /** Swept-down / glide frame (rest). */
  downKey: string;
  /** Raised / up-stroke frame. */
  upKey: string;
}

/**
 * Battle wing frame keys for an equipped wing item id, or null when the wing has
 * no dedicated battle art (caller should fall back to the legacy icon wing).
 */
export function battleWingKeys(wingId: string | null | undefined): BattleWingKeys | null {
  if (!wingId || !_BATTLE_WING_SET.has(wingId)) return null;
  return { downKey: heroWingTex(wingId), upKey: heroWingUpTex(wingId) };
}
