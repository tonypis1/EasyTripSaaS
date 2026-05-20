import type { BrowserContextOptions } from "@playwright/test";
import { localeContextHeaders } from "./vercel-bypass";

export function previewBaseURL(): string {
  return (
    process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
  );
}

/** Prima lingua in `Accept-Language` → opzione Playwright `locale` (emula il browser). */
function localeFromAcceptLanguage(acceptLanguage: string): string {
  const first = acceptLanguage.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "en-US";
}

/**
 * Context isolato per test di auto-detection.
 * `playwright.config` imposta `locale: "it-IT"` e `Accept-Language: it-IT,...` su tutti i test;
 * un `newContext` le eredita e, senza override esplicito di `locale`, Chromium invia ancora italiano.
 */
export function localeBrowserContextOptions(
  acceptLanguage: string,
  overrides?: BrowserContextOptions,
): BrowserContextOptions {
  const locale = localeFromAcceptLanguage(acceptLanguage);
  return {
    baseURL: previewBaseURL(),
    locale,
    extraHTTPHeaders: localeContextHeaders(acceptLanguage),
    ...overrides,
  };
}
