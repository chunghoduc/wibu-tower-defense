import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SKILL_ICON_IDS } from "../src/data/skillIconManifest.ts";

/**
 * Regression guard for the "Failed to process file" loader spam:
 * PreloadScene loads `assets/sprites/skill/<id>.png` for every SKILL_ICON_ID.
 * When an id has no PNG on disk, Vite's dev SPA-fallback serves index.html
 * (HTTP 200) for the missing path, which Phaser cannot decode as an image and
 * logs `Failed to process file: spritesheet skill__<id>` — once per missing
 * icon. This test fails loudly the moment the catalog declares a skill icon
 * that hasn't been generated, so art drift can never silently re-introduce the
 * spam.
 */
describe("skill icon coverage", () => {
  const ids = [...new Set(SKILL_ICON_IDS)];

  it("every declared skill icon has a generated PNG on disk", () => {
    const missing = ids.filter((id) => !existsSync(`public/assets/sprites/skill/${id}.png`));
    expect(missing, `missing skill icons (run npm run gen:skill-visual && npx vite-node scripts/sdart/sdgen.mjs --only=skill):\n${missing.join("\n")}`).toEqual([]);
  });
});
