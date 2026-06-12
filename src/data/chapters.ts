/**
 * Chapter & stage biome themes (T2 + map/background cohesion).
 *
 * A "theme" bundles everything that makes a battlefield read as one place: the
 * painted backdrop, the dark veil over it, the tint on terrain sprites, and —
 * crucially — the *palette of terrain features* scattered on the map. Driving
 * the terrain palette from the same theme as the backdrop is what makes the map
 * look like part of the painting instead of generic green blobs on a lava field.
 *
 * Two layers:
 *  - CHAPTER_THEMES — one biome per chapter, used as the default for its stages
 *    and the fallback backdrop when a stage has no hand-painted art.
 *  - STAGE_BIOMES — per-stage overrides for the 10 hand-painted backdrops, whose
 *    biomes (rocky canyon, grey quarry, lava crossroads, misty grove, …) vary
 *    within the chapter. Each override matches its specific stage-N.png.
 */
import { bgKey } from "./bgManifest.ts";
import type { TerrainType } from "./schema.ts";

export interface ChapterTheme {
  id: string;
  name: string;
  /** Background image texture key for the battlefield. */
  bgKey: string;
  /** Tint applied to terrain sprites so reused art matches the biome. Biomes with
   *  dedicated art (lava/ice/snow/crystal) use 0xffffff so the art keeps its own
   *  colour. */
  terrainTint: number;
  /** Subtle dark veil over the backdrop for unit contrast. */
  groundOverlay: number;
  /** Obstacle terrain pool (blocks tower placement). Duplicates bias the weighting. */
  block: TerrainType[];
  /** Decorative terrain pool (walkable). */
  decor: TerrainType[];
}

export const CHAPTER_THEMES: ChapterTheme[] = [
  {
    id: "greenwood",
    name: "Greywood Pass",
    bgKey: bgKey("chapter-greenwood"),
    terrainTint: 0xffffff,
    groundOverlay: 0x16201a,
    block: ["jungle", "stone", "water", "jungle"],
    decor: ["grass", "grass"],
  },
  {
    id: "frost",
    name: "Frostpeak Reach",
    bgKey: bgKey("chapter-frost"),
    terrainTint: 0xffffff,
    groundOverlay: 0x18222e,
    block: ["ice", "snow", "mountain", "ice"],
    decor: ["snow", "stone"],
  },
  {
    id: "desert",
    name: "Sunscar Wastes",
    bgKey: bgKey("chapter-desert"),
    terrainTint: 0xffe0b0,
    groundOverlay: 0x241d12,
    block: ["stone", "mountain", "sand"],
    decor: ["sand", "sand"],
  },
  {
    id: "volcanic",
    name: "Emberfall",
    bgKey: bgKey("chapter-volcanic"),
    terrainTint: 0xffffff,
    groundOverlay: 0x2a1410,
    block: ["lava", "stone", "mountain", "lava"],
    decor: ["sand"],
  },
  {
    id: "swamp",
    name: "Mire Hollow",
    bgKey: bgKey("chapter-swamp"),
    terrainTint: 0xcfe0a0,
    groundOverlay: 0x18220f,
    block: ["water", "jungle", "water"],
    decor: ["grass", "sand"],
  },
  {
    id: "corrupted",
    name: "The Blight",
    bgKey: bgKey("chapter-corrupted"),
    terrainTint: 0xffffff,
    groundOverlay: 0x1d1430,
    block: ["crystal", "stone", "crystal", "mountain"],
    decor: ["crystal", "stone"],
  },
];

