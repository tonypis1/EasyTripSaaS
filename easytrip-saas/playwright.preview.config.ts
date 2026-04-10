import { defineConfig } from "@playwright/test";
import root from "./playwright.config";

/**
 * E2E contro URL Vercel Preview (nessun webServer locale).
 * Uso: `E2E_BASE_URL=https://xxx.vercel.app npx playwright test -c playwright.preview.config.ts`
 */
export default defineConfig({
  ...root,
  webServer: undefined,
  use: {
    ...root.use,
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
  },
});
