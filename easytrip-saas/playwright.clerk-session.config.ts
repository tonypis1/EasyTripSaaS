import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

if (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.CLERK_PUBLISHABLE_KEY
) {
  process.env.CLERK_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

/**
 * Genera `e2e/.auth/user.json` senza codegen né OAuth Google.
 * Richiede chiavi Clerk **test** (sk_test_ / pk_test_) e `E2E_CLERK_USER_EMAIL`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/presentation-auth.setup.ts",
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Firefox"],
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "off",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