/** Per-stage biome overrides matching each hand-painted stage-N.png backdrop. */
interface StageBiome {
  terrainTint: number;
  groundOverlay: number;
  block: TerrainType[];
  decor: TerrainType[];
}
const STAGE_BIOMES: Record<number, StageBiome> = {
  // 2 — Switchback Gully: brown rocky canyon
  2: {
    terrainTint: 0xe6cfa0,
    groundOverlay: 0x241d12,
    block: ["stone", "mountain", "stone"],
    decor: ["sand", "grass"],
  },
  // 3 — Twin Fords: forest cut by a river
  3: {
    terrainTint: 0xeaf2ea,
    groundOverlay: 0x14202a,
    block: ["water", "water", "jungle", "stone"],
    decor: ["grass", "sand"],
  },
  // 6 — Quarry Descent: bare grey stone pit
  6: {
    terrainTint: 0xd7dbe2,
    groundOverlay: 0x1b1e24,
    block: ["stone", "mountain", "stone"],
    decor: ["stone", "sand"],
  },
  // 7 — Cinder Crossroads: molten lava field
  7: {
    terrainTint: 0xffffff,
    groundOverlay: 0x2a1410,
    block: ["lava", "stone", "mountain", "lava"],
    decor: ["sand"],
  },
  // 8 — Mistgrove Loop: dense misty grove
  8: {
    terrainTint: 0xc4d49a,
    groundOverlay: 0x16220f,
    block: ["jungle", "water", "jungle"],
    decor: ["grass", "grass"],
  },
  // 9 — Broken Aqueduct: green ruins with stonework
  9: {
    terrainTint: 0xdfe6da,
    groundOverlay: 0x141d1c,
    block: ["stone", "jungle", "water"],
    decor: ["grass", "stone"],
  },
  // 10 — Wardens' Gate: dark teal fortress wood
  10: {
    terrainTint: 0xbfd8c8,
    groundOverlay: 0x10201a,
    block: ["jungle", "stone", "jungle"],
    decor: ["grass"],
  },
  // 13 — Mirage Bazaar: glass dunes glinting in the heat
  13: {
    terrainTint: 0xffe0b0,
    groundOverlay: 0x241d12,
    block: ["crystal", "stone", "sand"],
    decor: ["sand", "crystal"],
  },
  // 15 — Gate of the Glass Throne: shattered crystal ramparts
  15: {
    terrainTint: 0xffffff,
    groundOverlay: 0x201828,
    block: ["crystal", "stone", "crystal", "mountain"],
    decor: ["sand", "stone"],
  },
  // 19 — Magma Reliquary: lava channels among black crystal
  19: {
    terrainTint: 0xffffff,
    groundOverlay: 0x2a1410,
    block: ["lava", "crystal", "stone"],
    decor: ["crystal", "sand"],
  },
  // 20 — Throne of Emberfall: the demon-king's furnace
  20: {
    terrainTint: 0xffffff,
    groundOverlay: 0x2a1008,
    block: ["lava", "mountain", "lava", "stone"],
    decor: ["sand", "lava"],
  },
  // 23 — Sporebloom Hollow: luminous fungus glowing over the black water
  23: {
    terrainTint: 0xb6f0c2,
    groundOverlay: 0x10220f,
    block: ["crystal", "jungle", "water"],
    decor: ["grass", "crystal"],
  },
  // 25 — Heart of the Rot: the corruption's beating core
  25: {
    terrainTint: 0xc0e0a0,
    groundOverlay: 0x141f14,
    block: ["water", "jungle", "crystal", "water"],
    decor: ["crystal", "grass"],
  },
  // 28 — Spire of Unmaking: jagged black-crystal ramparts climbing into the void
  28: {
    terrainTint: 0xd8c8f0,
    groundOverlay: 0x1d1430,
    block: ["crystal", "mountain", "crystal", "stone"],
    decor: ["crystal", "stone"],
  },
  // 30 — The Wound at the World's End: the source, where reality comes apart
  30: {
    terrainTint: 0xe6d6ff,
    groundOverlay: 0x241038,
    block: ["crystal", "crystal", "stone", "mountain"],
    decor: ["crystal", "crystal"],
  },
};

const STAGES_PER_CHAPTER = 5;

/** Stage number (1-based) from an id like "ch1-s7". */
function stageNum(stageId: string): number {
  const m = stageId.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Zero-based chapter index a stage belongs to (from its trailing number). */
export function chapterIndexForStage(stageId: string): number {
  return Math.floor((stageNum(stageId) - 1) / STAGES_PER_CHAPTER);
}

/** The chapter theme for a stage (wraps if more chapters than themes exist). */
export function chapterThemeForStage(stageId: string): ChapterTheme {
  return CHAPTER_THEMES[chapterIndexForStage(stageId) % CHAPTER_THEMES.length];
}

/**
 * The resolved theme for a stage: its chapter biome, overlaid with any per-stage
 * biome override so the terrain palette/tint/veil match that stage's backdrop.
 * The backdrop key always comes from the chapter (per-stage art is loaded
 * separately via stageBgKey and only used as the actual image).
 */
export function stageThemeForStage(stageId: string): ChapterTheme {
  const base = chapterThemeForStage(stageId);
  const override = STAGE_BIOMES[stageNum(stageId)];
  return override ? { ...base, ...override } : base;
}
