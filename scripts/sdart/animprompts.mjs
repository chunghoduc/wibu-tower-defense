// Animation-sheet prompts: every character's frames in ONE image (guaranteed
// consistent outfit/style), framed explicitly as a 2D game asset. Reuses the
// homage visual descriptors. The slicer cuts frames by position afterwards.
import {
  TOWER_VISUAL,
  ENEMY_VISUAL,
  BOSS_VISUAL,
  ITEM_VISUAL,
  HERO_BASE,
  HERO_WEAPON,
  itemStyle,
} from "./prompts.mjs";

export { TOWER_VISUAL, ENEMY_VISUAL, BOSS_VISUAL, ITEM_VISUAL, HERO_BASE, HERO_WEAPON, itemStyle };

const SHEET_NEG =
  "turnaround, rotation, character rotating, arms crossed repeated, T-pose, many tiny figures, crowd, dense packed grid, second character, different outfit, outfit color change, inconsistent design, two characters touching, overlapping bodies, frame borders, panel lines, grid lines, text, labels, numbers, ui, background scenery, environment, ground, floor, shadow, props, blurry, lowres, extra limbs, deformed";

export const SHEET_NEGATIVE = SHEET_NEG;

// A horizontal animation strip of distinct ACTION poses of one consistent character.
export function charSheetPrompt(visual, { creature = false } = {}) {
  const subject = creature ? "creature/monster" : "character";
  return `2D video game ${subject} animation sprite sheet asset for a tower-defense game, a horizontal row of full-body action frames of the SAME ${subject} with the EXACT SAME outfit and identical art style in every single frame, ${visual}, side three-quarter view, distinct dynamic poses: standing idle, walking step, attacking strike, and recoil, each pose clearly separated by empty space, evenly spaced, game sprite asset, clean cel-shaded anime, flat pure white background, even lighting`;
}
