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
    // The confirm page renders an "Open Camera" button as the first CTA when
    // a token is present. Confirm Pickup appears separately (disabled) until
    // a photo is captured. Open Camera is the unique initial action button.
    await expect(
      page.getByRole("button", { name: /open camera/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("confirmation page is mobile-friendly", async ({ page }) => {
    await page.goto("/confirm");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
