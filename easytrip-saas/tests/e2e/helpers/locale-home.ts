import { expect, type Page } from "@playwright/test";

export function isVercelPreviewBaseUrl(): boolean {
  return /vercel\.app/i.test(process.env.E2E_BASE_URL ?? "");
}

/** Timeout più lungo su Preview Vercel (cold start + SSR). */
export function localeHomeAssertionTimeout(): number {
  return isVercelPreviewBaseUrl() ? 30_000 : 10_000;
}

export async function gotoHomePath(page: Page, path = "/"): Promise<void> {
  await page.goto(path, {
    waitUntil: isVercelPreviewBaseUrl() ? "domcontentloaded" : "load",
  });
}

/**
 * Home marketing (guest): verifica titolo hero e `lang` su <html>.
 * Usa `heading` + toContainText perché titleLine1/titleLine2 possono essere su nodi diversi.
 */
export async function expectGuestHomeInLocale(
  page: Page,
  titleMarker: string,
  lang: string,
): Promise<void> {
  const timeout = localeHomeAssertionTimeout();
  const titleNeedle = titleMarker.replace(/\.\s*$/, "").trim();

  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
    titleNeedle,
    { timeout },
  );
  await expect(page.locator("html")).toHaveAttribute("lang", lang, { timeout });
}
