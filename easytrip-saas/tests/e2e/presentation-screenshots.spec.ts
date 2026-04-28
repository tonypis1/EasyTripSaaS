import { expect, test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(process.cwd(), "docs", "presentation-screenshots");

const authEnv = process.env.E2E_AUTH_STORAGE_STATE;
const tripId = process.env.E2E_TRIP_ID;
const joinTokenRaw = process.env.E2E_JOIN_TOKEN;

/** Accetta solo il token o un URL completo …/join/&lt;token&gt;. */
function normalizeJoinToken(raw?: string): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  try {
    if (/^https?:\/\//i.test(t)) {
      const p = new URL(t).pathname.replace(/\/$/, "");
      const m =
        p.match(/\/(?:it|en|de|es|fr)\/join\/([^/]+)/) ?? p.match(/\/join\/([^/]+)/);
      return m?.[1]?.trim();
    }
  } catch {
    /* ignore */
  }
  const m2 = t.match(/\/join\/([^/?#]+)/);
  return (m2?.[1] ?? t).trim();
}
const screenshotStripeHosted =
  process.env.E2E_SCREENSHOT_STRIPE === "1" ||
  process.env.E2E_SCREENSHOT_STRIPE === "true";

function resolveStorageState(): string | undefined {
  if (!authEnv) return undefined;
  return path.isAbsolute(authEnv) ? authEnv : path.join(process.cwd(), authEnv);
}

const defaultBaseUrl = () =>
  process.env.E2E_BASE_URL ?? "http://localhost:3000";

function isTransientGotoFailure(message: string): boolean {
  return (
    /NS_BINDING_ABORTED|net::ERR_ABORTED|frame was detached/i.test(message) ||
    /CONNECTION_REFUSED|NS_ERROR_CONNECTION|ECONNREFUSED|ERR_SOCKET|net::ERR_CONNECTION/i.test(
      message,
    )
  );
}

/** Backoff: errori connessione (server dev down / riavvio) meritano pause più lunghe dei soli BINDING_ABORTED. */
function backoffMsAfterAttempt(attempt: number, msg: string): number {
  if (/CONNECTION_REFUSED|NS_ERROR_CONNECTION/i.test(msg)) {
    const base = 2000 * (attempt + 1); // 2s, 4s, …
    return Math.min(base, 20_000);
  }
  return 600 * (attempt + 1);
}

/**
 * Firefox/App Router: NS_BINDING_ABORTED; dopo molti screenshot il dev può chiudere il socket →
 * NS_ERROR_CONNECTION_REFUSED (`reuseExistingServer: true` non riavvia `npm run dev`).
 */
async function gotoWithBindingRetry(
  page: Page,
  url: string,
  options: {
    timeout?: number;
    retries?: number;
    /** `load` è più fragile con App Router + Firefox; il default è più stabile. */
    waitUntil?: "commit" | "domcontentloaded" | "load";
  } = {},
) {
  const timeout = options.timeout ?? 120_000;
  const retries = options.retries ?? 8;
  const waitUntil = options.waitUntil ?? "domcontentloaded";
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = isTransientGotoFailure(msg);
      if (!retryable || attempt === retries - 1) {
        if (/CONNECTION_REFUSED|NS_ERROR_CONNECTION/i.test(msg)) {
          throw new Error(
            [
              "Connessione a ",
              defaultBaseUrl(),
              " rifiutata mentre Playwright caricava ",
              url,
              ". Il Next dev probabilmente è crashato o non è più in ascolto.",
              " Tieni aperto solo un `npm run dev`, controlla memoria/OS, poi riesegui.",
              ` Errore: ${msg.slice(0, 280)}`,
            ].join(""),
          );
        }
        throw e;
      }
      await page.waitForTimeout(backoffMsAfterAttempt(attempt, msg));
    }
  }
  throw last;
}

/** Domini Clerk ospitati (login / sign-up). */
function isClerkHostedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    return (
      u.hostname.endsWith(".accounts.dev") ||
      u.hostname.includes("clerk.accounts") ||
      u.hostname.endsWith("accounts.clerk.com")
    );
  } catch {
    return false;
  }
}

/** True se siamo sul login Clerk ospitato (sessione scaduta / storage non valido). */
function isClerkHostedSignIn(url: string): boolean {
  return isClerkHostedUrl(url);
}

