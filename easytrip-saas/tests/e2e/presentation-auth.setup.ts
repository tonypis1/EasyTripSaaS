import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authFile = path.join(process.cwd(), "e2e", ".auth", "user.json");

/** Path dashboard app in italiano (stringhe next-intl usate negli assert E2E). */
function isItalianAppPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return /^\/it\/app(\/|$)/.test(p);
}

function isItalianLocalePath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return /^\/it(?:\/|$)/.test(p);
}

function isBindingAbortError(message: string): boolean {
  return /NS_BINDING_ABORTED|net::ERR_ABORTED|frame was detached/i.test(message);
}

/**
 * Firefox: dopo redirect Clerk il `goto` può fallire con NS_BINDING_ABORTED anche se la navigazione è comunque finita.
 */
async function gotoWithBindingRetry(
  page: Page,
  url: string,
  options: {
    acceptablePath?: (pathname: string) => boolean;
    retries?: number;
  } = {},
) {
  const retries = options.retries ?? 4;
  const acceptablePath = options.acceptablePath;
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      return;
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isBindingAbortError(msg)) throw e;
      if (acceptablePath) {
        try {
          if (acceptablePath(new URL(page.url()).pathname)) return;
        } catch {
          /* ignore */
        }
      }
      if (attempt < retries - 1) {
        await page.waitForTimeout(600 * (attempt + 1));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

function throwIfForeignAuthHost(page: Page): void {
  let host: string;
  try {
    host = new URL(page.url()).hostname;
  } catch {
    throw new Error(`URL non valido dopo la navigazione: ${page.url()}`);
  }
  if (
    host.endsWith(".accounts.dev") ||
    host.includes("clerk.accounts") ||
    host.endsWith("accounts.clerk.com")
  ) {
    throw new Error(
      [
        "Il browser è ancora sul dominio di login Clerk ospitato invece che su localhost.",
        "Senza sessione sul tuo dev server, la dashboard EasyTrip non viene mai renderizzata.",
        "Assicurati che `CLERK_SECRET_KEY` (sk_test_…) sia nel processo Playwright (stesso `.env` di `npm run dev`, o copia in `.env.local`);",
        "altrimenti verifica `E2E_CLERK_USER_PASSWORD` e che l’utente abbia password (non solo OAuth).",
        `URL: ${page.url().slice(0, 220)}`,
      ].join(" "),
    );
  }
}

async function gotoItalianAppDashboard(page: Page) {
  await gotoWithBindingRetry(page, "/it/app", {
    acceptablePath: isItalianAppPath,
  });
}

/**
 * Porta il browser sulla dashboard app in italiano (`/it/app`).
 * Dopo `clerk.signIn` spesso si resta sulla home senza redirect verso `/app`.
 */
async function ensureOnAppDashboard(page: Page) {
  await gotoItalianAppDashboard(page);
}

/**
 * Crea `e2e/.auth/user.json` per `screenshots:presentation`.
 * Usa @clerk/testing (Testing Token): niente flusso Google nel browser automatizzato.
 */
setup("clerk session → e2e/.auth/user.json", async ({ page }) => {
  setup.setTimeout(360_000);

  const email = process.env.E2E_CLERK_USER_EMAIL?.trim();
  if (!email) {
    throw new Error(
      "Imposta E2E_CLERK_USER_EMAIL (email dell'utente Clerk in istanza dev/test).",
    );
  }

  await clerkSetup();

  await gotoWithBindingRetry(page, "/it", { acceptablePath: isItalianLocalePath });

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  const password = process.env.E2E_CLERK_USER_PASSWORD?.trim();

  /**
   * Preferisci il ticket via Backend API (email): è molto più stabile del password
   * lato browser (spesso restiamo su *.accounts.dev senza sessione su localhost).
   * Richiede CLERK_SECRET_KEY (di solito solo in `.env`, caricata da Playwright).
   */
  try {
    if (secretKey) {
      await clerk.signIn({ page, emailAddress: email });
    } else if (password) {
      await clerk.signIn({
        page,
        signInParams: {
          strategy: "password",
          identifier: email,
          password,
        },
      });
    } else {
      throw new Error(
        "Imposta CLERK_SECRET_KEY in .env (consigliato) oppure E2E_CLERK_USER_PASSWORD in .env.local per il login screenshot.",
      );
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      [
        "Sign-in Clerk per E2E fallito.",
        "Verifica: (1) in Clerk Dashboard → Users esiste un utente con questa email;",
        "(2) `CLERK_SECRET_KEY` (sk_test_…) presente nel processo: stesso file `.env` che usi per `npm run dev`, oppure copia la chiave in `.env.local` solo in locale;",
        "(3) se usi solo password: l'account deve avere password (non solo OAuth) e `E2E_CLERK_USER_PASSWORD` corretta;",
        "(4) stesso `E2E_BASE_URL` del dev server (localhost vs 127.0.0.1).",
        `Errore originale: ${detail}`,
      ].join(" "),
    );
  }

  /* Subito dopo Clerk evitiamo un secondo goto su `/it` (spesso NS_BINDING_ABORTED su Firefox). Andiamo diretti alla dashboard. */
  await ensureOnAppDashboard(page);
  throwIfForeignAuthHost(page);

  /** Titolo dashboard da messages (it / en). Non richiede `main` se il layout cambia leggermente. */
  const dashboardH1 = page
    .getByRole("heading", { level: 1 })
    .filter({ hasText: /la tua dashboard|your dashboard/i })
    .first();
  await expect(dashboardH1).toBeVisible({ timeout: 60_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
