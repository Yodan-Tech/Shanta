import { test, expect } from "@playwright/test";

/**
 * Smoke tests — run post-deploy against any environment.
 * Fast, stateless, no authentication required.
 * PLAYWRIGHT_BASE_URL controls the target (default: http://localhost:3000).
 */

test.describe("Health + public API", () => {
  test("GET /api/v1/health returns 200 with database ok", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { database?: string } };
    expect(body.data?.database).toBe("ok");
  });

  test("POST /api/v1/cron/* without secret returns 403", async ({ request }) => {
    const res = await request.get("/api/v1/cron/drain-notifications");
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/cron/* with wrong secret returns 403", async ({ request }) => {
    const res = await request.get("/api/v1/cron/drain-notifications", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/shipments unauthenticated returns 401", async ({ request }) => {
    const res = await request.post("/api/v1/shipments", {
      data: { test: true },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/admin/kpis unauthenticated returns 401 or 403", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/admin/kpis");
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("Public pages", () => {
  test("landing page loads with two action buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Shanta/i);
    // Two primary action buttons
    const sendBtn = page.getByRole("link", { name: /send a package/i });
    const travelBtn = page.getByRole("link", { name: /traveling with space/i });
    await expect(sendBtn).toBeVisible();
    await expect(travelBtn).toBeVisible();
    // Hub login link in footer
    await expect(page.getByRole("link", { name: /hub login/i })).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /shipments redirects to /login", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /admin redirects away from admin", async ({ page }) => {
    await page.goto("/admin");
    // Should redirect to login or admin-login, not show admin content
    await expect(page).not.toHaveURL("/admin");
  });

  test("/confirm with no token shows invalid link message", async ({ page }) => {
    await page.goto("/confirm");
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});
