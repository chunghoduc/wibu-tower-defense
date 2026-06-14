import { describe, expect, it } from "vitest";
import { wingCraftResultView } from "../src/core/wingCraftResultView.ts";
import { itemInstanceIcon } from "../src/data/rewardIcon.ts";
import type { CraftWingsResult } from "../src/core/wingCraft.ts";
import type { ItemInstanceSave } from "../src/core/save.ts";

// A minted Common skywings (worn-skywings exists in the catalog).
function wing(over: Partial<ItemInstanceSave> = {}): ItemInstanceSave {
  return {
    id: "w1",
    defId: "worn-skywings",
    acquiredLevel: 1,
    rolledStats: { maxHp: 40 },
    rolledPrimaryAffix: 5,
    rolledAffixes: [],
    enhanceLevel: 0,
    ...over,
  };
}

describe("wingCraftResultView", () => {
  it("maps a successful craft to a success VM with name, rarity, color and stat rows", () => {
    const result: CraftWingsResult = { ok: true, success: true, rarity: "Common", item: wing() };
    const vm = wingCraftResultView(result);
    expect(vm.kind).toBe("success");
    if (vm.kind !== "success") throw new Error("expected success");
    expect(vm.name.length).toBeGreaterThan(0);
    expect(vm.rarity).toBe("Common");
    expect(typeof vm.color).toBe("number");
    expect(vm.statRows.length).toBeGreaterThan(0);
  });

  it("agrees with itemInstanceIcon for the same item (single source of truth)", () => {
    const item = wing();
    const vm = wingCraftResultView({ ok: true, success: true, rarity: "Common", item });
    if (vm.kind !== "success") throw new Error("expected success");
    const icon = itemInstanceIcon(item);
    expect(vm.iconKey).toBe(icon.iconKey);
    expect(vm.emoji).toBe(icon.emoji);
    expect(vm.color).toBe(icon.color);
  });

  it("maps a rolled failure to a failure VM", () => {
    const vm = wingCraftResultView({ ok: true, success: false });
    expect(vm.kind).toBe("failure");
  });

  it("degrades a malformed success (no item) to failure without throwing", () => {
    const vm = wingCraftResultView({ ok: true, success: true, rarity: "Common" });
    expect(vm.kind).toBe("failure");
  });

  it("degrades a success whose def is missing from the catalog to failure", () => {
    const vm = wingCraftResultView({
      ok: true,
      success: true,
      rarity: "Common",
      item: wing({ defId: "no-such-def" }),
    });
    expect(vm.kind).toBe("failure");
  });
});
