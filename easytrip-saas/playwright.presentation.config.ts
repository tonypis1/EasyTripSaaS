import { defineConfig, devices } from "@playwright/test";

/**
 * Solo test screenshot per presentation.html.
 * Usa Firefox se Chromium headless shell non è installato (`npx playwright install`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /** Landing fullPage + Next dev possono superare i 120s su macchine lente. */
  timeout: 180_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  testMatch: "**/presentation-screenshots.spec.ts",
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "off",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
