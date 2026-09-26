import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Setup Auth per la suite "acquisto piano Pro" (checkoutFlow.spec.ts).
 *
 * Perché questo file esiste e cosa fa, in ordine:
 *
 *  1. `clerkSetup()` recupera un **Testing Token** dalla Backend API di
 *     Clerk (richiede `CLERK_SECRET_KEY` nel processo Playwright, chiave
 *     `sk_test_…`). Da questo momento in poi, per l'intera run, qualunque
 *     interazione con Clerk (login, redirect, account portal) viene
 *     riconosciuta come traffico di test automatizzato e NON incappa in
 *     CAPTCHA / bot-detection. Questo è il meccanismo che evita i "blocchi
 *     dei bot" richiesti: non si aggira Clerk, si usa la sua modalità di
 *     test ufficiale (@clerk/testing).
 *
 *  2. Login "a freddo" con un account Clerk di test **stabile** (email in
 *     `E2E_CLERK_USER_EMAIL`) tramite Backend API (login ticket via
 *     `clerk.signIn`, niente form/niente UI) e salvataggio di cookie +
 *     localStorage in `playwright/.auth/user.json`.
 *
 * `checkoutFlow.spec.ts` NON riusa questo file per il "nuovo utente" che fa
 * il flusso di acquisto principale (quello viene creato lì, da zero, via
 * Backend API, per testare davvero un onboarding realistico). Riusa invece
 * `playwright/.auth/user.json` per gli scenari secondari dove non ha senso
 * rifare tutta la UI di signup (es. warm-up del dev server, sessione
 * "rapida" di fallback).
 */

const authFile = path.join(process.cwd(), "playwright", ".auth", "user.json");

function isItalianAppPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return /^\/it\/app(\/|$)/.test(p);
}

function isBindingAbortError(message: string): boolean {
  return /NS_BINDING_ABORTED|net::ERR_ABORTED|frame was detached/i.test(
    message,
  );
}

/** Ritenta il goto: la prima compilazione (`next dev`) di rotte pesanti può superare i timeout di default. */
async function gotoWithRetry(
  page: Page,
  url: string,
  options: {
    acceptablePath?: (pathname: string) => boolean;
    timeout?: number;
  } = {},
) {
  const timeout = options.timeout ?? 120_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      return;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isBindingAbortError(msg)) throw e;
      if (options.acceptablePath) {
        try {
          if (options.acceptablePath(new URL(page.url()).pathname)) return;
        } catch {
          /* ignore */
        }
      }
      await page.waitForTimeout(600 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

setup(
  "clerk testing token + sessione stabile → playwright/.auth/user.json",
  async ({ page }) => {
    setup.setTimeout(300_000);

    const email = process.env.E2E_CLERK_USER_EMAIL?.trim();
    if (!email) {
      throw new Error(
        "Imposta E2E_CLERK_USER_EMAIL (email di un utente Clerk esistente nell'istanza di test/dev).",
      );
    }

    // Step chiave anti-bot: da qui in poi Clerk riconosce questa run come test.
    await clerkSetup();

    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    const password = process.env.E2E_CLERK_USER_PASSWORD?.trim();

    await gotoWithRetry(page, "/it");

    try {
      if (secretKey) {
        // Login "ticket" via Backend API: nessuna UI, nessun rischio di blocco bot.
        await clerk.signIn({ page, emailAddress: email });
      } else if (password) {
        await clerk.signIn({
          page,
          signInParams: { strategy: "password", identifier: email, password },
        });
      } else {
        throw new Error(
          "Imposta CLERK_SECRET_KEY (consigliato, sk_test_…) oppure E2E_CLERK_USER_PASSWORD.",
        );
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Sign-in Clerk fallito per il setup auth. Verifica CLERK_SECRET_KEY / E2E_CLERK_USER_EMAIL / E2E_CLERK_USER_PASSWORD. Dettagli: ${detail}`,
      );
    }

    await gotoWithRetry(page, "/it/app", {
      acceptablePath: isItalianAppPath,
      timeout: 180_000,
    });

    const dashboardHeading = page
      .getByRole("heading", { level: 1 })
      .filter({ hasText: /la tua dashboard/i })
      .first();
    await expect(dashboardHeading).toBeVisible({ timeout: 60_000 });

    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    await page.context().storageState({ path: authFile });
  },
);
