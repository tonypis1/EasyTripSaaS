import { expect, test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(process.cwd(), "docs", "presentation-screenshots");

const authEnv = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;

function resolveStorageState(): string | undefined {
  if (!authEnv) return undefined;
  return path.isAbsolute(authEnv) ? authEnv : path.join(process.cwd(), authEnv);
}

/** Attende la fine dei redirect (Clerk → stesso host di `E2E_BASE_URL` / default, path richiesto). */
async function waitForAppOriginPath(
  page: Page,
  pathname: string,
  timeout = 90_000,
) {
  const base = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000");
  await page.waitForURL(
    (url) => {
      try {
        const u = new URL(url);
        const hostOk = u.hostname === base.hostname && u.port === base.port;
        const p = u.pathname.replace(/\/$/, "") || "/";
        return hostOk && p === pathname;
      } catch {
        return false;
      }
    },
    { timeout },
  );
}

test.describe("Screenshot per presentation.html (pubblici)", () => {
  test("cattura landing e gate autenticazione", async ({ page }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    const landingPath = path.join(OUT_DIR, "01-landing.png");
    try {
      await page.screenshot({
        path: landingPath,
        fullPage: true,
        timeout: 45_000,
      });
    } catch {
      await page.screenshot({
        path: landingPath,
        fullPage: false,
        timeout: 30_000,
      });
    }

    await page.goto("/app/trips", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(OUT_DIR, "02-auth-clerk.png"),
      fullPage: false,
      timeout: 30_000,
    });
  });
});

const storagePath = resolveStorageState();
const hasValidStorage = Boolean(storagePath && fs.existsSync(storagePath));

if (hasValidStorage && storagePath) {
  test.describe("Screenshot per presentation.html (sessione Clerk)", () => {
    test.use({ storageState: storagePath });

    test("cattura /app, elenco viaggi e dettaglio trip", async ({ page }) => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });

      await page.goto("/app", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForLoadState("load");
      await waitForAppOriginPath(page, "/app");

      // Stesso criterio di `presentation-auth.setup.ts` (getByRole), non `main h1`:
      // in redirect / hydration `main` può mancare momentaneamente o la pagina può non essere ancora la dashboard.
      await expect(
        page.getByRole("heading", { name: /la tua dashboard/i }),
        "Dashboard /app: se fallisce, riesegui `npm run screenshots:clerk-session`, stesso `E2E_BASE_URL` (es. 127.0.0.1) e `e2e/.auth/user.json`.",
      ).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(OUT_DIR, "03-app-dashboard.png"),
        fullPage: false,
        timeout: 30_000,
      });

      await page.goto("/app/trips", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForLoadState("load");
      await waitForAppOriginPath(page, "/app/trips");
      await expect(
        page.getByRole("heading", { name: /i miei viaggi/i }),
        "Elenco viaggi: sessione o caricamento falliti.",
      ).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT_DIR, "04-app-trips-list.png"),
        fullPage: true,
        timeout: 60_000,
      });

      if (!tripId || !tripId.trim()) {
        return;
      }

      const id = tripId.trim();
      await page.goto(`/app/trips/${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await expect(page).toHaveURL(new RegExp(`/app/trips/${id}(\\?|$)`));
      await page
        .getByRole("heading", { level: 1 })
        .first()
        .waitFor({ state: "visible", timeout: 25_000 });
      await page.waitForTimeout(2000);
      const detailPath = path.join(OUT_DIR, "05-trip-detail.png");
      try {
        await page.screenshot({
          path: detailPath,
          fullPage: true,
          timeout: 90_000,
        });
      } catch {
        await page.screenshot({
          path: detailPath,
          fullPage: false,
          timeout: 30_000,
        });
      }
    });
  });
}
