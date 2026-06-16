import { test, expect } from "@playwright/test";

/**
 * Cron route security — all 4 cron routes must reject requests without the
 * Bearer CRON_SECRET header. This is a regression guard.
 */

const CRON_ROUTES = [
  "/api/v1/cron/drain-notifications",
  "/api/v1/cron/check-stuck-shipments",
  "/api/v1/cron/escrow-timeout",
  "/api/v1/cron/frequency-report",
];

test.describe("Cron route security", () => {
  for (const route of CRON_ROUTES) {
    test(`${route} — 403 without Authorization header`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(403);
    });

    test(`${route} — 403 with wrong secret`, async ({ request }) => {
      const res = await request.get(route, {
        headers: { Authorization: "Bearer definitely-wrong" },
      });
      expect(res.status()).toBe(403);
    });
  }
});
