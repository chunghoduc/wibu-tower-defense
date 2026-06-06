// Orchestrator: compose sprites -> emit pixel-art-gen JSON -> render PNG via the
// skill's Python renderer. Writes game assets (native res) + large previews, and
// a contact sheet for review.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { canvas, outline, emit } from "./canvas.mjs";
import { aura, back, legs, body, arms, head, face, hair, headgear, weapon } from "./parts.mjs";
import { CHARACTERS, HERO } from "./specs.mjs";
import { composeEnemy, ENEMY_SPECS } from "./creatures.mjs";
import { composeItem, ITEM_SPECS, composeVfx, VFX_SPECS } from "./items.mjs";

const BOSS_IDS = new Set(["champion", "warden", "overlord"]);

const RENDER = "/tmp/pag/plugins/pixel-art-gen/skills/pixel-art-gen/scripts/render_pixel_art.py";
const JSON_DIR = "/tmp/artjson";
const PREVIEW_DIR = "/tmp/artreview";
const GAME_ROOT = "public/assets/sprites";

mkdirSync(JSON_DIR, { recursive: true });
mkdirSync(PREVIEW_DIR, { recursive: true });

function composeCharacter(spec) {
  const cv = canvas(48, 48);
  back(cv, spec);
  legs(cv, spec);
  body(cv, spec);
  arms(cv, spec);
  head(cv, spec);
  hair(cv, spec);
  headgear(cv, spec);
  face(cv, spec);
  weapon(cv, spec);
  outline(cv);
  aura(cv, spec); // after outline so glow isn't outlined
  return cv;
}

function render(jsonPath, outPath, p) {
  execFileSync("python3", [RENDER, jsonPath, "-o", outPath, "-p", String(p)], { stdio: "ignore" });
}

function emitSprite(id, kind, cv) {
  const jp = `${JSON_DIR}/${kind}__${id}.json`;
  emit(cv, jp, 1);
  const gameDir = `${GAME_ROOT}/${kind}`;
  mkdirSync(gameDir, { recursive: true });
  render(jp, `${gameDir}/${id}.png`, 1);          // game asset: native res
  render(jp, `${PREVIEW_DIR}/${kind}__${id}.png`, 8); // preview: 8x
}

const built = [];

// ---- characters (towers) ----
for (const [id, spec] of Object.entries(CHARACTERS)) {
  const cv = composeCharacter(spec);
  emitSprite(id, "tower", cv);
  built.push({ kind: "tower", id, rarity: spec.rarity });
  console.log("tower", id);
}

// ---- hero ----
{
  const cv = composeCharacter(HERO);
  emitSprite("hero", "hero", cv);
  built.push({ kind: "hero", id: "hero", rarity: HERO.rarity });
  console.log("hero hero");
}

// ---- enemies + bosses ----
for (const [id, spec] of Object.entries(ENEMY_SPECS)) {
  const cv = composeEnemy(spec);
  const kind = BOSS_IDS.has(id) ? "boss" : "enemy";
  emitSprite(id, kind, cv);
  built.push({ kind, id, rarity: BOSS_IDS.has(id) ? "Legendary" : "Common" });
  console.log(kind, id);
}

// ---- items ----
for (const [id, spec] of Object.entries(ITEM_SPECS)) {
  const cv = composeItem(spec);
  emitSprite(id, "item", cv);
  built.push({ kind: "item", id, rarity: spec.rarity });
  console.log("item", id);
}

// ---- skill VFX ----
for (const [id, spec] of Object.entries(VFX_SPECS)) {
  const cv = composeVfx(spec);
  emitSprite(id, "vfx", cv);
  built.push({ kind: "vfx", id, rarity: "Magic" });
  console.log("vfx", id);
}

// ---- contact sheets (one per kind group) ----
function sheet(title, file, items, cols) {
  const cards = items.map(b =>
    `<div class="c"><img src="${b.kind}__${b.id}.png"><div class="n r-${b.rarity}">${b.id}</div></div>`
  ).join("");
  const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#1b2230;font-family:system-ui;width:1180px}
h1{color:#ffd700;margin:16px 20px 2px;font-size:20px}
p{color:#90caf9;margin:0 20px 12px;font-size:12px}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:12px 20px}
.c{background:#222c3c;border:1px solid #36465c;border-radius:8px;padding:8px;text-align:center}
.c img{width:112px;height:112px;image-rendering:pixelated}
.n{font-size:9px;margin-top:6px;color:#cdd}
.r-Common{color:#9aa6b4}.r-Magic{color:#4d9bf0}.r-Rare{color:#c07be0}.r-Legendary{color:#ffb24d}.r-Unique{color:#ff6b6b}
</style><h1>${title}</h1>
<p>Rendered via pixel-art-gen skill. image-rendering:pixelated.</p>
<div class="g">${cards}</div>`;
  writeFileSync(`${PREVIEW_DIR}/${file}.html`, html);
  const rows = Math.ceil(items.length / cols);
  try {
    execFileSync("google-chrome", ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
      "--force-device-scale-factor=1", `--window-size=1180,${120 + rows * 150}`,
      `--screenshot=${PREVIEW_DIR}/${file}.png`, `file://${PREVIEW_DIR}/${file}.html`], { stdio: "ignore" });
    console.log("sheet ->", `${PREVIEW_DIR}/${file}.png`);
  } catch (e) { console.log("sheet failed:", e.message); }
}

sheet("Wibu TD — characters (homage-inspired)", "sheet_characters",
  built.filter(b => b.kind === "tower" || b.kind === "hero"), 7);
sheet("Wibu TD — enemies & bosses", "sheet_enemies",
  built.filter(b => b.kind === "enemy" || b.kind === "boss"), 7);
sheet("Wibu TD — items", "sheet_items", built.filter(b => b.kind === "item"), 7);
sheet("Wibu TD — skill VFX", "sheet_vfx", built.filter(b => b.kind === "vfx"), 6);

console.log("done", built.length, "sprites");
