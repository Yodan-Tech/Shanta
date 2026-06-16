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

  test("shows confirmation buttons when token param is present (idle state)", async ({
    page,
  }) => {
    await page.goto("/confirm?token=not-a-real-token");
    // Page starts idle (token present) — shows action buttons before any API call
    await expect(
      page.getByRole("button", { name: /yes, i received it/i }),
    ).toBeVisible();
    await expect(page.getByText(/report a problem/i)).toBeVisible();
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
