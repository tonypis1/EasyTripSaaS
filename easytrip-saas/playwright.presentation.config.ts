import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), ".env.local"), override: true });

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
    // Allineato a `next dev` (Local: http://localhost:3000) per evitare mismatch cookie con 127.0.0.1.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
