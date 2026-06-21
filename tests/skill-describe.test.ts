import { describe, expect, it } from "vitest";
import { activeSkillDetail, roleEffectDetail } from "../src/data/skillDescribe.ts";
import { TOWERS } from "../src/data/towers.ts";
import { activeBurst } from "../src/core/activeDamage.ts";

const byId = (id: string) => TOWERS.find((t) => t.id === id)!;

describe("skillDescribe", () => {
  it("active burst matches the shared activeBurst formula with the right damage type", () => {
    const t = byId("karu-sunfist"); // activeType True
    const detail = activeSkillDetail(t, t.baseStats);
    const burst = Math.round(
      activeBurst({
        atk: t.baseStats.atk,
        skillPower: t.baseStats.skillPower,
        powerMult: 2, // towers cast at the legacy P = 2
        damageType: "True",
      }),
    );
    expect(detail).toContain(`${burst} True`);
    expect(detail).toContain("60px");
  });

  it("DoT role shows per-second + total", () => {
    const t = byId("shion-venom-priestess"); // dot 16/s for 4s
    expect(roleEffectDetail(t, t.baseStats)).toContain("16/s");
    expect(roleEffectDetail(t, t.baseStats)).toContain("64 total");
  });

  it("debuff role shows slow on hit; stun lives on the active skill", () => {
    const t = byId("yuki-frostward-maiden"); // slow 50% 3s on hit, stun 0.6s via skill
    const d = roleEffectDetail(t, t.baseStats)!;
    expect(d).toContain("slow 50% for 3s");
    // Stun is no longer an on-hit proc — it's the single-target active skill.
    expect(d).not.toContain("stun");
    expect(activeSkillDetail(t, t.baseStats)).toContain("Stuns its single target for 0.6s");
  });

  it("support role shows aura values", () => {
    const t = byId("senna-slug-sannin");
    expect(roleEffectDetail(t, t.baseStats)).toContain("+25% atk");
  });

  it("a MAGIC active's burst scales up with skill power (spell power applies)", () => {
    const t = byId("shion-venom-priestess"); // Magic active
    const boosted = activeSkillDetail(t, {
      ...t.baseStats,
      skillPower: t.baseStats.skillPower * 2,
    });
    const base = activeSkillDetail(t, t.baseStats);
    expect(base).not.toBe(boosted); // higher spell power → bigger burst number
    expect(base).toContain("spell power"); // and the line states the multiplier
  });

  it("a PHYSICAL active ignores skill power (spell power cannot multiply it)", () => {
    const t = byId("zoran-thricedraw"); // Physical active
    const base = activeSkillDetail(t, t.baseStats);
    const boosted = activeSkillDetail(t, {
      ...t.baseStats,
      skillPower: t.baseStats.skillPower * 3,
    });
    expect(base).toBe(boosted); // tripling spell power changes nothing
    expect(base).toContain("spell power N/A");
  });
});
