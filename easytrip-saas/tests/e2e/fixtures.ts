import { test as base } from "@playwright/test";
import { CONSENT_STORAGE_KEY } from "../../src/lib/analytics/consent";

/**
 * `test` con la scelta sui cookie di analisi già fatta ("denied" di default),
 * così il banner non copre la pagina in test che cliccano o fotografano.
 * I test del banner usano `@playwright/test` direttamente, o
 * `test.use({ cookieChoice: null })` per una prima visita.
 */
export const test = base.extend<{ cookieChoice: "granted" | "denied" | null }>({
  cookieChoice: ["denied", { option: true }],
  page: async ({ page, cookieChoice }, provide) => {
    if (cookieChoice) {
      await page.addInitScript(
        ([key, value]) => {
          try {
            window.localStorage.setItem(
              key,
              JSON.stringify({ value, at: Date.now() }),
            );
          } catch {
            /* storage non disponibile: il banner resta, il test lo vedrà */
          }
        },
        [CONSENT_STORAGE_KEY, cookieChoice] as const,
      );
    }
    await provide(page);
  },
});

export { expect } from "@playwright/test";
