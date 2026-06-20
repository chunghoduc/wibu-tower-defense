// One-shot cleanup: the `gen:sprites --only achievement` run did NOT filter
// (the script wants `--only=achievement`), so `--force` re-rendered hundreds of
// unrelated sprites and the SD server died partway. Restore every modified file
// under public/assets/sprites/ EXCEPT the achievement folder back to HEAD.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = "public/assets/sprites/";
const status = execSync("git status --porcelain -- " + ROOT, { encoding: "utf8" });
const files = status
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3).trim()) // strip the "XY " status prefix
  .filter((p) => p.startsWith(ROOT))
  .filter((p) => !p.startsWith(ROOT + "achievement/"));

let restored = 0;
for (const p of files) {
  try {
    const buf = execSync(`git show HEAD:"${p}"`, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(p, buf);
    restored++;
  } catch (e) {
    console.error("FAILED", p, e.message);
  }
}
console.log(`restored ${restored}/${files.length} non-achievement sprites from HEAD`);
