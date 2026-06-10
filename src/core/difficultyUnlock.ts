/**
 * Difficulty-tier gating (per chapter).
 *
 * A harder tier of a chapter only opens once the chapter is fully conquered on
 * the tier below it:
 *  - Normal    — always available (per-stage sequential unlock still applies).
 *  - Hard      — every stage in the chapter must be cleared on Normal.
 *  - Nightmare — every stage in the chapter must be cleared on Hard.
 *
 * "Chapter" is the 5-stage grouping from chapters.ts, so the two halves of the
 * shipped 10-stage run gate independently: clearing Normal on stages 1–5 opens
 * Hard for 1–5, not for 6–10.
 */
import type { Difficulty } from "../data/schema.ts";
import type { HeroSave } from "./save.ts";
import { STAGES } from "../data/stage.ts";
import { chapterIndexForStage } from "../data/chapters.ts";

/** Stage ids in the same chapter as `stageId` (only stages that actually exist). */
export function chapterStageIds(stageId: string): string[] {
  const ci = chapterIndexForStage(stageId);
  return STAGES.filter((s) => chapterIndexForStage(s.id) === ci).map((s) => s.id);
}

/** The tier a given tier is gated behind, or null if it's always open. */
export function prerequisiteTier(difficulty: Difficulty): Difficulty | null {
  if (difficulty === "Hard") return "Normal";
  if (difficulty === "Nightmare") return "Hard";
  return null;
}

/** Whether `difficulty` may be played on `stageId` given the save's clear record. */
export function isDifficultyUnlocked(
  save: HeroSave,
  stageId: string,
  difficulty: Difficulty,
): boolean {
  const prereq = prerequisiteTier(difficulty);
  if (!prereq) return true;
  const map = save.progress.stageClearMap;
  return chapterStageIds(stageId).every((id) => map[id]?.[prereq] === true);
}
