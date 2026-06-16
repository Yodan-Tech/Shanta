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

  test("shows invalid link message for a malformed token", async ({ page }) => {
    await page.goto("/confirm?token=not-a-real-token");
    // The page renders initially then calls the API which returns 401
    // After which the error state is shown
    await expect(
      page.getByText(/invalid or has expired|something went wrong/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("confirmation page is mobile-friendly", async ({ page }) => {
    // Pixel 5 viewport (375x667) - already set in playwright.config mobile project
    await page.goto("/confirm");
    // Content should be visible without horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });
});
