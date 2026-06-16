import { test, expect } from "@playwright/test";

/**
 * Receiver delivery confirmation page — no-login flow via SMS token.
 * Tests the public /confirm page UI states.
 */

test.describe("Receiver confirmation page (/confirm)", () => {
  test("shows invalid link message when no token is present", async ({ page }) => {
    await page.goto("/confirm");
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test("shows confirmation button when token param is present (idle state)", async ({
    page,
  }) => {
    await page.goto("/confirm?token=not-a-real-token");
    // Page starts with a delivery confirmation button (exact label depends on UI version)
    await expect(
      page.getByRole("button", { name: /confirm delivery|yes.*received|received it/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("confirmation page is mobile-friendly", async ({ page }) => {
    await page.goto("/confirm");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
