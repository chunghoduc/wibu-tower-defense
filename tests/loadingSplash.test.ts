import { describe, it, expect } from "vitest";
import { loadingSplashBackground } from "../src/core/loadingSplash.ts";

describe("loadingSplashBackground", () => {
  const css = loadingSplashBackground("assets/bg/loading.png?v=2026-06-14c");

  it("embeds the url in a url(...) layer", () => {
    expect(css).toContain('url("assets/bg/loading.png?v=2026-06-14c")');
  });
  it("covers and centers the image", () => {
    expect(css).toContain("center");
    expect(css).toContain("cover");
    expect(css).toContain("no-repeat");
  });
  it("layers a dark readability gradient before the image", () => {
    expect(css.indexOf("linear-gradient")).toBeLessThan(css.indexOf("url("));
    expect(css).toMatch(/rgba\(\s*5\s*,\s*7\s*,\s*12/);
  });
  it("passes the url through verbatim (cache-bust query preserved)", () => {
    expect(loadingSplashBackground("a/b.png?v=X")).toContain('url("a/b.png?v=X")');
  });
});