/** Attende la fine dei redirect (Clerk → stesso host di `E2E_BASE_URL` / default, path richiesto). */
async function waitForAppOriginPath(
  page: Page,
  pathname: string,
  timeout = 90_000,
) {
  const base = new URL(defaultBaseUrl());
  const wantPath = pathname.replace(/\/$/, "") || "/";
  await page.waitForURL(
    (url) => {
      const href = typeof url === "string" ? url : url.href;
      if (isClerkHostedSignIn(href)) {
        throw new Error(
          `Clerk ha aperto il login ospitato (sessione scaduta o storage non valido). ` +
            `Riesegui \`npm run screenshots:clerk-session\` con lo stesso E2E_BASE_URL di questo test (attuale: ${defaultBaseUrl()}). ` +
            `URL: ${href.slice(0, 180)}`,
        );
      }
      try {
        const u = new URL(href);
        const hostOk = u.hostname === base.hostname && u.port === base.port;
        const p = u.pathname.replace(/\/$/, "") || "/";
        return hostOk && p === wantPath;
      } catch {
        return false;
      }
    },
    { timeout },
  );
}

/**
 * `/it/app/referral` è client-heavy; un `goto` puro spesso supera il timeout su `domcontentloaded`.
 * Meglio il link di navigazione (Route Next) + fallback `commit`.
 */
async function navigateToReferralPage(page: Page): Promise<void> {
  const invite = page.getByRole("link", { name: /^Invita amici$/ }).first();

  if (await invite.isVisible({ timeout: 12_000 }).catch(() => false)) {
    try {
      await Promise.all([
        page.waitForURL(/\/it\/app\/referral/i, { timeout: 240_000 }),
        invite.click(),
      ]);
      await waitForAppOriginPath(page, "/it/app/referral", 240_000);
      return;
    } catch {
      /* goto sotto */
    }
  }

  await gotoWithBindingRetry(page, "/it/app/referral", {
    timeout: 240_000,
    retries: 4,
    /** Si completa appena inizia il documento — meno bloccante di `domcontentloaded` sul dev. */
    waitUntil: "commit",
  });
  await page
    .waitForLoadState("domcontentloaded", { timeout: 180_000 })
    .catch(() => {});
  await waitForAppOriginPath(page, "/it/app/referral", 240_000);
}

