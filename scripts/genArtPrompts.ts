/**
 * Emit every art-generation prompt as Markdown to stdout.
 *
 * Run: `npm run gen:art-prompts > docs/art/prompts.md`
 *
 * Feed each prompt to an image model; save the result to the listed path under
 * /public, and PreloadScene loads it automatically on next run.
 */
import { allArtPrompts } from "../src/data/artPrompts.ts";
import { SPRITE_DIMENSIONS, ANIMATION_FRAMES } from "../src/data/artSpec.ts";

const entries = allArtPrompts();

const lines: string[] = [];
lines.push("# Art Generation Prompts");
lines.push("");
lines.push(`Generated from the data catalogs — ${entries.length} sprites total.`);
lines.push("");
lines.push("**Canonical dimensions:**");
for (const [kind, d] of Object.entries(SPRITE_DIMENSIONS)) {
  lines.push(`- ${kind}: ${d.w}×${d.h}`);
}
lines.push("");
lines.push(`**Animation frames (animated entities):** ${ANIMATION_FRAMES.join(", ")}`);
lines.push("");
lines.push("---");
lines.push("");

for (const e of entries) {
  lines.push(`### \`${e.key}\``);
  lines.push("");
  lines.push(`- **Save to:** \`public/${e.path}\``);
  lines.push("");
  lines.push("```");
  lines.push(e.prompt);
  lines.push("```");
  lines.push("");
}

// eslint-disable-next-line no-console
console.log(lines.join("\n"));
