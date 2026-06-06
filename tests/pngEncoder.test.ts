import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "../src/art/pngEncoder.ts";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 2x1 image: red opaque, green opaque
function sampleRgba(): Uint8Array {
  return Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255]);
}

describe("encodePng", () => {
  it("starts with the PNG signature", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    expect(Array.from(png.slice(0, 8))).toEqual(SIG);
  });

  it("encodes width and height in the IHDR chunk", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(2); // width
    expect(view.getUint32(20)).toBe(1); // height
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // color type RGBA
  });

  it("IDAT inflates back to filtered scanlines (filter 0 + pixels)", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    let idatStart = -1;
    for (let i = 0; i < png.length - 4; i++) {
      if (png[i] === 0x49 && png[i + 1] === 0x44 && png[i + 2] === 0x41 && png[i + 3] === 0x54) {
        idatStart = i + 4;
        break;
      }
    }
    expect(idatStart).toBeGreaterThan(0);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const lenView = view.getUint32(idatStart - 8);
    const idat = png.slice(idatStart, idatStart + lenView);
    const raw = inflateSync(Buffer.from(idat));
    expect(raw[0]).toBe(0);
    expect(Array.from(raw.slice(1))).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });
});
