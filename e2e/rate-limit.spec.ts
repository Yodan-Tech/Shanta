import { test, expect } from "@playwright/test";

/**
 * Rate limiting smoke — verifies that /api/v1/kyc/submit has rate limiting wired.
 * We can only do a light check (first request is not 429) in a clean environment;
 * the actual limit is tested in the proxy middleware unit tests.
 *
 * NOTE: This test does not exhaust the rate limit to avoid flakiness across
 * parallel CI runs sharing an IP. It is a structural check only.
 */

test.describe("Rate limiting", () => {
  test("kyc/submit with no auth returns 401 (not 429 on first hit)", async ({
    request,
  }) => {
    // First request — should be allowed past the rate limiter and hit auth check
    const res = await request.post("/api/v1/kyc/submit");
    // Could be 401 (no auth) or 400 (bad form) — either is fine; NOT 429
    expect(res.status()).not.toBe(429);
    expect([400, 401, 415, 422]).toContain(res.status());
  });
});