test.describe("Screenshot per presentation.html (pubblici)", () => {
  test("cattura landing e gate autenticazione", async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Primo avvio Next (compile) può superare 60s; NS_ERROR_NET_TIMEOUT se il dev non è in ascolto.
    await page.goto("/it", { waitUntil: "domcontentloaded", timeout: 120_000 });
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

    /** Best effort: Sign-up CTA (hero) → schermata registrazione Clerk. */
    try {
      const signUpBtn = page.getByRole("button", {
        name: /^(Inizia ora|Start now|Empezar ahora|Commencer|Jetzt starten)$/i,
      }).first();
      await signUpBtn.waitFor({ state: "visible", timeout: 10_000 });
      await Promise.all([
        page.waitForURL((u) => isClerkHostedUrl(u.href), {
          timeout: 45_000,
        }),
        signUpBtn.click(),
      ]);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(OUT_DIR, "02b-auth-clerk-signup.png"),
        fullPage: false,
        timeout: 30_000,
      });
    } catch {
      /** UI Clerk o lingua diversa: 02b opzionale. */
    }

    await page.goto("/it/app/trips", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
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

    test("cattura dashboard, viaggi, form, dettaglio, referral, join, privacy", async ({
      page,
    }) => {
      /** Supera il default 180s di `playwright.presentation.config` (molte pagine + foto + dev lento). */
      test.setTimeout(600_000);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });

      await gotoWithBindingRetry(page, "/it/app", {
        timeout: 120_000,
        retries: 5,
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load", { timeout: 90_000 }).catch(() => {});
      await waitForAppOriginPath(page, "/it/app");

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

      // /app/trips: SSR + Prisma (listMyTrips). Non usare locator('main'): in errore globale o shell strana può non esserci <main>.
      // Il nav ha "I miei viaggi" come link, non come heading: l'h1 è univoco. Stringa lunga = contenuto reale della pagina (non solo nav).
      const tripsPageMarker = "generazione e lo sblocco giorno per giorno";
      await gotoWithBindingRetry(page, "/it/app/trips", {
        timeout: 120_000,
        retries: 5,
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {
        /* Next streaming: opzionale dopo domcontentloaded */
      });
      await waitForAppOriginPath(page, "/it/app/trips");
      const tripsTitle = page.getByRole("heading", {
        level: 1,
        name: "I miei viaggi",
        exact: true,
      });
      await expect(
        tripsTitle,
        "Elenco viaggi: controlla DATABASE_URL e log del dev server (errori Prisma), stesso E2E_BASE_URL della clerk-session e e2e/.auth/user.json.",
      ).toBeVisible({ timeout: 120_000 });
      await expect(page.locator("body")).toContainText(tripsPageMarker, {
        timeout: 30_000,
      });
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT_DIR, "04-app-trips-list.png"),
        fullPage: true,
        timeout: 60_000,
      });

      const form = page.locator("#create-trip-form");
      await expect(
        form,
        "Form creazione viaggio (#create-trip-form).",
      ).toBeVisible({
        timeout: 15_000,
      });
      await form.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await form.screenshot({
        path: path.join(OUT_DIR, "06-trips-create-form.png"),
        timeout: 30_000,
      });

      if (tripId && tripId.trim()) {
        const id = tripId.trim();
        await gotoWithBindingRetry(page, `/it/app/trips/${id}`, {
          timeout: 120_000,
          retries: 3,
        });
        await expect(page).toHaveURL(new RegExp(`/it/app/trips/${id}(\\?|$)`));
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

        const unlockHeading = page.getByRole("heading", {
          name: /sblocca la generazione/i,
        });
        if (await unlockHeading.isVisible().catch(() => false)) {
          await unlockHeading.scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
          await page.screenshot({
            path: path.join(OUT_DIR, "05b-trip-detail-checkout-cta.png"),
            fullPage: false,
            timeout: 30_000,
          });
        }

        const expensesHeading = page.getByRole("heading", {
          name: /^(Split spese|Expense split)$/i,
        });
        if (await expensesHeading.isVisible().catch(() => false)) {
          await expensesHeading.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          const expensesSection = expensesHeading.locator("xpath=ancestor::section[1]");
          await expensesSection.screenshot({
            path: path.join(OUT_DIR, "05c-trip-expenses.png"),
            timeout: 30_000,
          });
        }

        if (screenshotStripeHosted) {
          const payBtn = page.getByRole("button", {
            name: /vai al pagamento|usa i tuoi crediti/i,
          });
          if (
            await payBtn
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            try {
              await Promise.all([
                page.waitForURL(/checkout\.stripe\.com/i, { timeout: 45_000 }),
                payBtn.first().click(),
              ]);
              await page.waitForLoadState("load");
              await page.waitForTimeout(1500);
              await page.screenshot({
                path: path.join(OUT_DIR, "10-checkout-stripe.png"),
                fullPage: false,
                timeout: 30_000,
              });
            } catch {
              // Trip già pagato, importo zero, o Stripe non configurato: salta 10
            }
            await gotoWithBindingRetry(page, "/it/app/trips", {
              timeout: 120_000,
              retries: 4,
              waitUntil: "domcontentloaded",
            });
          }
        }
      }

      await navigateToReferralPage(page);
      await page.waitForLoadState("load", { timeout: 90_000 }).catch(() => {});
      await expect(
        page.getByRole("heading", { name: /invita un amico/i }),
      ).toBeVisible({ timeout: 120_000 });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, "07-referral.png"),
        fullPage: true,
        timeout: 60_000,
      });

      const joinToken = normalizeJoinToken(joinTokenRaw);
      if (joinToken) {
        await gotoWithBindingRetry(page, `/it/join/${joinToken}`, {
          timeout: 120_000,
          retries: 4,
          waitUntil: "domcontentloaded",
        });
        await page.waitForLoadState("load", { timeout: 90_000 }).catch(() => {});
        await page.waitForTimeout(2000);
        await page.screenshot({
          path: path.join(OUT_DIR, "08-join-trip.png"),
          fullPage: true,
          timeout: 60_000,
        });
      }

      await gotoWithBindingRetry(page, "/it/app/account/privacy", {
        timeout: 120_000,
        retries: 4,
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load", { timeout: 90_000 }).catch(() => {});
      await waitForAppOriginPath(page, "/it/app/account/privacy");
      await expect(
        page.getByRole("heading", { name: /privacy e dati personali/i }),
      ).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(OUT_DIR, "09-account-privacy.png"),
        fullPage: true,
        timeout: 60_000,
      });

      const deleteSection = page.locator("#account-delete-section");
      await deleteSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await deleteSection.screenshot({
        path: path.join(OUT_DIR, "09b-account-delete-form.png"),
        timeout: 30_000,
      });
    });
  });
}
