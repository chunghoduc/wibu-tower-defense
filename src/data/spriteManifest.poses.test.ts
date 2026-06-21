import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "./spriteManifest.ts";

describe("pose manifest entries", () => {
  const byKey = new Map(SPRITE_MANIFEST.map((e) => [e.key, e]));
  it("registers all 4 hero weapon poses as single 320 frames", () => {
    for (const fam of ["bow", "fist", "gun", "staff"]) {
      const e = byKey.get(`hero__${fam}`);
      expect(e, fam).toBeTruthy();
      expect(e!.frames).toBe(1);
      expect(e!.frameWidth).toBe(320);
      expect(e!.frameHeight).toBe(320);
      expect(e!.path).toBe(`assets/sprites/hero/hero__${fam}.png`);
    }
  });
  it("registers a __attack pose for akagan-ashen as a single 320 frame", () => {
    const e = byKey.get("tower__akagan-ashen__attack");
    expect(e).toBeTruthy();
    expect(e!.frames).toBe(1);
    expect(e!.path).toBe("assets/sprites/tower/akagan-ashen__attack.png");
  });
  it("registers exactly 52 tower attack poses", () => {
    const n = SPRITE_MANIFEST.filter(
      (e) => e.kind !== "herobattle" && e.key.endsWith("__attack"),
    ).length;
    expect(n).toBe(52);
  });
  it("registers a stance + attack art for every battle-hero weapon class", () => {
    for (const wt of ["sword", "bow", "staff", "gun", "tome", "fist", "any"]) {
      const stance = byKey.get(`herobattle__${wt}`);
      const attack = byKey.get(`herobattle__${wt}__attack`);
      expect(stance, wt).toBeTruthy();
      expect(attack, `${wt} attack`).toBeTruthy();
      expect(stance!.frames).toBe(1);
      expect(stance!.frameWidth).toBe(320);
      expect(attack!.path).toBe(`assets/sprites/herobattle/${wt}__attack.png`);
    }
  });
});
