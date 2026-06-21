// SDXL art generation pipeline: prompt -> /generate -> transparent cutout ->
// game asset. Towers get idle + attack frames; hero gets per-weapon variants.
// Resumable (skips existing). Node 18+ (global fetch), python3 + numpy + PIL.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  style,
  itemStyleFor,
  skillStyleFor,
  NEGATIVE,
  POSE,
  TOWER_VISUAL,
  ENEMY_VISUAL,
  BOSS_VISUAL,
  HERO_BASE,
  HERO_WEAPON,
  HERO_BATTLE,
  heroBattleStyle,
  HERO_BATTLE_NEGATIVE,
  HERO_ANIM_POSES,
  heroAnimPoses,
  heroAnimStyle,
  HERO_WING,
  WING_POSE,
  heroWingStyle,
  HERO_WING_NEGATIVE,
  STRUCTURE_VISUAL,
  STRUCTURE_STATE,
  structureStyle,
  STRUCTURE_NEGATIVE,
  ROLE_VISUAL,
  roleIconStyle,
  ROLEICON_NEGATIVE,
  ACHIEVEMENT_VISUAL,
  achievementIconStyle,
  ACHIEVEMENT_NEGATIVE,
  BATTLE_EMBLEM_VISUAL,
  battleEmblemStyle,
  BATTLE_EMBLEM_NEGATIVE,
  RARITY_GEM_VISUAL,
  rarityGemStyle,
  RARITY_GEM_NEGATIVE,
  wornStyleFor,
  WORN_NEGATIVE,
} from "./prompts.mjs";

// Item icons are catalog-driven: `npm run gen:item-visual` dumps every item's
// homage `appearance.look` + rarity here, so SDXL follows the item metadata.
const ITEM_VISUAL_PATH = "scripts/sdart/itemVisual.json";
// Skill ability icons are VFX-metadata-driven: `npm run gen:skill-visual` dumps
// each hero active's cast `appearance`, so the icon matches its in-battle effect.
const SKILL_VISUAL_PATH = "scripts/sdart/skillVisual.json";

const SD = "http://127.0.0.1:8765/generate";
const CUTOUT = "scripts/sdart/cutout.py";
const RAW = "/tmp/sdraw";
const GAME = "public/assets/sprites";
const PREVIEW = "/tmp/artreview";
mkdirSync(RAW, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const arg = (n) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : undefined;
};
const flag = (n) => process.argv.includes(`--${n}`);
const only = arg("only"); // tower|enemy|boss|item|hero
const sample = flag("sample");
const force = flag("force");

function seedOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000000;
}

async function sdGenerate(prompt, seed, w, h, neg = NEGATIVE) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(SD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: neg,
          steps: 30,
          width: w,
          height: h,
          seed,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
      return buf;
    } catch (e) {
      console.log(`    gen attempt ${attempt} failed: ${e.message}`);
    }
  }
  return null;
}

function cut(rawPath, outPath, size) {
  execFileSync(
    "python3",
    [CUTOUT, rawPath, outPath, "--size", String(size), "--tol", "52", "--pad", "6"],
    { stdio: "ignore" },
  );
}

