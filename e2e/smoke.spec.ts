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
    const body = (await res.json()) as { checks?: { database?: string } };
    expect(body.checks?.database).toBe("ok");
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
    const sendBtn = page.getByRole("link", { name: /send a package/i });
    const carryBtn = page.getByRole("link", { name: /carry a package/i });
    await expect(sendBtn).toBeVisible();
    await expect(carryBtn).toBeVisible();
  });

  test("/send and /carry are public intent screens", async ({ page }) => {
    await page.goto("/send");
    await expect(page.getByRole("button", { name: /continue to sign in/i })).toBeVisible();
    await page.goto("/carry");
    await expect(page.getByRole("button", { name: /continue to publish trip/i })).toBeVisible();
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
