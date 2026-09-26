import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

/**
 * Config Playwright dedicata al test E2E "acquisto piano Pro"
 * (tests/auth.setup.ts + tests/checkoutFlow.spec.ts).
 *
 * È volutamente separata da `playwright.config.ts` (la suite CI in
 * tests/e2e/**) per due motivi:
 *  1. Questo flusso è lungo (AI + Stripe + Inngest + più acquisti), gira in
 *     modalità visibile (`headless: false`) e non deve essere eseguito ad
 *     ogni push in CI insieme alla suite rapida esistente.
 *  2. Usa una cartella di storage state diversa (`playwright/.auth/`)
 *     rispetto a quella già usata da `screenshots:clerk-session`
 *     (`e2e/.auth/`), per non sovrascriverla.
 *
 * Come Next.js: `.env` base, `.env.local` sovrascrive.
 */
loadEnv({ path: path.join(process.cwd(), ".env") });
loadEnv({ path: path.join(process.cwd(), ".env.local"), override: true });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["auth.setup.ts", "checkoutFlow.spec.ts"],
  // `testMatch` fa match "contains", non solo sul nome file esatto: senza
  // questo esclude esplicitamente tests/e2e/presentation-auth.setup.ts
  // (altra suite CI), che altrimenti finirebbe anche lui nel progetto "setup"
  // perché il suo nome file TERMINA con "auth.setup.ts".
  testIgnore: /tests[\\/]e2e[\\/]/,
  /**
   * Il flusso copre generazione AI (1-2 min), più rigenerazioni, più
   * checkout Stripe e l'onboarding di un secondo utente: serve un timeout
   * per-test generoso.
   */
  timeout: 20 * 60 * 1000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "playwright-report-purchase-flow" },
    ],
  ],
  use: {
    baseURL,
    locale: "it-IT",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "purchase-flow",
      testMatch: /checkoutFlow\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
      },
    },
  ],
});