// job: {kind, id, file, prompt, seed, w, h, size}
function buildJobs() {
  const jobs = [];
  const towerIds = Object.keys(TOWER_VISUAL);
  for (const id of towerIds) {
    const v = TOWER_VISUAL[id],
      sd = seedOf(id);
    jobs.push({
      kind: "tower",
      id,
      file: `${id}.png`,
      prompt: style(`${v}, ${POSE.idle}`),
      seed: sd,
      w: 768,
      h: 1024,
      size: 320,
    });
    jobs.push({
      kind: "tower",
      id,
      file: `${id}__attack.png`,
      prompt: style(`${v}, ${POSE.attack}`),
      seed: sd,
      w: 768,
      h: 1024,
      size: 320,
    });
  }
  // hero base + weapon variants
  jobs.push({
    kind: "hero",
    id: "hero",
    file: `hero.png`,
    prompt: style(`${HERO_BASE} ${HERO_WEAPON.sword}, ${POSE.idle}`),
    seed: seedOf("hero"),
    w: 768,
    h: 1024,
    size: 320,
  });
  for (const [wt, desc] of Object.entries(HERO_WEAPON)) {
    jobs.push({
      kind: "hero",
      id: "hero",
      file: `hero__${wt}.png`,
      prompt: style(`${HERO_BASE} ${desc}, ${POSE.idle}`),
      seed: seedOf("hero"),
      w: 768,
      h: 1024,
      size: 320,
    });
  }
  // battle-hero per-weapon art: stance + attack, one shared seed per weapon so the
  // two poses are the same character.
  for (const [wt, desc] of Object.entries(HERO_BATTLE)) {
    const sd = seedOf(`herobattle-${wt}`);
    jobs.push({
      kind: "herobattle",
      id: wt,
      file: `${wt}.png`,
      prompt: heroBattleStyle(desc, POSE.idle),
      seed: sd,
      w: 768,
      h: 1024,
      size: 320,
      neg: HERO_BATTLE_NEGATIVE,
    });
    jobs.push({
      kind: "herobattle",
      id: `${wt}__attack`,
      file: `${wt}__attack.png`,
      prompt: heroBattleStyle(desc, POSE.attack),
      seed: sd,
      w: 768,
      h: 1024,
      size: 320,
      neg: HERO_BATTLE_NEGATIVE,
    });
  }
  // battle-hero ANIMATION FRAMES: real drawn frames per state so the hero animates
  // (idle reuses the stance above). Every frame shares the archetype's key-visual
  // seed + descriptor — only the pose phrase changes — to stay on-model.
  // Keys/files: heroanim__<wt>__<state>_<i>.
  for (const [wt, desc] of Object.entries(HERO_BATTLE)) {
    const sd = seedOf(`herobattle-${wt}`);
    for (const state of Object.keys(HERO_ANIM_POSES)) {
      heroAnimPoses(wt, state).forEach((pose, i) => {
        jobs.push({
          kind: "heroanim",
          id: `${wt}__${state}_${i}`,
          file: `${wt}__${state}_${i}.png`,
          prompt: heroAnimStyle(desc, pose),
          seed: sd,
          w: 768,
          h: 1024,
          size: 320,
          neg: HERO_BATTLE_NEGATIVE,
        });
      });
    }
  }
  // battle-hero worn WINGS: one unique pair per wing item, two flap frames sharing
  // a seed (glide + raised) so HeroWeaponSprite can crossfade a real wing-beat.
  for (const [id, desc] of Object.entries(HERO_WING)) {
    const sd = seedOf(`herowing-${id}`);
    jobs.push({
      kind: "herowing",
      id,
      file: `${id}.png`,
      prompt: heroWingStyle(desc, WING_POSE.spread),
      seed: sd,
      w: 768,
      h: 768,
      size: 256,
      neg: HERO_WING_NEGATIVE,
    });
    jobs.push({
      kind: "herowing",
      id: `${id}__up`,
      file: `${id}__up.png`,
      prompt: heroWingStyle(desc, WING_POSE.raised),
      seed: sd,
      w: 768,
      h: 768,
      size: 256,
      neg: HERO_WING_NEGATIVE,
    });
  }
  for (const [id, v] of Object.entries(ENEMY_VISUAL))
    jobs.push({
      kind: "enemy",
      id,
      file: `${id}.png`,
      prompt: style(`${v}, ${POSE.idle}`),
      seed: seedOf(id),
      w: 768,
      h: 1024,
      size: 300,
    });
  for (const [id, v] of Object.entries(BOSS_VISUAL))
    jobs.push({
      kind: "boss",
      id,
      file: `${id}.png`,
      prompt: style(`${v}, ${POSE.idle}`),
      seed: seedOf(id),
      w: 832,
      h: 1024,
      size: 384,
    });
  // structures (the player's castle) — building style + its own negative, two
  // HP states sharing a seed so silhouette/identity stays consistent.
  for (const [id, v] of Object.entries(STRUCTURE_VISUAL)) {
    const sd = seedOf(id);
    jobs.push({
      kind: "structure",
      id,
      file: `${id}.png`,
      prompt: structureStyle(v, STRUCTURE_STATE.intact),
      seed: sd,
      w: 768,
      h: 768,
      size: 256,
      neg: STRUCTURE_NEGATIVE,
    });
    jobs.push({
      kind: "structure",
      id,
      file: `${id}__damaged.png`,
      prompt: structureStyle(v, STRUCTURE_STATE.damaged),
      seed: sd,
      w: 768,
      h: 768,
      size: 256,
      neg: STRUCTURE_NEGATIVE,
    });
  }
  // role badge emblems — one flat icon per TowerRole, transparent-cut to 64px.
  for (const [role, v] of Object.entries(ROLE_VISUAL)) {
    jobs.push({
      kind: "roleicon",
      id: role,
      file: `${role}.png`,
      prompt: roleIconStyle(v),
      seed: seedOf(role),
      w: 768,
      h: 768,
      size: 64,
      neg: ROLEICON_NEGATIVE,
    });
  }
  // achievement medallions — one full-colour trophy badge per achievement,
  // transparent-cut to 128px (rendered ~64px on the board card, no tint).
  for (const [id, v] of Object.entries(ACHIEVEMENT_VISUAL)) {
    jobs.push({
      kind: "achievement",
      id,
      file: `${id}.png`,
      prompt: achievementIconStyle(v),
      seed: seedOf(id),
      w: 768,
      h: 768,
      size: 128,
      neg: ACHIEVEMENT_NEGATIVE,
    });
  }
  // rarity gem emblems — one faceted gemstone per rarity, transparent-cut to 64px.
  for (const [rarity, v] of Object.entries(RARITY_GEM_VISUAL)) {
    jobs.push({
      kind: "rarity",
      id: rarity,
      file: `${rarity}.png`,
      prompt: rarityGemStyle(v),
      seed: seedOf(`rarity-${rarity}`),
      w: 768,
      h: 768,
      size: 64,
      neg: RARITY_GEM_NEGATIVE,
    });
  }
  // battle CTA emblem — one bold combat crest, transparent-cut to 96px, in ui/.
  jobs.push({
    kind: "ui",
    id: "battle-emblem",
    file: `battle-emblem.png`,
    prompt: battleEmblemStyle(BATTLE_EMBLEM_VISUAL),
    seed: seedOf("battle-emblem"),
    w: 768,
    h: 768,
    size: 96,
    neg: BATTLE_EMBLEM_NEGATIVE,
  });
  const items = existsSync(ITEM_VISUAL_PATH)
    ? JSON.parse(readFileSync(ITEM_VISUAL_PATH, "utf8"))
    : [];
  if (!items.length)
    console.log(
      `  WARN: ${ITEM_VISUAL_PATH} missing/empty — run \`npm run gen:item-visual\` first`,
    );
  // size 96 — the loader (PreloadScene) and the in-battle scaler treat item
  // icons as a fixed 96×96 native asset; other sizes render cropped/oversized.
  for (const it of items)
    jobs.push({
      kind: "item",
      id: it.id,
      file: `${it.id}.png`,
      prompt: itemStyleFor(it.look, it.rarity),
      seed: seedOf(it.id),
      w: 768,
      h: 768,
      size: 96,
    });
  // worn-on-body overlays — the hero "dressed" paper-doll. One per BODY-slot item
  // (accessories excluded), purpose-framed front-facing with no wearer, cut to
  // 128px (rendered scaled to the body part; resolves worn__<id> with item-icon
  // fallback). Driven by the same itemVisual catalog dump as item icons.
  const WORN_SLOTS = new Set(["Weapon", "Helmet", "BodyArmor", "Pants", "Gloves", "Boots", "Wing"]);
  for (const it of items) {
    if (!WORN_SLOTS.has(it.slot)) continue;
    jobs.push({
      kind: "worn",
      id: it.id,
      file: `${it.id}.png`,
      // Gloves/Boots use SINGLE-limb framing (one piece) — the procedural rig
      // mirrors them onto both hand/foot bones for per-limb tracking.
      prompt: wornStyleFor(
        it.look,
        it.slot,
        it.rarity,
        it.slot === "Gloves" || it.slot === "Boots",
      ),
      seed: seedOf("worn-" + it.id),
      w: 768,
      h: 768,
      size: 128,
      neg: WORN_NEGATIVE,
      slot: it.slot,
    });
  }
  // skill ability emblems — 96×96, same fixed-size contract as item icons.
  const skills = existsSync(SKILL_VISUAL_PATH)
    ? JSON.parse(readFileSync(SKILL_VISUAL_PATH, "utf8"))
    : [];
  if (!skills.length)
    console.log(
      `  WARN: ${SKILL_VISUAL_PATH} missing/empty — run \`npm run gen:skill-visual\` first`,
    );
  for (const sk of skills)
    jobs.push({
      kind: "skill",
      id: sk.id,
      file: `${sk.id}.png`,
      prompt: skillStyleFor(sk.look, sk.rarity),
      seed: seedOf(sk.id),
      w: 768,
      h: 768,
      size: 96,
    });
  return jobs;
}

