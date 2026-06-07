/**
 * squadInfoPanel — renders a character's (or the hero's) details into the Squad
 * scene's right-hand info panel. Pure presentation: given a scene, a target
 * container, a layout box, and the data, it appends text/image game objects.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { CharacterDef, Rarity, Stats } from "../data/schema.ts";
import { ITEM_SLOTS } from "../data/schema.ts";
import type { HeroSave } from "../core/save.ts";
import { towerActiveInfo, passiveInfo } from "../data/passiveSkills.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const ROLE_LABEL: Record<string, string> = {
  damage: "Damage", splash: "Splash", chain: "Chain", dot: "DoT", debuff: "Debuff", support: "Support",
};

const n0 = (v: number) => `${Math.round(v)}`;
const n1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (v: number) => `${v.toFixed(1)}×`;

// The stats worth surfacing, in display order, with a formatter.
const STAT_ROWS: [keyof Stats, string, (v: number) => string][] = [
  ["atk", "ATK", n0], ["range", "Range", n0], ["attackSpeed", "Atk Spd", n1],
  ["critRate", "Crit", pct], ["critDamage", "Crit Dmg", mult], ["maxHp", "HP", n0],
  ["armor", "Armor", n0], ["magicResist", "M.Resist", n0], ["skillPower", "Skill Pwr", mult],
];

type C = Phaser.GameObjects.Container;
type S = Phaser.Scene;

function add(container: C, obj: Phaser.GameObjects.GameObject): void { container.add(obj); }

/** Section divider + label. */
function section(scene: S, c: C, x: number, y: number, w: number, text: string): number {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x2a3a56, 1).lineBetween(x, y + 7, x + w, y + 7);
  add(c, g);
  add(c, crispText(scene, x, y, text, { fontSize: "10px", color: "#ffd86a", fontStyle: "bold", backgroundColor: "#0d1420" }).setPadding(0, 0, 4, 0));
  return y + 18;
}

/** Render a tower/character's full info into the panel box at (x,y) width w. */
export function renderCharInfo(scene: S, c: C, x: number, y: number, w: number, def: CharacterDef, stars: number): void {
  // Avatar + name header.
  const key = `tower__${def.id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(x + 28, y + 28, key, 0).setOrigin(0.5);
    img.setScale(Math.min(56 / img.width, 56 / img.height));
    add(c, img);
  }
  add(c, crispText(scene, x + 62, y, def.name, { fontSize: "13px", color: RARITY_HEX[def.rarity], fontStyle: "bold", wordWrap: { width: w - 62 } }));
  add(c, crispText(scene, x + 62, y + 22, `${def.rarity} · ${ROLE_LABEL[def.role] ?? def.role}`, { fontSize: "10px", color: "#9fb0c4" }));
  if (stars > 0) add(c, crispText(scene, x + 62, y + 38, "★".repeat(stars), { fontSize: "11px", color: "#ffd24a" }));

  // Stats (2-column grid of non-zero values).
  let sy = section(scene, c, x, y + 60, w, "Stats");
  const rows = STAT_ROWS.filter(([k]) => (def.baseStats[k] ?? 0) !== 0);
  const colW = w / 2;
  rows.forEach(([k, lbl, fmt], i) => {
    const cx = x + (i % 2) * colW, cy = sy + Math.floor(i / 2) * 15;
    add(c, crispText(scene, cx, cy, lbl, { fontSize: "9px", color: "#8fa0b4" }));
    add(c, crispText(scene, cx + colW - 8, cy, fmt(def.baseStats[k]), { fontSize: "9px", color: "#e8eef6", fontStyle: "bold" }).setOrigin(1, 0));
  });
  sy += Math.ceil(rows.length / 2) * 15 + 6;

  // Skills.
  sy = section(scene, c, x, sy, w, "Skills");
  if (def.active) {
    const a = towerActiveInfo(def.active);
    sy = skillLine(scene, c, x, sy, w, `⚡ ${a.name}`, a.description, "#a8d8ff");
  }
  for (const pid of def.passives) {
    const p = passiveInfo(pid);
    sy = skillLine(scene, c, x, sy, w, `• ${p.name}`, p.description, "#cdd6e6");
  }
}

function skillLine(scene: S, c: C, x: number, y: number, w: number, title: string, desc: string, color: string): number {
  add(c, crispText(scene, x, y, title, { fontSize: "10px", color, fontStyle: "bold" }));
  const d = crispText(scene, x, y + 12, desc, { fontSize: "8px", color: "#9aa8bc", wordWrap: { width: w } });
  add(c, d);
  return y + 14 + d.height + 4;
}

/** Render the player hero's summary into the panel box. */
export function renderHeroInfo(scene: S, c: C, x: number, y: number, w: number, save: HeroSave): void {
  if (scene.textures.exists("hero__hero")) {
    const img = scene.add.image(x + 28, y + 28, "hero__hero", 0).setOrigin(0.5);
    img.setScale(Math.min(56 / img.width, 56 / img.height));
    add(c, img);
  }
  add(c, crispText(scene, x + 62, y, "Hero", { fontSize: "14px", color: "#ffd700", fontStyle: "bold" }));
  add(c, crispText(scene, x + 62, y + 22, `Level ${save.hero.level}`, { fontSize: "11px", color: "#cfe0f5" }));
  add(c, crispText(scene, x + 62, y + 38, `${save.hero.skillPoints} skill pts`, { fontSize: "10px", color: "#9fb0c4" }));

  let sy = section(scene, c, x, y + 60, w, "Loadout");
  const equipped = ITEM_SLOTS.filter((s) => save.inventory.equipped[s]).length;
  add(c, crispText(scene, x, sy, `Equipped items: ${equipped}/${ITEM_SLOTS.length}`, { fontSize: "10px", color: "#e8eef6" }));
  sy += 16;
  const skNames = save.hero.equippedSkillIds.map((id) => ACTIVE_SKILLS_MAP.get(id)?.name ?? id);
  add(c, crispText(scene, x, sy, `Skills: ${skNames.length ? skNames.join(", ") : "none equipped"}`, { fontSize: "10px", color: skNames.length ? "#a8d8ff" : "#8fa0b4" }));
  sy += 16;
  add(c, crispText(scene, x, sy, `Passive nodes: ${save.hero.unlockedNodes.length}`, { fontSize: "10px", color: "#cdd6e6" }));

  sy = section(scene, c, x, sy + 16, w, "");
  add(c, crispText(scene, x, sy, "Your hero fights alongside the squad in every battle. Equip gear in Inventory.", { fontSize: "9px", color: "#90a4bb", wordWrap: { width: w } }));
}
