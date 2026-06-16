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
  test("kyc/submit first request is allowed past the rate limiter (not 429)", async ({
    request,
  }) => {
    // First request passes the rate limiter and hits the auth/route layer.
    // In CI, Supabase uses dummy creds so the response may be 4xx or 5xx —
    // any of those is acceptable. The only forbidden response is 429.
    const res = await request.post("/api/v1/kyc/submit");
    expect(res.status()).not.toBe(429);
  });
});
