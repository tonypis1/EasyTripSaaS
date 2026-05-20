import type { BrowserContextOptions } from "@playwright/test";
import { localeContextHeaders } from "./vercel-bypass";

export function previewBaseURL(): string {
  return (
    process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
  );
}

/** Context isolato per Accept-Language (non eredita `use` da playwright.config). */
export function localeBrowserContextOptions(
  acceptLanguage: string,
  overrides?: BrowserContextOptions,
): BrowserContextOptions {
  return {
    baseURL: previewBaseURL(),
    extraHTTPHeaders: localeContextHeaders(acceptLanguage),
    ...overrides,
  };
}
