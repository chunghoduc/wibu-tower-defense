import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "../src/data/spriteManifest.ts";

// The roster convention: every tower ships a full 8-frame sheet whose frame names
// cover all three animation categories, so PreloadScene can build idle/attack/skill
// anims (it groups frames by /idle/, /atk/, /skill/ regex). A tower with fewer
// frames — or missing a category — is a broken sprite (a failed/merged/ghosted
// slice) and reads as "lack of frame" in battle. The exact idle:atk:skill split
// may be 2:3:3 or 3:3:2 (both are valid and present in the roster); only the total
// (8) and the presence of each category are contractual.
const FRAMES = 8;

describe("tower sprite manifest contract", () => {
  const towers = SPRITE_MANIFEST.filter((e) => e.kind === "tower");

  it("has the expected tower roster size", () => {
    expect(towers.length).toBe(53);
  });

  for (const e of towers) {
    it(`${e.id} has a full ${FRAMES}-frame sheet covering idle/atk/skill`, () => {
      expect(e.frames, `${e.id} frames`).toBe(FRAMES);
      expect(e.names.length, `${e.id} names length`).toBe(e.frames);
      expect(e.names.some((n) => /idle/.test(n)), `${e.id} has an idle frame`).toBe(true);
      expect(e.names.some((n) => /atk/.test(n)), `${e.id} has an attack frame`).toBe(true);
      expect(e.names.some((n) => /skill/.test(n)), `${e.id} has a skill frame`).toBe(true);
    });
  }
});
