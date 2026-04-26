import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * In CI (GitHub Actions) non c’è `.env`: `next dev` deve comunque soddisfare
 * `unifiedConfig` (zod) altrimenti l’import della home/DI lancia e il webServer
 * non diventa pronto.
 *
 * - Clerk: la publishable key **non** può essere inventata; va da Clerk
 *   (test) e in CI va passata con GitHub Actions secrets → env dello step
 *   E2E (vedi `main.yml`, `13_CICD_SECRETS_AND_DNS.md`).
 * - Altri: fallback solo se `unifiedConfig` le richiede; Stripe/Anthropic
 *   non vengono validati come Clerk all’avvio; in locale Next legge ancora
 *   `.env` e sovrascrive nel processo `next dev`.
 */
function firstNonEmpty(
  name: keyof NodeJS.ProcessEnv,
  fallback: string,
): string {
  const v = process.env[name];
  return v != null && v.trim() !== "" ? v : fallback;
}

const devServerEnv = {
  ...process.env,
  DATABASE_URL: firstNonEmpty(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:5432/e2e_smoke_ci",
  ),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: firstNonEmpty(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "pk_test_e2e_smoke_local_without_env",
  ),
  CLERK_SECRET_KEY: firstNonEmpty(
    "CLERK_SECRET_KEY",
    "sk_test_e2e_smoke_local_without_env_32b_________",
  ),
  STRIPE_SECRET_KEY: firstNonEmpty(
    "STRIPE_SECRET_KEY",
    "sk_test_e2e_smoke_placeholder_32ch______",
  ),
  STRIPE_WEBHOOK_SECRET: firstNonEmpty(
    "STRIPE_WEBHOOK_SECRET",
    "whsec_e2e_smoke_ci_placeholder_32b___",
  ),
  ANTHROPIC_API_KEY: firstNonEmpty(
    "ANTHROPIC_API_KEY",
    "sk-ant-api03-e2e-smoke-not-used-0000000000000000",
  ),
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
