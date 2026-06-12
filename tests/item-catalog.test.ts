import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, ITEM_CATALOG_MAP, rollItem } from "../src/data/items.ts";
import { ITEM_SLOTS, WEAPON_TYPES } from "../src/data/schema.ts";

describe("crit stats stay reasonable", () => {
  it("crit base stats do NOT balloon with item level (fractional, level-independent)", () => {
    const ring = ITEM_CATALOG.find((d) => d.id === "mythic-precision-ring")!;
    let max = 0;
    for (let s = 1; s <= 200; s++)
      max = Math.max(max, rollItem(ring, 60, s).rolledStats.critRate ?? 0);
    expect(max).toBeLessThan(0.12); // base alone never near a level-scaled 0.5+
  });

  it("no single item rolls more than ~30% total crit chance", () => {
    let max = 0;
    for (const d of ITEM_CATALOG) {
      const hasCrit =
        (d.baseStats.critRate ?? 0) > 0 ||
        d.primaryAffix.type === "critRate" ||
        d.affixPool.includes("critRate");
      if (!hasCrit) continue;
      for (let s = 1; s <= 120; s++) {
        const inst = rollItem(d, 60, s);
        let cr = inst.rolledStats.critRate ?? 0;
        if (d.primaryAffix.type === "critRate") cr += inst.rolledPrimaryAffix;
        for (const a of inst.rolledAffixes) if (a.type === "critRate") cr += a.value;
        max = Math.max(max, cr);
      }
    }
    expect(max).toBeLessThan(0.3);
  });

  it("each critRate affix rolls within its capped range", () => {
    const ring = ITEM_CATALOG.find((d) => d.id === "mythic-precision-ring")!;
    for (let s = 1; s <= 200; s++) {
      for (const a of rollItem(ring, 60, s).rolledAffixes) {
        if (a.type === "critRate") {
          expect(a.value).toBeGreaterThanOrEqual(0.02);
          expect(a.value).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });
});

describe("expanded item catalog (T10)", () => {
  it("has at least 349 items (19 base + 130 generated + 200 expansion)", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(349);
  });

  it("all item ids are unique", () => {
    const ids = ITEM_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers many distinct primary affix types", () => {
    const types = new Set(ITEM_CATALOG.map((d) => d.primaryAffix.type));
    expect(types.size).toBeGreaterThanOrEqual(12);
  });

  it("covers every equipment slot", () => {
    const slots = new Set(ITEM_CATALOG.map((d) => d.slot));
    for (const s of ITEM_SLOTS) {
      if (s === "Ring1" || s === "Ring2") continue; // rings split across both
      expect(slots.has(s), s).toBe(true);
    }
  });

  it("every weapon has a valid weaponType and every item a positive primary value", () => {
    for (const d of ITEM_CATALOG) {
      if (d.slot === "Weapon") expect(WEAPON_TYPES.includes(d.weaponType!), d.id).toBe(true);
      expect(d.primaryAffix.baseValue, d.id).toBeGreaterThan(0);
      expect(d.requiredLevel).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("loot expansion batch", () => {
  // Hand-crafted signature pieces + one variant from each new generated line.
  const NEW_IDS = [
    "dawnbreaker",
    "void-render",
    "aegis-of-dawn",
    "seers-eye",
    "midas-paw",
    "worn-frost-glaive",
    "mythic-frost-glaive",
    "worn-venom-fang",
    "mythic-bulwark-plate",
    "worn-oracle-crown",
    "worn-shadowstep-treads",
    "worn-duelist-band",
  ];

  it("adds the new signature and generated loot to the catalog", () => {
    for (const id of NEW_IDS) {
      expect(ITEM_CATALOG_MAP.has(id), id).toBe(true);
    }
  });

  it("introduces hand-crafted Unique-rarity loot (not just generated Mythics)", () => {
    const handcraftedUniques = ITEM_CATALOG.filter(
      (d) => d.rarity === "Unique" && !d.id.startsWith("mythic-"),
    );
    expect(handcraftedUniques.length).toBeGreaterThanOrEqual(2);
  });

  it("every new generated line spans all 5 rarities", () => {
    for (const line of [
      "frost-glaive",
      "venom-fang",
      "bulwark-plate",
      "oracle-crown",
      "shadowstep-treads",
      "duelist-band",
    ]) {
      for (const prefix of ["worn", "fine", "masterwork", "heroic", "mythic"]) {
        expect(ITEM_CATALOG_MAP.has(`${prefix}-${line}`), `${prefix}-${line}`).toBe(true);
      }
    }
  });
});

describe("200-item homage expansion", () => {
  // The 40 expansion line ids (itemsExpansion.ts) → 40 × 5 = 200 items.
  const EXPANSION_LINES = [
    "kingsworn-brand",
    "moonlit-greatblade",
    "rimewill-runeblade",
    "busterfell-cleaver",
    "emberlight-saber",
    "galewind-longbow",
    "dawnsong-bow",
    "peacekeeper-revolver",
    "starhunter-cannon",
    "eldwood-wand",
    "dreadpage-codex",
    "titangrip-knuckles",
    "mithrilweave-shirt",
    "beskar-plate",
    "havelthane-plate",
    "dragonscale-mail",
    "sentinel-bulwark",
    "ribbon-circlet",
    "hadeshood-cowl",
    "valor-greathelm",
    "seerlight-circlet",
    "titanhold-gauntlets",
    "trickster-grips",
    "mistwalk-treads",
    "valkyrie-pinions",
    "phoenix-pinions",
    "juggernaut-signet",
    "archmage-loop",
    "bulwark-band",
    "wayfarer-ring",
    "warpriest-talisman",
    "archon-amulet",
    "wardstone-amulet",
    "midas-locket",
    "heartforge-pendant",
    "direwolf-cub",
    "arcane-wisp",
    "iron-sentinel-chibi",
    "lucky-tanuki",
    "emberfox-kit",
  ];

  it("adds exactly 40 lines = 200 items, each spanning all 5 rarities", () => {
    expect(EXPANSION_LINES.length).toBe(40);
    for (const line of EXPANSION_LINES) {
      for (const prefix of ["worn", "fine", "masterwork", "heroic", "mythic"]) {
        expect(ITEM_CATALOG_MAP.has(`${prefix}-${line}`), `${prefix}-${line}`).toBe(true);
      }
    }
  });

  it("every expansion item carries a homage name, archetype, and lore", () => {
    for (const line of EXPANSION_LINES) {
      const mythic = ITEM_CATALOG_MAP.get(`mythic-${line}`)!;
      expect(mythic.archetype, line).toBeDefined();
      expect(mythic.lore, line).toBeTruthy();
      // Name is the bare homage base (no rarity prefix), never a raw lineId.
      expect(mythic.name, line).not.toContain(line);
    }
  });
});

describe("lean item names (no rarity-prefix adjective)", () => {
  const RARITY_WORDS = ["Worn", "Fine", "Masterwork", "Heroic", "Mythic"];
  const LINE_IDS = [
    "kingsworn-brand",
    "galewind-longbow",
    "mithrilweave-shirt",
    "warblade",
    "longbow",
    "platemail",
  ];

  it("a generated line shows the same bare base name across all five tiers", () => {
    for (const line of LINE_IDS) {
      const names = ["worn", "fine", "masterwork", "heroic", "mythic"].map(
        (p) => ITEM_CATALOG_MAP.get(`${p}-${line}`)!.name,
      );
      // identical across tiers
      expect(new Set(names).size, `${line} names: ${names.join(" | ")}`).toBe(1);
      // and free of any rarity-prefix word
      for (const n of names) {
        for (const w of RARITY_WORDS) {
          expect(n.startsWith(w + " "), `${line} -> "${n}"`).toBe(false);
        }
      }
    }
  });

  it("no generated-line catalog item name starts with a rarity-prefix word", () => {
    for (const def of ITEM_CATALOG) {
      const dash = def.id.indexOf("-");
      const idPrefix = dash > 0 ? def.id.slice(0, dash) : "";
      if (!["worn", "fine", "masterwork", "heroic", "mythic"].includes(idPrefix)) continue;
      for (const w of RARITY_WORDS) {
        expect(def.name.startsWith(w + " "), `${def.id} -> "${def.name}"`).toBe(false);
      }
    }
  });
});
