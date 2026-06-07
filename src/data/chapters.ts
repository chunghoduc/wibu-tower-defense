/**
 * Chapter themes (T2). Stages are grouped into chapters of STAGES_PER_CHAPTER;
 * every stage in a chapter shares one battlefield backdrop + terrain palette, and
 * moving to the next chapter switches theme. With the current 10 stages this
 * yields two visually distinct chapters; more themes are ready for future stages.
 */
import { bgKey } from "./bgManifest.ts";

export interface ChapterTheme {
  id: string;
  name: string;
  /** Background image texture key for the battlefield. */
  bgKey: string;
  /** Tint applied to terrain feature sprites so they match the biome. */
  terrainTint: number;
  /** Subtle dark veil over the backdrop for unit contrast. */
  groundOverlay: number;
}

export const CHAPTER_THEMES: ChapterTheme[] = [
  { id: "greenwood", name: "Greywood Pass", bgKey: bgKey("chapter-greenwood"), terrainTint: 0xffffff, groundOverlay: 0x16201a },
  { id: "frost", name: "Frostpeak Reach", bgKey: bgKey("chapter-frost"), terrainTint: 0xbfe0ff, groundOverlay: 0x18222e },
  { id: "desert", name: "Sunscar Wastes", bgKey: bgKey("chapter-desert"), terrainTint: 0xffe0b0, groundOverlay: 0x241d12 },
  { id: "volcanic", name: "Emberfall", bgKey: bgKey("chapter-volcanic"), terrainTint: 0xffb090, groundOverlay: 0x2a1410 },
  { id: "swamp", name: "Mire Hollow", bgKey: bgKey("chapter-swamp"), terrainTint: 0xcfe0a0, groundOverlay: 0x18220f },
  { id: "corrupted", name: "The Blight", bgKey: bgKey("chapter-corrupted"), terrainTint: 0xd9b0ff, groundOverlay: 0x1d1430 },
];

const STAGES_PER_CHAPTER = 5;

/** Zero-based chapter index a stage belongs to (from its trailing number). */
export function chapterIndexForStage(stageId: string): number {
  const m = stageId.match(/(\d+)$/);
  const n = m ? parseInt(m[1]) : 1;
  return Math.floor((n - 1) / STAGES_PER_CHAPTER);
}

/** The theme for a stage (wraps if more chapters than themes ever exist). */
export function chapterThemeForStage(stageId: string): ChapterTheme {
  return CHAPTER_THEMES[chapterIndexForStage(stageId) % CHAPTER_THEMES.length];
}
