import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/data/towers.ts";
import { TOWERS_C } from "../src/data/towersC.ts";
import { attackStyleFor, isMeleeStyle } from "../src/data/attackStyle.ts";
import { deriveDamageType, FAMILY, type WeaponFamily } from "../src/data/weaponFamily.ts";

/** Pre-rework damage types — frozen snapshot guarding against silent drift. */
const EXPECTED_DAMAGE: Record<string, "Physical" | "Magic"> = {
  "yamo-desert-bandit": "Physical",
  "kazu-spirit-brawler": "Magic",
  "zoran-thricedraw": "Physical",
  "prince-vael": "Physical",
  "karu-sunfist": "Magic",
  "jugo-limitless": "Magic",
  "sota-caped-fist": "Physical",
  "pip-powderkeg": "Physical",
  "iron-bo-cannonarm": "Physical",
  "kanae-petalfall": "Magic",
  "akagan-ashen": "Magic",
  "megu-explosion-sage": "Magic",
  "tobi-skipstone": "Physical",
  "zeni-spark": "Magic",
  "hyo-frost-arc": "Magic",
  "kilo-lightning-hand": "Magic",
  "sasu-stormblade": "Magic",
  "bram-thornling": "Physical",
  "kona-ember-fox": "Magic",
  "shion-venom-priestess": "Magic",
  "roan-flame-alchemist": "Magic",
  "morren-plaguebearer": "Magic",
  "doro-mire-spirit": "Magic",
  "shika-shadowbinder": "Magic",
  "glace-ice-maker": "Magic",
  "yuki-frostward-maiden": "Magic",
  "garan-sandshackle": "Physical",
  "mochi-morale-sprite": "Magic",
  "lyra-tempo": "Magic",
  "orin-celestial-herald": "Magic",
  "aldric-banner-bearer": "Physical",
  "senna-slug-sannin": "Physical",
  "riku-ironhide": "Physical",
  "garrek-ironscale": "Magic",
  "joro-diamondhide": "Physical",
  "reinhart-armored-wall": "Physical",
  "garron-unbreaking-pillar": "Physical",
};

/**
 * Which towers fought in melee (cleave) before the rework — must not flip.
 * These are the bare-handed/bladed brawlers (punch/slash/flurry/smash) and the
 * tankers (smash). Support (→holy) and debuff (→hex) units are NOT melee: `hex`
 * is the ranged debuff touch, not a cleaving swing — see MELEE_STYLES in
 * attackStyle.ts — so senna/doro/shika/garan are deliberately excluded.
 */
const EXPECTED_MELEE = new Set<string>([
  "yamo-desert-bandit",
  "kazu-spirit-brawler",
  "zoran-thricedraw",
  "prince-vael",
  "sota-caped-fist",
  "riku-ironhide",
  "garrek-ironscale",
  "joro-diamondhide",
  "reinhart-armored-wall",
  "garron-unbreaking-pillar",
]);

describe("weapon migration parity", () => {
  it("every tower carries a structured weapon spec", () => {
    for (const t of TOWERS) expect(t.meta?.weapon?.family, t.id).toBeTruthy();
  });

  it("derived damageType matches each tower's built damageType (zero drift)", () => {
    for (const t of TOWERS) {
      expect(deriveDamageType(t.meta!.weapon), t.id).toBe(t.damageType);
    }
  });

  it("damageType matches the pre-rework snapshot for all 37 existing towers", () => {
    for (const [id, dmg] of Object.entries(EXPECTED_DAMAGE)) {
      const t = TOWERS.find((x) => x.id === id);
      expect(t, `missing ${id}`).toBeTruthy();
      expect(t!.damageType, id).toBe(dmg);
    }
  });

  it("melee-vs-ranged class (cleave) is unchanged for existing towers", () => {
    for (const id of Object.keys(EXPECTED_DAMAGE)) {
      const t = TOWERS.find((x) => x.id === id)!;
      expect(isMeleeStyle(attackStyleFor(t)), `${id} → ${attackStyleFor(t)}`).toBe(
        EXPECTED_MELEE.has(id),
      );
    }
  });
});

describe("weapon-family coverage", () => {
  const present = new Set(TOWERS.map((t) => t.meta!.weapon.family));
  it("every previously-empty ranged/magic family now has a tower", () => {
    for (const fam of [
      "bow",
      "crossbow",
      "gun",
      "thrown",
      "tome",
      "scepter",
      "wand",
      "orb",
    ] as WeaponFamily[]) {
      expect(present.has(fam), `no tower uses family ${fam}`).toBe(true);
    }
  });
  it("the new family-filling towers reach roughly their family band", () => {
    // Range is an identity stat — a few launch towers deliberately sit off-band
    // (e.g. an arm-cannon brawler that fights up close), so this guards only the
    // batch-C fillers, which exist precisely to read as true ranged/casters.
    for (const t of TOWERS_C) {
      const band = FAMILY[t.meta!.weapon.family].range;
      expect(
        Math.abs(t.baseStats.range - band) <= 60,
        `${t.id} range ${t.baseStats.range} vs band ${band}`,
      ).toBe(true);
    }
  });
});
