import { describe, expect, it } from "vitest";
import {
  chapterIndexForStage,
  chapterThemeForStage,
  CHAPTER_THEMES,
} from "../src/data/chapters.ts";

describe("chapter themes", () => {
  it("groups stages into 5-stage chapters", () => {
    expect(chapterIndexForStage("stage-1")).toBe(0);
    expect(chapterIndexForStage("stage-5")).toBe(0);
    expect(chapterIndexForStage("stage-6")).toBe(1);
    expect(chapterIndexForStage("stage-10")).toBe(1);
  });
  it("different chapters get different themes", () => {
    expect(chapterThemeForStage("stage-1").id).not.toBe(chapterThemeForStage("stage-6").id);
  });
  it("every theme has a bg key", () => {
    for (const t of CHAPTER_THEMES) expect(t.bgKey).toMatch(/^bg__chapter-/);
  });
});
