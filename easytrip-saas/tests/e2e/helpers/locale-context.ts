import type { Browser, BrowserContextOptions } from "@playwright/test";
import {
  isVercelPreviewBaseUrl,
  localeContextHeaders,
  vercelProtectionBypassHeaders,
} from "./vercel-bypass";

export function previewBaseURL(): string {
  return (
    process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
  );
}

/**
 * Cookie di bypass Vercel: con `newContext()` isolato non esistono finché non si
 * visita almeno una pagina. Il context Playwright predefinito li ottiene dai test
 * landing precedenti; locale-detection no — da qui il fallimento solo su /de.
 */
export async function vercelPreviewBypassStorageState(
  browser: Browser,
): Promise<BrowserContextOptions["storageState"] | undefined> {
  if (!isVercelPreviewBaseUrl()) return undefined;
  if (!vercelProtectionBypassHeaders()["x-vercel-protection-bypass"]) {
    return undefined;
  }

  const ctx = await browser.newContext({
    baseURL: previewBaseURL(),
    extraHTTPHeaders: localeContextHeaders("en-US,en;q=0.9"),
  });
  const page = await ctx.newPage();
  await page.goto("/en", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  const state = await ctx.storageState();
  await ctx.close();

  return {
    cookies: state.cookies.filter((c) => c.name !== "NEXT_LOCALE"),
    origins: state.origins,
  };
}

/** Context isolato per Accept-Language (non eredita `use` da playwright.config). */
export function localeBrowserContextOptions(
  acceptLanguage: string,
  overrides?: BrowserContextOptions,
  previewBypass?: BrowserContextOptions["storageState"],
): BrowserContextOptions {
  return {
    baseURL: previewBaseURL(),
    extraHTTPHeaders: localeContextHeaders(acceptLanguage),
    ...(previewBypass ? { storageState: previewBypass } : {}),
    ...overrides,
  };
}
