import { describe, it, expect } from "vitest";
import { essence, buildLoadingPrompt } from "../scripts/sdart/loadingPrompt.mjs";

describe("essence", () => {
  it("keeps the first two comma clauses of a descriptor", () => {
    const d =
      "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance, glowing golden ki around fists";
    expect(essence(d)).toBe(
      "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance",
    );
  });
  it("returns a short descriptor unchanged", () => {
    expect(essence("a simple straight iron longsword")).toBe("a simple straight iron longsword");
  });
});

describe("buildLoadingPrompt", () => {
  const heroes = [
    "a cheerful spiky black-haired martial artist in an orange gi, glowing golden ki",
    "a dramatic crimson mage girl with a large pointed witch hat, raising an ornate glowing staff",
    "a determined young archer princess with long bright red hair, drawing a slender hunting bow",
  ];
  const boss =
    "a vengeful pale ash-skinned warrior with twin chained blades wreathed in roaring fire, flying embers";
  const { prompt, negative } = buildLoadingPrompt({ heroes, boss });

  it("weaves every hero essence into the prompt", () => {
    for (const h of heroes) expect(prompt).toContain(essence(h));
  });
  it("includes the boss and looming framing", () => {
    expect(prompt).toContain(essence(boss));
    expect(prompt.toLowerCase()).toMatch(/loom|towering|behind/);
  });
  it("frames it as an anime battlefield key-art scene", () => {
    expect(prompt.toLowerCase()).toContain("anime");
    expect(prompt.toLowerCase()).toMatch(/key art|splash|poster|battlefield/);
  });
  it("negative bans the isolated-on-white sprite framing", () => {
    expect(negative.toLowerCase()).toContain("white background");
    expect(negative.toLowerCase()).toMatch(/isolated|single character|sprite/);
  });
});
