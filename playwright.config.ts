import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Shanta. Two test suites:
 *   - e2e/ — full user journeys (requires a running dev server)
 *   - e2e/smoke.spec.ts — fast API health checks (runs in CI post-deploy)
 *
 * Env: PLAYWRIGHT_BASE_URL overrides the default for CI/staging smoke.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // serial: tests share DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: ["**/smoke.spec.ts", "**/confirm.spec.ts"],
    },
  ],
  // When PLAYWRIGHT_BASE_URL is set (CI smoke step starts app manually, staging
  // runs against a deployed URL), skip the webServer — the server is already up.
  // Without it, Playwright auto-starts `pnpm dev` for local development.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
