/**
 * Dependency-cycle guard (`npm run lint:cycles`).
 *
 * Runs madge over src/ with type-only imports skipped, so only RUNTIME cycles
 * count. The declaration-merge split pattern (BattleState/BattleScene methods
 * merged onto the prototype from sibling modules — see memory
 * project_god_class_split_pattern) is intentionally cyclic and allowlisted;
 * anything else fails the build.
 */
import madge from "madge";

// Intentional cycles: aggregator ⇄ merged-method sibling (declaration merging).
const ALLOWED = new Set(["core/battle.ts", "scenes/BattleScene.ts"]);

const res = await madge("src/", {
  fileExtensions: ["ts"],
  detectiveOptions: { ts: { skipTypeImports: true } },
});

const cycles = res.circular();
const bad = cycles.filter((cycle) => !cycle.some((f) => ALLOWED.has(f)));

if (bad.length > 0) {
  console.error("Unexpected runtime dependency cycles:\n");
  for (const c of bad) console.error("  " + c.join(" -> "));
  console.error(
    "\nBreak the cycle (move shared values to a leaf module or use `import type`)," +
      "\nor — only for a deliberate declaration-merge split — extend ALLOWED in scripts/checkCycles.mjs.",
  );
  process.exit(1);
}

const allowed = cycles.length - bad.length;
console.log(
  `lint:cycles OK — ${cycles.length} cycle(s) found, all within the allowlisted ` +
    `declaration-merge pattern (${allowed} allowlisted, 0 unexpected).`,
);
