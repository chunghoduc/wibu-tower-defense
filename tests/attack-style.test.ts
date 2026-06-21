import { describe, expect, it } from "vitest";
import {
  attackStyleFor,
  heroAttackStyle,
  skillStyleFor,
  type AttackStyle,
} from "../src/data/attackStyle.ts";
import { TOWERS } from "../src/data/towers.ts";

const style = (id: string): AttackStyle => attackStyleFor(TOWERS.find((t) => t.id === id)!);

describe("T6 — per-character attack styles", () => {
  it("derives a sensible style per archetype", () => {
    expect(style("tobi-skipstone")).toBe("lightning"); // chain
    expect(style("kona-ember-fox")).toBe("fireball"); // fire dot
    expect(style("glace-ice-maker")).toBe("iceball"); // ice debuff
    expect(style("mochi-morale-sprite")).toBe("holy"); // support
    expect(style("pip-powderkeg")).toBe("fireball"); // powder splash → fiery
  });

  it("projectiles match the weapon the character holds", () => {
    expect(style("iron-bo-cannonarm")).toBe("cannon"); // arm cannons
    expect(style("kanae-petalfall")).not.toBe("cannon"); // katana, not a shell
    expect(style("megu-explosion-sage")).toBe("fireball"); // explosion, not a shell
    expect(style("akagan-ashen")).toBe("fireball"); // molten magma
  });

  it("physical damage towers read as a swing or a mundane shot, never an elemental bolt", () => {
    const melee = new Set(["slash", "flurry", "punch", "smash", "hex"]);
    // A physical loose/shot: an arrow (bow/crossbow) or a gun's cannon report.
    const physicalRanged = new Set(["arrow", "cannon"]);
    for (const t of TOWERS.filter((x) => x.role === "damage" && x.damageType === "Physical")) {
      const s = attackStyleFor(t);
      // Never an elemental projectile (fireball/iceball/lightning/poison/arcane).
      expect(physicalRanged.has(s) || melee.has(s), `${t.id} → ${s}`).toBe(true);
    }
  });

  it("differentiates melee archetypes so each unit reads distinctly", () => {
    // Single blade → one anime crescent.
    expect(style("kazu-spirit-brawler")).toBe("slash"); // spirit sword
    // Multiple blades → a rapid flurry.
    expect(style("zoran-thricedraw")).toBe("flurry"); // three katana
    // Fast fists → a jab; a slow, devastating fist → a weighty smash.
    expect(style("yamo-desert-bandit")).toBe("punch"); // quick ki fists
    expect(style("prince-vael")).toBe("punch"); // bare-handed ki combat
    expect(style("sota-caped-fist")).toBe("smash"); // one finishing punch (slow, heavy)
    // Heavy tankers body-slam / crack the ground → smash.
    for (const id of [
      "riku-ironhide",
      "garrek-ironscale",
      "joro-diamondhide",
      "reinhart-armored-wall",
      "garron-unbreaking-pillar",
    ]) {
      expect(style(id), id).toBe("smash");
    }
    // Non-ice debuff swipes stay as the purple hex slash.
    expect(style("doro-mire-spirit")).toBe("hex");
    expect(style("shika-shadowbinder")).toBe("hex");
    expect(style("garan-sandshackle")).toBe("hex");
  });

  it("the new melee styles do not bleed into ranged/elemental units", () => {
    expect(style("akagan-ashen")).toBe("fireball"); // molten fists, ranged
    expect(style("kilo-lightning-hand")).toBe("lightning"); // lightning fists, ranged
    expect(style("karu-sunfist")).toBe("arcane"); // magic ki wave, ranged
    expect(style("sasu-stormblade")).toBe("lightning"); // lightning chokuto
    expect(style("kanae-petalfall")).toBe("arcane"); // katana at range → arcane bolt
    expect(style("morren-plaguebearer")).toBe("poison"); // decay touch
  });

  it("every tower resolves to a known style", () => {
    const known = new Set([
      "arrow",
      "fireball",
      "iceball",
      "lightning",
      "arcane",
      "cannon",
      "poison",
      "holy",
      "slash",
      "hex",
      "punch",
      "flurry",
      "smash",
    ]);
    for (const t of TOWERS) expect(known.has(attackStyleFor(t)), t.id).toBe(true);
  });

  it("hero attack style is driven by the equipped weapon family", () => {
    expect(heroAttackStyle(null, "Physical", 90)).toBe("punch"); // unarmed → boxing
    expect(heroAttackStyle("Sword", "Physical", 115)).toBe("slash");
    expect(heroAttackStyle("Bow", "Physical", 240)).toBe("arrow");
    expect(heroAttackStyle("Gun", "Physical", 260)).toBe("gunshot");
    expect(heroAttackStyle("Staff", "Magic", 210)).toBe("arcane");
    expect(heroAttackStyle("Tome", "Magic", 195)).toBe("arcane");
  });

  it("the `Any` weapon family falls back to the damage-type / range heuristic", () => {
    expect(heroAttackStyle("Any", "Magic", 200)).toBe("arcane");
    expect(heroAttackStyle("Any", "Physical", 200)).toBe("arrow");
    expect(heroAttackStyle("Any", "Physical", 90)).toBe("slash");
  });

  it("derives active-skill visual styles from skill ids (T7)", () => {
    expect(skillStyleFor("great-eruption")).toBe("fire");
    expect(skillStyleFor("glacial-chain")).toBe("ice");
    expect(skillStyleFor("chain-lightning")).toBe("lightning");
    expect(skillStyleFor("creation-rebirth")).toBe("heal");
    expect(skillStyleFor("iaido-slash")).toBe("slash");
    expect(skillStyleFor("plague-cloud")).toBe("poison");
    expect(skillStyleFor("hollow-purple")).toBe("arcane"); // fallback
  });
});
