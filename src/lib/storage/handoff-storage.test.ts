import { describe, it, expect } from "vitest";
import { sniffImageMime } from "./handoff-storage";

const bytes = (...b: number[]) => Uint8Array.from(b);
const pad = (head: number[], len = 16) =>
  Uint8Array.from([...head, ...new Array(Math.max(0, len - head.length)).fill(0)]);

describe("sniffImageMime — magic-byte image validation (Constraint 2.2 upload boundary)", () => {
  it("accepts a JPEG (FF D8 FF)", () => {
    expect(sniffImageMime(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("accepts a PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(sniffImageMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
  });

  it("accepts a WebP (RIFF....WEBP)", () => {
    expect(
      sniffImageMime(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp");
  });

  it("rejects a PDF", () => {
    expect(sniffImageMime(pad([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
  });

  it("rejects a renamed script / arbitrary text", () => {
    expect(sniffImageMime(pad([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]))).toBeNull(); // #!/bin
  });

  it("rejects a too-short buffer", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8))).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(sniffImageMime(bytes())).toBeNull();
  });
});
