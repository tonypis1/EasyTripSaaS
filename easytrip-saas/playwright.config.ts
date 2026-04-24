import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * In CI (GitHub Actions) non c’è `.env`: `next dev` deve comunque soddisfare
 * `unifiedConfig` (zod) altrimenti l’import della home/DI lancia e il webServer
 * non diventa pronto. Valori fittizi — non chiamate reali a servizi a pagamento
 * nei test @smoke guest; in locale Next carica ancora `.env` e vince su questi.
 */
const devServerEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/e2e_smoke_ci",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    "pk_test_e2e_smoke_placeholder",
  CLERK_SECRET_KEY:
    process.env.CLERK_SECRET_KEY ??
    "sk_test_e2e_smoke_placeholder_min_32________",
  STRIPE_SECRET_KEY:
    process.env.STRIPE_SECRET_KEY ?? "sk_test_e2e_smoke_placeholder_32ch______",
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET ??
    "whsec_e2e_smoke_ci_placeholder_32b___",
  ANTHROPIC_API_KEY:
    process.env.ANTHROPIC_API_KEY ??
    "sk-ant-api03-e2e-smoke-not-used-0000000000000000",
} satisfies NodeJS.ProcessEnv;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    locale: "it-IT",
    extraHTTPHeaders: {
      "Accept-Language": "it-IT,it;q=0.9",
    },
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        env: devServerEnv,
        reuseExistingServer: true,
        timeout: 120000,
      },
  projects: [
    {
      name: "chromium",
      testIgnore: [/visual\//],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
});
