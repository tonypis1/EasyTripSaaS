import { expect, type Page } from "@playwright/test";

export function isVercelPreviewBaseUrl(): boolean {
  return /vercel\.app/i.test(process.env.E2E_BASE_URL ?? "");
}

/** Timeout più lungo su Preview Vercel (cold start + SSR). */
export function localeHomeAssertionTimeout(): number {
  return isVercelPreviewBaseUrl() ? 30_000 : 10_000;
}

const CHROMIUM_LOAD_ERROR = /couldn.t load/i;

export async function isChromiumLoadErrorPage(page: Page): Promise<boolean> {
  const heading = await page
    .getByRole("heading", { level: 1 })
    .first()
    .textContent()
    .catch(() => null);
  return heading != null && CHROMIUM_LOAD_ERROR.test(heading);
}

export async function gotoHomePath(page: Page, path = "/"): Promise<void> {
  const preview = isVercelPreviewBaseUrl();
  const attempts = preview ? 3 : 1;
  const gotoTimeout = preview ? 120_000 : 60_000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const waitUntil = preview ? "domcontentloaded" : "load";
    await page.goto(path, {
      waitUntil,
      timeout: gotoTimeout,
    });
    if (!(preview && (await isChromiumLoadErrorPage(page)))) return;

    const retryPath = new URL(page.url()).pathname || path;
    if (retryPath !== path) {
      await page.goto(retryPath, { waitUntil, timeout: gotoTimeout });
      if (!(await isChromiumLoadErrorPage(page))) return;
    }

    if (attempt === attempts) {
      throw new Error(
        `Preview navigation to ${path} failed: Chromium error page after ${attempts} attempts (last URL: ${page.url()})`,
      );
    }
    await page.waitForTimeout(2_000);
  }
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

  if (await isChromiumLoadErrorPage(page)) {
    throw new Error(
      "Home page did not load (Chromium error page). On Vercel Preview, retry CI or check deployment health.",
    );
  }

  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
    titleNeedle,
    { timeout },
  );
  await expect(page.locator("html")).toHaveAttribute("lang", lang, { timeout });
}
