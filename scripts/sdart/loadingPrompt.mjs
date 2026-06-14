// Pure assembly of the loading-screen KEY-ART prompt from character descriptors.
// A SCENE (not an isolated sprite): a heroic trio rallying before a looming boss.
// No API calls, no Phaser — unit-tested in tests/loadingPrompt.test.ts.

/** Condense a character descriptor to its silhouette essence (first 2 clauses)
 *  so a multi-character scene prompt stays readable instead of blurring. */
export function essence(descriptor) {
  const parts = descriptor.split(",").map((s) => s.trim());
  return parts.slice(0, 2).join(", ");
}

const WRAPPER =
  "epic anime battlefield key art splash poster, dramatic low hero angle, " +
  "dusk war-torn battlefield, volumetric god-ray light shafts, drifting embers " +
  "and smoke, rim light, cinematic composition with clear foreground and " +
  "background depth, fantasy anime game illustration, highly detailed, painterly, " +
  "vibrant saturated colors";

const NEG =
  "isolated on white background, white background, plain background, single " +
  "character, sprite, character sheet, multiple panels, thumbnails, duplicate " +
  "faces, extra limbs, extra fingers, fused bodies, merged characters, blurry " +
  "faces, user interface, UI, hud, text, words, watermark, logo, signature, " +
  "frame, border, lowres, jpeg artifacts, deformed";

/** Build the loading key-art prompt from a hero trio + one boss descriptor. */
export function buildLoadingPrompt({ heroes, boss }) {
  const trio = heroes.map(essence);
  const foreground =
    "In the lower foreground three heroic champions stand together " +
    "shoulder to shoulder facing the viewer: " +
    trio.map((h, i) => `${["first", "second", "third"][i] ?? "another"}, ${h}`).join("; ") +
    ".";
  const background =
    "Rising and looming in the smoky background towers a single colossal boss: " +
    `${essence(boss)}.`;
  const prompt = `${WRAPPER}. ${foreground} ${background}`;
  return { prompt, negative: NEG };
}
