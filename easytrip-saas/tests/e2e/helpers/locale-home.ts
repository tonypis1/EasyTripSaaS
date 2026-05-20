import { expect, type Page } from "@playwright/test";
import { isVercelPreviewBaseUrl } from "./vercel-bypass";

export { isVercelPreviewBaseUrl };

/** Timeout asserzioni: Preview lento; in CI anche `npm run dev` sotto carico. */
export function localeHomeAssertionTimeout(): number {
  if (isVercelPreviewBaseUrl()) return 30_000;
  if (process.env.CI) return 25_000;
  return 10_000;
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

async function loadHomeDocument(
  page: Page,
  path: string,
  gotoTimeout: number,
): Promise<void> {
  const preview = isVercelPreviewBaseUrl();
  await page.goto(path, {
    waitUntil: preview ? "domcontentloaded" : "load",
    timeout: gotoTimeout,
  });
}

/**
 * Primo ingresso per test di auto-detection lingua.
 * Su Preview: redirect verificato con `commit`, poi `goto` diretto su /{locale}
 * (come `00-smoke-landing` — la catena redirect+load su `/` rompe Chromium).
 */
export async function enterHomeViaLocaleDetection(
  page: Page,
  expectedUrl: RegExp,
  localePath: string,
): Promise<void> {
  const timeout = localeHomeAssertionTimeout();
  const gotoTimeout = isVercelPreviewBaseUrl() ? 120_000 : 60_000;

  // Verifica redirect su `/` senza attendere `load` sulla catena (fragile su Preview e in CI).
  await page.goto("/", { waitUntil: "commit", timeout: gotoTimeout });
  await expect(page).toHaveURL(expectedUrl, { timeout });
  await page.goto(localePath, {
    waitUntil: isVercelPreviewBaseUrl() ? "load" : "domcontentloaded",
    timeout: gotoTimeout,
  });
  if (await isChromiumLoadErrorPage(page)) {
    throw new Error(
      `${localePath} did not load after redirect (URL was ${page.url()}).`,
    );
  }
}

/**
 * Ingresso generico su `/` o path localizzato (LocaleSwitcher, cookie test, ecc.).
 */
export async function gotoHomePath(page: Page, path = "/"): Promise<void> {
  const preview = isVercelPreviewBaseUrl();
  const attempts = preview ? 3 : 1;
  const gotoTimeout = preview ? 120_000 : 60_000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await loadHomeDocument(page, path, gotoTimeout);

    if (!(preview && (await isChromiumLoadErrorPage(page)))) return;

    if (preview) {
      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: gotoTimeout,
      });
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