async function main() {
  const slot = arg("slot"); // worn batches: filter by item slot (e.g. BodyArmor)
  const limit = arg("limit"); // cap the batch size (smoke tests)
  const heroArch = arg("hero-arch"); // regen only one battle-hero archetype's frames
  let jobs = buildJobs();
  if (only) jobs = jobs.filter((j) => j.kind === only);
  if (slot) jobs = jobs.filter((j) => j.slot === slot);
  if (heroArch)
    jobs = jobs.filter(
      (j) =>
        (j.kind === "herobattle" || j.kind === "heroanim") &&
        (j.id === heroArch || j.id.startsWith(`${heroArch}__`)),
    );
  if (sample) {
    const pick = ["karu-sunfist", "zoran-thricedraw", "garan-sandshackle", "yuki-frostward-maiden"];
    jobs = jobs.filter(
      (j) =>
        (j.kind === "tower" && pick.includes(j.id)) ||
        (j.kind === "hero" && (j.file === "hero.png" || j.file === "hero__staff.png")) ||
        (j.kind === "enemy" && ["grunt", "gargoyle"].includes(j.id)) ||
        (j.kind === "boss" && j.id === "overlord") ||
        (j.kind === "item" && ["iron-sword", "arcane-staff"].includes(j.id)),
    );
  }
  if (!force) jobs = jobs.filter((j) => !existsSync(`${GAME}/${j.kind}/${j.file}`));
  if (limit) jobs = jobs.slice(0, Number(limit));

  console.log(`SD generating ${jobs.length} sprites`);
  let n = 0;
  for (const j of jobs) {
    n++;
    mkdirSync(`${GAME}/${j.kind}`, { recursive: true });
    const rawPath = `${RAW}/${j.kind}__${j.file}`;
    console.log(`[${n}/${jobs.length}] ${j.kind}/${j.file}`);
    const buf = await sdGenerate(j.prompt, j.seed, j.w, j.h, j.neg);
    if (!buf) {
      console.log("    SKIP (gen failed)");
      continue;
    }
    writeFileSync(rawPath, buf);
    try {
      cut(rawPath, `${GAME}/${j.kind}/${j.file}`, j.size);
    } catch (e) {
      console.log(`    cutout failed: ${e.message}`);
    }
  }
  console.log("done");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
