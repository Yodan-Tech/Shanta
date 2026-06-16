import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyHmacSignature } from "./webhook";

const SECRET = "provider-secret";
const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("hex");

describe("verifyHmacSignature", () => {
  it("accepts a correct signature", () => {
    const body = '{"event":"delivered","id":"abc"}';
    expect(verifyHmacSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("accepts a prefixed signature (sha256=...)", () => {
    const body = "payload";
    expect(verifyHmacSignature(body, `sha256=${sign(body)}`, SECRET)).toBe(true);
  });

  it("rejects a wrong signature, secret, or empty signature", () => {
    const body = "payload";
    expect(verifyHmacSignature(body, sign("other"), SECRET)).toBe(false);
    expect(verifyHmacSignature(body, sign(body), "wrong-secret")).toBe(false);
    expect(verifyHmacSignature(body, "", SECRET)).toBe(false);
  });
});
