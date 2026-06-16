import { describe, it, expect } from "vitest";
import { signDeliveryToken, verifyDeliveryToken } from "./token";

const SECRET = "test-secret-key";

describe("delivery confirmation token", () => {
  it("round-trips a valid token", () => {
    const t = signDeliveryToken("shp_1", SECRET);
    expect(verifyDeliveryToken(t, SECRET)).toEqual({ ok: true, shipmentId: "shp_1" });
  });

  it("rejects a tampered signature", () => {
    const t = signDeliveryToken("shp_1", SECRET);
    const forged = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
    expect(verifyDeliveryToken(forged, SECRET).ok).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const t = signDeliveryToken("shp_1", SECRET);
    expect(verifyDeliveryToken(t, "other-secret")).toMatchObject({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const t = signDeliveryToken("shp_1", SECRET, { ttlMs: 1000, now });
    expect(verifyDeliveryToken(t, SECRET, now + 2000)).toMatchObject({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("rejects a malformed token", () => {
    expect(verifyDeliveryToken("not-a-token", SECRET).ok).toBe(false);
    expect(verifyDeliveryToken("a.b.c", SECRET).ok).toBe(false);
  });
});
