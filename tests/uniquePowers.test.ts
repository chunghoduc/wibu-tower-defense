import { describe, it, expect } from "vitest";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { uniquePowerFor, UNIQUE_POWERS, SIGNATURE_POWERS } from "../src/data/uniquePowers.ts";

const uniques = ITEM_CATALOG.filter((d) => d.rarity === "Unique");
const nonUniques = ITEM_CATALOG.filter((d) => d.rarity !== "Unique");

describe("uniquePowerFor", () => {
  it("there are Unique items to cover", () => {
    expect(uniques.length).toBeGreaterThan(5);
  });

  it("assigns exactly one power to EVERY Unique item", () => {
    for (const def of uniques) {
      const power = uniquePowerFor(def);
      expect(power, `Unique ${def.id} must have a power`).not.toBeNull();
      expect(power!.id).toBeTruthy();
      expect(power!.name).toBeTruthy();
    }
  });

  it("returns null for every non-Unique item", () => {
    for (const def of nonUniques) {
      expect(uniquePowerFor(def), `${def.rarity} ${def.id} must NOT have a power`).toBeNull();
    }
  });

  it("maps the hand-authored signature items to their named powers", () => {
    expect(uniquePowerFor(ITEM_CATALOG.find((d) => d.id === "dawnbreaker")!)!.id).toBe("sunflare");
    expect(uniquePowerFor(ITEM_CATALOG.find((d) => d.id === "aegis-of-dawn")!)!.id).toBe("bulwark");
    expect(uniquePowerFor(ITEM_CATALOG.find((d) => d.id === "midas-paw")!)!.id).toBe("midas");
  });

  it("is deterministic — same def resolves to the same power", () => {
    for (const def of uniques) {
      expect(uniquePowerFor(def)!.id).toBe(uniquePowerFor(def)!.id);
    }
  });

  it("only ever returns powers from the catalog", () => {
    for (const def of uniques) {
      expect(UNIQUE_POWERS[uniquePowerFor(def)!.id]).toBeDefined();
    }
  });

  it("every signature target exists in the catalog and is Unique", () => {
    for (const itemId of Object.keys(SIGNATURE_POWERS)) {
      const def = ITEM_CATALOG.find((d) => d.id === itemId);
      expect(def, `signature target ${itemId}`).toBeDefined();
      expect(def!.rarity).toBe("Unique");
    }
  });
});

describe("power contributions", () => {
  it("every catalog power contributes a positive stat bucket", () => {
    for (const power of Object.values(UNIQUE_POWERS)) {
      const c = power.contribution({ uniqueCount: 1 });
      const all = { ...c.flat, ...c.increased, ...c.more };
      const vals = Object.values(all).filter((v): v is number => typeof v === "number");
      // A power is the stat "affix" half — it must contribute a positive bucket
      // (the BEHAVIOUR half lives in data/uniqueTriggers.ts).
      expect(vals.length, `${power.id} must contribute a stat`).toBeGreaterThan(0);
      expect(
        vals.every((v) => v > 0),
        `${power.id} contributions positive`,
      ).toBe(true);
    }
  });

  it("warlord scales its more-attack with the number of equipped uniques", () => {
    const w = UNIQUE_POWERS["warlord"];
    const one = w.contribution({ uniqueCount: 1 }).more!.atk!;
    const three = w.contribution({ uniqueCount: 3 }).more!.atk!;
    expect(three).toBeGreaterThan(one);
    expect(three).toBeCloseTo(one * 3, 5);
  });

  it("describe() embeds the magnitude and reflects context", () => {
    const w = UNIQUE_POWERS["warlord"];
    expect(w.describe({ uniqueCount: 1 })).toMatch(/%/);
    // a count-scaled power's description changes with context
    expect(w.describe({ uniqueCount: 3 })).not.toBe(w.describe({ uniqueCount: 1 }));
  });

  it("bloodthirst grants omnivamp — a stat no item affix rolls", () => {
    expect(
      UNIQUE_POWERS["bloodthirst"].contribution({ uniqueCount: 1 }).flat!.omnivamp,
    ).toBeGreaterThan(0);
  });
});

describe("per-instance procedural powers", () => {
  const proc = (instanceId?: string) =>
    uniquePowerFor(
      { id: "proc-phys-unique", rarity: "Unique", primaryAffix: { type: "atk" } },
      instanceId,
    );

  it("is deterministic for a given instance id", () => {
    expect(proc("copyA")?.id).toBe(proc("copyA")?.id);
  });

  it("different copies of the same def can roll different powers", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) ids.add(proc(`copy-${i}`)!.id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it("a signature item ignores the instance id (fixed identity)", () => {
    const a = uniquePowerFor(
      { id: "dawnbreaker", rarity: "Unique", primaryAffix: { type: "atk" } },
      "x",
    );
    const b = uniquePowerFor(
      { id: "dawnbreaker", rarity: "Unique", primaryAffix: { type: "atk" } },
      "y",
    );
    expect(a?.id).toBe("sunflare");
    expect(b?.id).toBe("sunflare");
  });
});
