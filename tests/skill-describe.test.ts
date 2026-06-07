import { describe, expect, it } from "vitest";
import { activeSkillDetail, roleEffectDetail } from "../src/data/skillDescribe.ts";
import { TOWERS } from "../src/data/towers.ts";

const byId = (id: string) => TOWERS.find((t) => t.id === id)!;

describe("skillDescribe", () => {
  it("active burst = atk x2 x skillPower with the right damage type", () => {
    const t = byId("karu-sunfist"); // activeType True
    const detail = activeSkillDetail(t, t.baseStats);
    const burst = Math.round(t.baseStats.atk * 2 * Math.max(1, t.baseStats.skillPower));
    expect(detail).toContain(`${burst} True`);
    expect(detail).toContain("60px");
  });

  it("DoT role shows per-second + total", () => {
    const t = byId("shion-venom-priestess"); // dot 16/s for 4s
    expect(roleEffectDetail(t, t.baseStats)).toContain("16/s");
    expect(roleEffectDetail(t, t.baseStats)).toContain("64 total");
  });

  it("debuff role shows slow % and stun", () => {
    const t = byId("yuki-frostward-maiden"); // slow 50% 3s, stun 0.6s 20%
    const d = roleEffectDetail(t, t.baseStats)!;
    expect(d).toContain("slow 50% for 3s");
    expect(d).toContain("stun 0.6s");
  });

  it("support role shows aura values", () => {
    const t = byId("senna-slug-sannin");
    expect(roleEffectDetail(t, t.baseStats)).toContain("+25% atk");
  });

  it("burst scales with skill power (stat-modified)", () => {
    const t = byId("shion-venom-priestess");
    const boosted = activeSkillDetail(t, { ...t.baseStats, skillPower: t.baseStats.skillPower * 2 });
    const base = activeSkillDetail(t, t.baseStats);
    expect(base).not.toBe(boosted); // higher skill power → bigger burst number
  });
});
